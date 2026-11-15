#!/usr/bin/env python3

# Docs: https://platform.openai.com/docs/guides/structured-outputs
# Additional resources: https://github.com/OthersideAI/chronology

from flask import Flask, jsonify, request, Response, sessions
from openai import OpenAI
from dotenv import load_dotenv
from flask_cors import CORS
import json
from client import supabase
from clerk_backend_api import Clerk
from clerk_backend_api.jwks_helpers import AuthenticateRequestOptions
import os
import base64
import fitz
import subprocess
import tempfile
import requests
import uuid
import io
import hashlib
from concurrent.futures import ThreadPoolExecutor
from lxml import etree
from pptx import Presentation
from docx import Document

# Load environment variables
load_dotenv()

# Initialize OpenAI client
chatgpt_client = OpenAI()

# Model that draws the figures for questions, and the public Supabase storage bucket they are kept in
IMAGE_MODEL = os.environ.get("OPENAI_IMAGE_MODEL", "gpt-image-2.6-flare")
QUESTION_IMAGES_BUCKET = "question-images"

# picture formats inside a document that the model can read (others, like emf, are skipped)
READABLE_IMAGE_TYPES = {"image/png", "image/jpeg", "image/gif", "image/webp"}
MAX_DOCUMENT_IMAGES = 40

def local_name(node):
    """The tag of an XML node without its namespace ("" for comments and the like)."""
    return etree.QName(node).localname if isinstance(node.tag, str) else ""

def xml_text(element):
    """The text inside a piece of Office XML, including the text of equations."""
    return "".join(node.text or "" for node in element.iter() if local_name(node) == "t")

def document_pictures(part, seen_pictures):
    """The pictures a slide or document uses, as message content, without ones already seen (like a logo on every slide)."""
    pictures = []
    for relationship in part.rels.values():
        if relationship.is_external or not relationship.reltype.endswith("/image"):
            continue
        picture = relationship.target_part
        digest = hashlib.sha1(picture.blob).hexdigest()
        if picture.content_type not in READABLE_IMAGE_TYPES or digest in seen_pictures or len(seen_pictures) >= MAX_DOCUMENT_IMAGES:
            continue
        seen_pictures.add(digest)
        pictures.append({"type": "image_url", "image_url": {"url": f"data:{picture.content_type};base64,{base64.b64encode(picture.blob).decode('ascii')}"}})
    return pictures

def read_slides(file_bytes):
    """Returns the text of a PowerPoint file, slide by slide (with speaker notes), and its pictures."""
    presentation = Presentation(io.BytesIO(file_bytes))
    text, pictures, seen_pictures = [], [], set()
    for slide_number, slide in enumerate(presentation.slides, start=1):
        # every paragraph on the slide, wherever it is: text boxes, tables, grouped shapes
        lines = [xml_text(paragraph) for paragraph in slide.shapes._spTree.iter() if local_name(paragraph) == "p"]
        text.append(f"--- Slide {slide_number} ---\n" + "\n".join(line for line in lines if line.strip()))
        if slide.has_notes_slide and slide.notes_slide.notes_text_frame and slide.notes_slide.notes_text_frame.text.strip():
            text.append(f"Speaker notes: {slide.notes_slide.notes_text_frame.text.strip()}")
        pictures.extend(document_pictures(slide.part, seen_pictures))
    return "\n\n".join(text), pictures

def read_docx(file_bytes):
    """Returns the text of a Word file, with its tables, in reading order, and its pictures."""
    document = Document(io.BytesIO(file_bytes))
    text = []
    for block in document.element.body.iterchildren():
        kind = local_name(block)
        if kind == "p":
            if xml_text(block).strip():
                text.append(xml_text(block))
        elif kind == "tbl":
            for row in block.iter():
                if local_name(row) == "tr":
                    text.append(" | ".join(xml_text(cell).strip() for cell in row if local_name(cell) == "tc"))
    return "\n".join(text), document_pictures(document.part, set())

def generate_question_image(image_prompt):
    """Draws the figure for a question and returns its public URL, or None if it could not be made."""
    try:
        result = chatgpt_client.images.generate(
            model=IMAGE_MODEL,
            prompt=(
                "A clean, accurate figure for an exam question, in the style of a textbook diagram: "
                "plain white background, crisp lines, large legible labels, no decoration. "
                "Draw only what is described, exactly as described. Do not add a title, a caption, "
                "the question itself, or anything that gives away the answer.\n\n"
                f"{image_prompt}"
            ),
            quality="medium",
            output_format="webp",
            output_compression=85,
        )
        image_bytes = base64.b64decode(result.data[0].b64_json)
        path = f"{uuid.uuid4()}.webp"
        supabase.storage.from_(QUESTION_IMAGES_BUCKET).upload(path, image_bytes, {"content-type": "image/webp"})
        return supabase.storage.from_(QUESTION_IMAGES_BUCKET).get_public_url(path)
    except Exception as exception:
        # a question without its figure is better than no assessment
        print(f"Could not generate question image: {exception}")
        return None

class UnreadableFile(Exception):
    """An uploaded file that could not be opened; the message is shown to the user."""

def files_to_message_content(files):
    """Turns uploaded files (images, PDFs, slides, Word files) into message content: a list of text parts and a list of images."""
    images_base64_encoded = []
    documents_text = [] # the text of uploaded slides and Word files
    for image in files:
        if image.filename == "undefined":
            continue

        file_extension = os.path.splitext(image.filename or "")[1].lower()
        if file_extension in (".pptx", ".docx"):
            # slides and Word files are read as their text plus the pictures inside them
            try:
                document_text, document_images = (read_slides if file_extension == ".pptx" else read_docx)(image.read())
            except Exception as exception:
                print(f"Could not read {image.filename}: {exception}")
                raise UnreadableFile(f"Could not read {image.filename}. Is it a valid {file_extension} file?")
            if document_text.strip():
                documents_text.append({"type": "text", "text": f"Contents of the uploaded file \"{image.filename}\":\n\n{document_text}"})
            images_base64_encoded.extend(document_images)

        elif image.content_type == "application/pdf":
            # convert pdf pages into images
            pdfs_as_imgs = fitz.open(stream=image.read(), filetype="pdf")
            for page in pdfs_as_imgs:
                pix = page.get_pixmap(matrix=fitz.Matrix(300/72, 300/72), alpha=False)
                current_image_base64 = base64.b64encode(pix.tobytes()).decode("ascii")
                images_base64_encoded.append({"type": "image_url", "image_url": {"url": f"data:image/png;base64,{current_image_base64}"}})

        else:
            current_image_base64 = base64.b64encode(image.read()).decode("utf-8") # openai api takes in images as base64
            images_base64_encoded.append({"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{current_image_base64}"}})

    return documents_text, images_base64_encoded

# ---- Class context ----
# A course carries context the student gives about the class, used whenever the AI works on it:
# - context_notes: what the student wrote about the class
# - context_files: files they uploaded (worked solutions, rubrics...), kept as text: the full
#   "content" and a short "summary" of what it says about how answers must be written
# - memory: short notes saved from the tutor chat
MAX_CONTEXT_FILE_CHARACTERS = 20000

def get_course(course_id):
    """The course row, or None if there is no such course."""
    try:
        rows = supabase.table("courses").select("*").eq("id", int(course_id)).execute().data
        return rows[0] if rows else None
    except Exception as exception:
        print(f"Could not load course {course_id}: {exception}")
        return None

def course_context_text(course, brief=False):
    """The class context as text for a prompt, or "" if the class has none.

    The full version has the whole text of the uploaded files, for writing questions and solutions.
    The brief version only has their summaries, for the calls that happen all the time (grading, chat)."""
    if not course:
        return ""
    sections = []
    if (course.get("context_notes") or "").strip():
        sections.append("Notes from the student about this class:\n" + course["context_notes"].strip())
    if course.get("memory"):
        sections.append("Things to remember about this class:\n" + "\n".join(f"- {memory}" for memory in course["memory"]))
    for context_file in course.get("context_files") or []:
        if brief:
            if (context_file.get("summary") or "").strip():
                sections.append(f"From the class material \"{context_file.get('name')}\":\n{context_file['summary'].strip()}")
        elif (context_file.get("content") or "").strip():
            sections.append(f"Class material \"{context_file.get('name')}\":\n{context_file['content'].strip()}")
    return "\n\n".join(sections)

def class_expectations_for_grading(course_id):
    """The part of a grading prompt that holds the class's expectations, or "" if there are none."""
    class_context = course_context_text(get_course(course_id), brief=True) if course_id else ""
    if not class_context:
        return ""
    return f"""
                This question is from a class with its own expectations for how answers are written:
                <class_context>
                {class_context}
                </class_context>
                These expectations are part of the grading of a written or drawn answer: an answer that reaches the right result but is not written the way the class requires (for example it leaves out the explanation of its steps that the class asks for) is incorrect, and the feedback should say what is missing.
                They do not apply when the answer is just picking a choice in a multiple choice or true/false question.
    """

def add_course_memory(course_id, memory):
    """Adds a note to the memory of a class. Returns what to tell the model that asked for it."""
    memory = (memory or "").strip()
    course = get_course(course_id)
    if not course or not memory:
        return "Could not save this."
    memories = course.get("memory") or []
    if memory not in memories:
        supabase.table("courses").update({"memory": [*memories, memory]}).eq("id", course["id"]).execute()
    return "Saved to the class memory."

# lets the tutor chat save something the student says about their class
REMEMBER_FOR_CLASS_TOOL = {
    "type": "function",
    "function": {
        "name": "remember_for_class",
        "description": "Save a lasting fact about the student's class to the class memory, so it is used for every future question, test and grading in this class.",
        "parameters": {
            "type": "object",
            "properties": {
                "memory": {
                    "type": "string",
                    "description": "One short note that makes sense on its own, for example: \"The professor wants every limit answer to name the dominant term and justify each step in words.\"",
                },
            },
            "required": ["memory"],
        },
    },
}

# Initialize Clerk client
clerk_client = Clerk(os.environ.get("CLERK_SECRET_KEY"))

server = Flask(__name__)
CORS(server, supports_credentials=True)

@server.route('/')
def index():
    request_state = clerk_client.authenticate_request(request, AuthenticateRequestOptions(authorized_parties=["http://frontend:3000", "http://localhost:3000", os.environ.get("FRONTEND_URL")]))
    print(request_state)
    return jsonify({ "message": request_state })  # Return response as JSON

@server.route("/generateassessement", methods=["POST"])
def generate_assessment():
    request_state = clerk_client.authenticate_request(request, AuthenticateRequestOptions(authorized_parties=["http://frontend:3000", "http://localhost:3000", os.environ.get("FRONTEND_URL")]))
    if request_state.is_signed_in != True:
        return jsonify({"message": request_state.reason})
    user_id = request_state.payload.get("sub")
    num_of_questions = request.form.get("numOfQuestions", 10) # number of questions to produce, or "auto" to match the input
    auto_num_of_questions = num_of_questions == "auto"
    if auto_num_of_questions:
        questions_amount_instruction = "Choose the number of questions yourself, based on the input. If the input is a set of problems (homework, a worksheet, a practice exam), generate one question for every problem in it, in the same order (a problem with parts is one multi-part question). If the input is other material (notes, slides, a reading, a topic), generate as many questions as it takes to cover its main ideas, between 5 and 20."
    else:
        questions_amount_instruction = f"Generate an assessment of {num_of_questions} questions based on the input."
    form_images = request.files.getlist("uploadedFiles") # images to create a question from
    print(form_images)
    text_input = request.form.get("content", "") # Get textInput from formData
    
    try:
        documents_text, images_base64_encoded = files_to_message_content(form_images)
    except UnreadableFile as exception:
        return jsonify({"error": str(exception)}), 400

    # what the student has told us about the class this assessment is for
    class_context = course_context_text(get_course(request.form.get("courseId")))
    class_context_instruction = ""
    if class_context:
        class_context_instruction = f"""
            **Class context:**
            This assessment is for a class. Below, between the <class_context> tags, is what the student has provided about it: notes on how the professor wants things done, things to remember, and example material such as worked solutions. Follow it.
            - Write the questions the way this class's work is written: the same style, notation, and level of difficulty.
            - If the class expects answers to be written a certain way (for example every step explained and justified in words, a required structure, units or rounding rules), build that into the questions: use "LATEX" questions (a written answer) instead of "MCQ" or "BOOL" wherever the expectation applies, and say in the question what a full answer must include. The answers are graded against these expectations, so an answer that skips them is marked incorrect.
            - The class context is about how to write and answer questions. The topics of the questions still come from the input.

            <class_context>
            {class_context}
            </class_context>
            """

    input_messages = [{
            "role": "system",
            "content": f"""Create question(s) based on the image(s) and text input.
            {class_context_instruction}

            If an image is uploaded, dont reference it in the questions in any way. Create questions that are very similiar to the ones in the image, but dont be exactly the same.

            dont include "ext" anywhere.

            for example `Calculate the heat capacity of a calorimeter if 1.057 g of benzoic acid ( ext{{C}}_7 ext{{H}}_6 ext{{O}}_2) is burned and the temperature increases from 22.75^ ext{{o}}C to 29.00^ ext{{o}}C`
            those `ext{{}}`'s dont include them in the question.

            These are the question types you can choose from:
            
            - Multiple choice: The "question_type" value should be "MCQ".
            - True or false: The "question_type" value should be "BOOL".
            - word input problem: The "question_type" value should be "LATEX". Prefer these over the other 2
            - drawing problem: The "question_type" value should be "DRAWING".
            - table problem: The "question_type" value should be "TABLE".
            
            **Multi-part questions:**
            - Keep the structure of the input. If a problem in the input has lettered or numbered parts (like 29. a, b, c or 30. a) b) c)) that share one setup, the question you create from it MUST be a multi-part question with one part for each of its parts.
            - NEVER split the parts of a problem into separate standalone questions, and NEVER squeeze several parts into the text of one question.
            - Also create a multi-part question when several sub-questions naturally build on the same scenario.
            - A multi-part question counts as ONE question toward the total, no matter how many parts it has.
            - If you need more questions than the input has problems, create more variations of those problems with the same structure (a multi-part problem gives more multi-part questions). Dont reach the total by splitting parts up.
            - Instead of "question" and "question_type", a multi-part question object has:
                - `"context"` (string): the setup shared by all the parts, with all the given information the parts rely on.
                - `"parts"` (array of 2 or more objects): each part is shaped like a normal question object ("question", "question_type", and "answers" when needed). Later parts can build on earlier ones.
            - Dont put labels like "(a)" or "Part b" in the text of a part, and dont repeat the context inside the parts.

            **Images in questions:**
            - A question can come with a figure, which an image generator draws from a description you write. To give a question a figure, add `"image_prompt"` (string) to the question object. For a multi-part question, put it on the multi-part object next to "context" (not on the parts); the figure is then shown with the context for every part.
            - Only add a figure when it really helps: a geometry figure, a graph or plot, a free body diagram, a circuit, a molecule or structure, a labelled diagram, a map, an experimental setup. If the problem in the input comes with a figure, the question you create from it should have one too. Most questions need no figure; leave "image_prompt" out for those.
            - The description must stand on its own: the image generator sees nothing but it. Say exactly what to draw, with every shape, axis, scale, label, value and unit, and where each one goes. Write labels as plain text (no MathJax).
            - The figure must agree with the question. Image generators are imprecise, so also state in the question text every value needed to answer it; dont make the student read exact numbers off the figure.
            - The figure must never show or give away the answer.
            - The question text can refer to the figure ("in the figure", "the circuit shown").

            **MathJax Usage:**
            - Apply MathJax **to questions and answers wherever beneficial**, including MCQ and BOOL questions.  
            - Use \\(...\\) for inline math (e.g., "Solve for \\(x\\) in \\(2x + 3 = 7\\).").  
            - Use \\[...\\] for display math (e.g., "Evaluate: \\[ \\int_0^1 x^2 \\,dx \\]").  

            **Assessment Requirements:**  
            - {questions_amount_instruction}
            - Use MathJax in **both questions and answers** whenever it improves clarity.
            - The response must be a **valid JSON object** with:
            - `"image_description"` (string) say what you see in the image, include EVERYTHING, describe all of it.
            - `"assessment_name"` (string)  
            - `"questions"` (array of objects). Each object is either a single question or a multi-part question.
            - A single question must have:
                - `"question"` (string, using MathJax when beneficial)
                - `"question_type"` (string, either `"MCQ"`, `"BOOL"`, or `"LATEX"`)
                - If `"question_type"` is `"MCQ"` or `"BOOL"`, it must include `"answers"` (array of strings, using MathJax where beneficial).
                - Optionally `"image_prompt"` (string), only when the question needs a figure.
            - A multi-part question must have:
                - `"context"` (string, using MathJax when beneficial)
                - `"parts"` (array of single question objects)
                - Optionally `"image_prompt"` (string), only when the question needs a figure.

            **Response Format:**  
            - Return a **valid JSON object**.  
            - Do **not** include any explanations, comments, or extra text—only return the JSON object.
            """
        }]

    user_content = [
        *([{"type": "text", "text": text_input}] if text_input else []),
        *documents_text,
        *images_base64_encoded,
    ]
    if user_content:
        input_messages.append({
            "role": "user",
            "content": user_content
        })

    completion = chatgpt_client.chat.completions.create(
        model="gpt-5.6-luna",
        reasoning_effort="xhigh",
        response_format={ "type": "json_object" },
        messages=input_messages
    )

    completion_text = completion.choices[0].message.content

    try:
        parsed_assessment = json.loads(completion_text.strip())  # Ensure the response is in proper JSON format
    except json.JSONDecodeError as exception:
        print(exception)
        parsed_assessment = {"error": "Invalid JSON response from AI"}

    print(completion_text)
    print(parsed_assessment)
    print(parsed_assessment["assessment_name"])
    questions = []

    assesment_id = supabase.table("assessments").insert({ "user_id": user_id, "total_questions": len(parsed_assessment["questions"]) if auto_num_of_questions else num_of_questions, "name": parsed_assessment["assessment_name"], "course_id": request.form.get("courseId", 1) }).execute().data[0]["id"]
    print(assesment_id)

    # check if we got the right amount of questions
    def check_questions_length():
        if len(parsed_assessment["questions"]) < int(num_of_questions):
            completion = chatgpt_client.chat.completions.create(
                model="gpt-5.6-luna",
                reasoning_effort="xhigh",
                response_format={ "type": "json_object" },
                messages=input_messages.append({
                    "role": "user",
                    "content": [{"type": "text", "text": f"give me {int(num_of_questions) - len(parsed_assessment["questions"])} more questions"}]
                })
            )
            more_questions = json.loads(completion.choices[0].message.content.strip())
            parsed_assessment["questions"].extend(more_questions["questions"][:int(num_of_questions) - len(parsed_assessment["questions"])])
            if len(parsed_assessment["questions"]) < int(num_of_questions):
                check_questions_length()

    if not auto_num_of_questions:
        check_questions_length()

    def question_row(question):
        row = {
            "question": question["question"],
            "question_type": question["question_type"],
            "is_answered": False,
            "assessment_id": assesment_id,
        }
        if question["question_type"] == "MCQ":
            row["answers"] = question["answers"]
        return row

    # draw the figures of the questions that have one, all at the same time
    def image_prompt_of(question):
        image_prompt = question.get("image_prompt")
        return image_prompt.strip() if isinstance(image_prompt, str) else ""

    questions_with_image = [question for question in parsed_assessment["questions"] if image_prompt_of(question)]
    image_urls = {}
    if questions_with_image:
        with ThreadPoolExecutor(max_workers=4) as executor:
            urls = executor.map(generate_question_image, [image_prompt_of(question) for question in questions_with_image])
            image_urls = {id(question): url for question, url in zip(questions_with_image, urls) if url}

    # image_description is what the figure shows, so the grader and the tutor chat know about it too
    def image_columns(question):
        if id(question) not in image_urls:
            return {}
        return {"image_url": image_urls[id(question)], "image_description": image_prompt_of(question)}

    # each part of a multi-part question is its own row; the parts share a group_number, context and figure
    has_multi_part = False
    for group_number, question in enumerate(parsed_assessment["questions"], start=1):
        if question.get("parts"):
            has_multi_part = True
            for part in question["parts"]:
                questions.append({
                    **question_row(part),
                    "group_number": group_number,
                    "context": question.get("context", ""),
                    **image_columns(question),
                })
        else:
            questions.append({**question_row(question), **image_columns(question)})

    # rows inserted together need the same keys
    if has_multi_part:
        for row in questions:
            row.setdefault("group_number", None)
            row.setdefault("context", None)
            row.setdefault("answers", None)
    if image_urls:
        for row in questions:
            row.setdefault("image_url", None)
            row.setdefault("image_description", None)
            row.setdefault("answers", None)

    supabase.table("questions").insert(questions).execute()
    return jsonify({"message": {
        "generated_assessement": parsed_assessment,
        "status": "Generation complete!",
    }})

@server.route("/coursecontextfile", methods=["POST"])
def add_course_context_file():
    """Adds a file (worked solutions, a rubric, graded work...) to the context of a class.

    The file is turned into text once, here, so the AI never has to look at the file itself again."""
    request_state = clerk_client.authenticate_request(request, AuthenticateRequestOptions(authorized_parties=["http://frontend:3000", "http://localhost:3000", os.environ.get("FRONTEND_URL")]))
    if request_state.is_signed_in != True:
        return jsonify({"error": request_state.reason}), 401
    course = get_course(request.form.get("courseId"))
    if not course or course.get("user_id") != request_state.payload.get("sub"):
        return jsonify({"error": "Course not found"}), 404

    uploaded_file = request.files.get("file")
    if not uploaded_file or not uploaded_file.filename:
        return jsonify({"error": "No file uploaded"}), 400
    try:
        documents_text, images_base64_encoded = files_to_message_content([uploaded_file])
    except UnreadableFile as exception:
        return jsonify({"error": str(exception)}), 400
    if not documents_text and not images_base64_encoded:
        return jsonify({"error": "Nothing could be read from this file"}), 400

    completion = chatgpt_client.chat.completions.create(
        model="gpt-5.6-luna",
        reasoning_effort="medium",
        response_format={"type": "json_object"},
        messages=[
            {
                "role": "system",
                "content": """A student uploaded this file as context for one of their classes. It may be worked solutions, graded work, a rubric, a syllabus, or anything else that shows how the class works and what the professor expects.
                Turn it into text, so it can be used from now on without the file. Return a JSON object with:

                - "content" (string): a faithful text version of the whole file. Transcribe everything in it, in order, including problem statements, every step of the solutions, and every written explanation, in the wording of the file. Write math as LaTeX inside $...$. Describe figures and drawings in words. Dont add solutions, comments or corrections of your own.
                - "summary" (string): 150 words at most. What this file shows about how answers in this class must be written to get full credit: the structure of a full answer, the steps and justifications that are expected, how much has to be explained in words, notation, units, rounding. Write it as instructions to a grader, specific enough to tell a full answer from an incomplete one. Only say what the file actually shows. If it shows nothing about how answers should be written, say in one sentence what the file contains.

                Return only the JSON object.
                """
            },
            {"role": "user", "content": [*documents_text, *images_base64_encoded]},
        ],
    )
    try:
        parsed_file = json.loads(completion.choices[0].message.content)
    except json.JSONDecodeError:
        return jsonify({"error": "Could not read this file, try again"}), 502

    context_file = {
        "id": str(uuid.uuid4()),
        "name": uploaded_file.filename,
        "content": str(parsed_file.get("content") or "")[:MAX_CONTEXT_FILE_CHARACTERS],
        "summary": str(parsed_file.get("summary") or ""),
    }
    # read the course again: turning the file into text takes a while and other files may have been added meanwhile
    course = get_course(course["id"]) or course
    context_files = [*(course.get("context_files") or []), context_file]
    supabase.table("courses").update({"context_files": context_files}).eq("id", course["id"]).execute()
    return jsonify({"context_files": context_files})

@server.route("/checkwithai", methods=["POST"])
async def check_with_ai():
    # check if content type is form data then assume its a drawing question
    if request.form:
        question = json.loads(request.form.get("question"))
        drawing_image = request.form.get("answer")
        # how the class the question belongs to wants answers written
        class_expectations = class_expectations_for_grading(request.form.get("course_id"))
        # image is already base64 encoded, so we can just use it
        print(question)
        print(question["question"])
        # any question type can be answered with a drawing, so give the grader the choices too
        answer_choices = ""
        if question.get("question_type") == "MCQ" and question.get("answers"):
            answer_choices = "The answer choices are: " + json.dumps(question["answers"])
        elif question.get("question_type") == "BOOL":
            answer_choices = "This is a true or false question."
        messages = [
            {
                "role": "system",
                "content": f"""
                    You are an assessment grader.

                (answer/question might be in mathjax format)
                This is the question: {question["question"]}
                {answer_choices}
                The answer is the next message: an image of what the student drew or handwrote on a whiteboard.
                It may include their working; grade the final answer it shows (and how it is written, if the class below has expectations for that).

                {class_expectations}
                Provide a numerical response:
                - 1 if the answer is correct
                - 0 if the answer is incorrect

                if the answer is incorrect, provide a detailed explanation of why it is incorrect, not how to do it, just why it is incorrect.

                Response format (JSON only):
                {{
                    "explanation": (string), # explanation of why it is incorrect, not how to do it, just why it is incorrect.
                    "feedback": (string), # OPTIONAL note shown to the student in their tutor chat. Write one only when the answer is incorrect AND you can point at the specific step, mistake or misconception where they went wrong. One to three sentences, addressed to the student, saying where it went wrong without giving away the correct answer. Markdown, with math as $...$. Use "" when the answer is correct or there is nothing specific to point at (for example a wrong choice with no working shown).
                    "correct": (1 or 0) # 1 if the answer is correct, 0 if the answer is incorrect
                }}

                Only return valid JSON. Do not include explanations or extra text, no commas NOTHING literally just the json.
            """
            },
            {
                "role": "user",
                "content": [{"type": "image_url", "image_url": {"url": drawing_image}}]
            }
        ]

        completion_0 = chatgpt_client.chat.completions.create(
            model="gpt-5.6-luna",
            reasoning_effort="xhigh",
            response_format={"type": "json_object"},
            messages=messages
        )

        print("top function ran")

    else:
        user_input = request.get_json()
        print(user_input)
        # how the class the question belongs to wants answers written
        class_expectations = class_expectations_for_grading(user_input.get("course_id"))
        messages = [
            {
            "role": "system",
            "content": f"""
                You are an assessment grader. Return Python code only when needed—i.e., for numeric computations. Do not return code for symbolic or conceptual answers
                inside the code, NEVER check if the answer is correct or not, just print the calculated output.

                (answer/question might be in mathjax format)
                This is the question: {user_input["question"]["question"]}
                This is the answer given by the user: {user_input["answer"]}

                {class_expectations}
                Provide a numerical response:
                - 1 if the answer is correct
                - 0 if the answer is incorrect

                if the answer is incorrect, provide a detailed explanation of why it is incorrect, not how to do it, just why it is incorrect.

                Response format (JSON only):
                {{
                    "code": (string), # python code to check if the answer is correct, if python code is not needed, return ""
                    "explanation": (string), # explanation of why it is incorrect, not how to do it, just why it is incorrect.
                    "feedback": (string), # OPTIONAL note shown to the student in their tutor chat. Write one only when the answer is incorrect AND you can point at the specific step, mistake or misconception where they went wrong. One to three sentences, addressed to the student, saying where it went wrong without giving away the correct answer. Markdown, with math as $...$. Use "" when the answer is correct or there is nothing specific to point at (for example a wrong choice with no working shown).
                    "correct": (1 or 0) # 1 if the answer is correct, 0 if the answer is incorrect
                }}

                Only return valid JSON. Do not include explanations or extra text, no commas NOTHING literally just the json.
            """
            }
        ]

        completion_0 = chatgpt_client.chat.completions.create(
            model="gpt-5.6-luna",
            reasoning_effort="xhigh",
            response_format={"type": "json_object"},
            messages=messages
        )
        print("completion_0 ran")

        print("--------------------------------")
        print(user_input["question"]["question"])
        print(user_input["answer"])
        print("--------------------------------")

    try:
        parsed_response_0 = json.loads(completion_0.choices[0].message.content)  # Ensure the response is in proper JSON format
        if parsed_response_0.get("code"):
            print(parsed_response_0["code"])
            print("--------------------------------")

            temp_file = tempfile.NamedTemporaryFile(delete=False)
            temp_file.write(parsed_response_0["code"].encode("utf-8"))
            temp_file.flush()
            result = subprocess.run(["python", temp_file.name], capture_output=True, text=True, timeout=10)
            print(result.stdout)
            if(result.stderr != ""):
                return jsonify({"error": "Error running code"})

            messages.extend([
                {
                    "role": "assistant",
                    "content": parsed_response_0["code"]
                },
                {
                    "role": "system",
                    "content": f"""
                You are an assessment grader.

                (answer/question might be in mathjax format)
                Details:
                - Question: {user_input["question"]["question"]}
                - User Answer: {user_input["answer"]}
                - from code output: {result.stdout}

                Grading Criteria (based on subject):

                For Math:
                - Prioritize numerical accuracy.
                - Be lenient with rounding — allow the last decimal place to differ.
                - example: If the correct answer is 0.906, then 0.905, 0.90, 0.9 or 0.907 is acceptable, but 0.096  is not.

                For Science:    
                - Prioritize **significant figures**.
                - example: If the correct answer is 0.906, then 0.905 or 0.907 is acceptable, but 0.096 or 0.90, 0.9 is not.
                - For incorrect sig figs (e.g., 0.91 instead of 0.910) should result in an incorrect grade.

                For Text-based Subjects (History, English, etc.):
                - Focus on factual correctness and core ideas.
                - Varied phrasing is acceptable if the meaning is accurate.
                {class_expectations}
                Instructions:
                - Provide a **numerical grade**:
                - `1` if the answer is correct
                - `0` if the answer is incorrect
                - If the answer is incorrect, include an explanation of **why** it is incorrect — do not explain how to solve it.


                Response format (JSON only):
                {{
                    "explanation": (string), # explanation of why it is incorrect, not how to do it, just why it is incorrect.
                    "feedback": (string), # OPTIONAL note shown to the student in their tutor chat. Write one only when the answer is incorrect AND you can point at the specific step, mistake or misconception where they went wrong. One to three sentences, addressed to the student, saying where it went wrong without giving away the correct answer. Markdown, with math as $...$. Use "" when the answer is correct or there is nothing specific to point at (for example a wrong choice with no working shown).
                    "correct": (1 or 0) # 1 if the answer is correct, 0 if the answer is incorrect
                }}

                Only return valid JSON. Do not include explanations or extra text, no commas NOTHING literally just the json.
                """
                }
            ])

            print("------woah------")
            completion_1 = chatgpt_client.chat.completions.create(
                model="gpt-5.6-luna",
                reasoning_effort="xhigh",
                messages=messages,
            )
            messages.append(completion_1.choices[0].message.content)
            print(messages)
            parsed_response_1 = json.loads(completion_1.choices[0].message.content)
            return jsonify({"correct": parsed_response_1["correct"], "feedback": parsed_response_1.get("feedback") or ""})
        else:
            return jsonify({"correct": parsed_response_0["correct"], "feedback": parsed_response_0.get("feedback") or ""})
    except json.JSONDecodeError:
        return jsonify({"error": "Invalid JSON response from AI"})


@server.route("/explanation")
def explain_problem():
    problem = request.args.get("problem")
    # solutions are written the way the class wants them, using its example solutions
    class_context = course_context_text(get_course(request.args.get("course_id"))) if request.args.get("course_id") else ""
    class_context_instruction = ""
    if class_context:
        class_context_instruction = (
            "\n\nThis problem is from a class. Below is what the student has provided about it: notes, things to remember, "
            "and example material such as worked solutions. Write the solution the way this class expects answers to be "
            "written (the same structure, steps, level of justification and notation), so the student sees what a full-credit answer looks like."
            f"\n\n<class_context>\n{class_context}\n</class_context>"
        )

    def explanation_stream():
        stream = chatgpt_client.chat.completions.create(
            model="gpt-5.6-luna",
            reasoning_effort="xhigh",
            messages=[
                {"role": "system", "content": (
                    """You are an AI assistant providing educational explanations.

                    Format your response in Markdown, with short paragraphs and numbered steps.

                    For math expressions, use the following format:
                    - For inline math: $1.45 \\times 10^{-2}$
                    - For display math: $$1.45 \\times 10^{-2}$$

                    If the problem is one part of a multi-part question, explain only the part to answer now.
                    Use the shared context and build on the earlier parts and the student's answers to them
                    instead of re-solving them, but point it out if an earlier answer is wrong and this part depends on it.
                    """
                    + class_context_instruction
                )},
                {"role": "user", "content": f"""Explain how to solve this problem in detail:\n\n{problem}
                """}
            ],
            stream=True
        )

        for chunk in stream:
            if chunk.choices[0].delta.content is not None:
                # JSON-encode so newlines in the chunk don't break SSE framing
                yield f"data: {json.dumps(chunk.choices[0].delta.content)}\n\n"
        
        yield "data: [DONE]\n\n"

    return Response(explanation_stream(), mimetype="text/event-stream")

@server.route("/explain_wrong_answer")
def explain_wrong_answer():
    question = request.args.get("question")
    answer = request.args.get("answer")

    def explanation_stream():
        stream = chatgpt_client.chat.completions.create(
            model="gpt-5.6-luna",
            messages=[
                {"role": "system", "content": (
                    """You are an AI assistant providing educational explanations. Your task is to explain why a given answer to a question is incorrect.
                    
                    Format your response like this:
                    - Use HTML formatting for clarity and readability
                    - Start with a brief explanation of why the answer is wrong
                    - Explain the correct approach to solve the problem
                    - Provide the correct answer
                    - Include relevant formulas with proper mathematical notation
                    - End with a summary of key concepts
                    
                    use a <br><br> tag at the beginning of your response to separate it from the previous messages
                    
                    Use <b>bold text</b> for important concepts, <i>italics</i> for emphasis, and <code>code blocks</code> for equations or code.
                    Use <br> for line breaks and <hr> for section dividers.
                    Make your explanation thorough but accessible to students.
                    Be encouraging and helpful in your explanation.
                    """
                )},
                {"role": "user", "content": f"Question: {question}\n\nGiven answer: {answer}\n\nExplain why this answer is incorrect and provide the correct solution."}
            ],
            stream=True
        )

        for chunk in stream:
            if chunk.choices[0].delta.content is not None:
                # JSON-encode so newlines in the chunk don't break SSE framing
                yield f"data: {json.dumps(chunk.choices[0].delta.content)}\n\n"
        
        yield "data: [DONE]\n\n"

    return Response(explanation_stream(), mimetype="text/event-stream")

@server.route("/ask")
def ask_ai():
    messages_json = request.args.get("messages")
    
    if not messages_json:
        return jsonify({"error": "No messages provided"}), 400
    
    try:
        # Parse the JSON string directly
        messages = json.loads(messages_json)
        
        system_message = {
            "role": "system",
            "content": """
            You are a tutor chatting with a student while they practice. Help them get to the answer themselves.

            - Respond to what the student actually said. A greeting or small talk gets a short, friendly reply and an offer to help, not a walkthrough of the question.
            - Do not solve the question or state its answer unless the student clearly asks for the full solution or the answer.
            - When they ask for help, give the smallest useful nudge: a hint, the next step, or a question that points them at it. Then let them try.
            - If they show their work or a wrong answer, point at where it went wrong rather than redoing the whole problem.
            - Keep replies short.

            Format your response in Markdown, with short paragraphs and numbered steps where helpful.

            For math expressions, use the following format:
            - For inline math: $1.45 \\times 10^{-2}$
            - For display math: $$1.45 \\times 10^{-2}$$
            """
        }
        question_context = request.args.get("context")
        if question_context:
            system_message["content"] += (
                "\nThe student is working on the question below. Their answers so far are included."
                "\n\n" + question_context
            )
        # the class the question belongs to: what is known about it, and a way to remember more
        course_id = request.args.get("course_id")
        course = get_course(course_id) if course_id else None
        if course:
            class_context = course_context_text(course, brief=True)
            if class_context:
                system_message["content"] += (
                    "\n\nThe question is from a class. This is what the student has provided about it. Follow it when you help, "
                    "for example by explaining things the way the professor expects answers to be written."
                    f"\n\n<class_context>\n{class_context}\n</class_context>"
                )
            system_message["content"] += (
                "\n\nYou can remember things about this class with the remember_for_class tool. Use it when the student tells you "
                "something lasting about the class: how the professor wants answers written, what kinds of questions the professor asks, "
                "what they take points off for, notation, units or rounding rules. Save one short note per fact, then go on and reply "
                "to the student as usual, mentioning in a few words that you will remember it for this class. "
                "Dont save things that are only about the current question, things that are already in the class context, or guesses of your own."
            )
        messages.insert(0, system_message)
        print(messages)
    except Exception as e:
        return jsonify({"error": f"Invalid messages format: {str(e)}"}), 400

    def response_stream():
        # the model may save to the class memory first and then reply, which takes another round
        for _ in range(3):
            stream = chatgpt_client.chat.completions.create(
                model="gpt-5.6-luna",
                messages=messages,
                stream=True,
                **({"tools": [REMEMBER_FOR_CLASS_TOOL]} if course else {})
            )

            reply = ""
            tool_calls = {} # the calls arrive in pieces, keyed by their index
            for chunk in stream:
                if not chunk.choices:
                    continue
                delta = chunk.choices[0].delta
                if delta.content is not None:
                    reply += delta.content
                    # JSON-encode so newlines in the chunk don't break SSE framing
                    yield f"data: {json.dumps(delta.content)}\n\n"
                for piece in delta.tool_calls or []:
                    tool_call = tool_calls.setdefault(piece.index, {"id": "", "name": "", "arguments": ""})
                    if piece.id:
                        tool_call["id"] = piece.id
                    if piece.function and piece.function.name:
                        tool_call["name"] = piece.function.name
                    if piece.function and piece.function.arguments:
                        tool_call["arguments"] += piece.function.arguments

            if not tool_calls:
                break

            messages.append({
                "role": "assistant",
                "content": reply or None,
                "tool_calls": [
                    {"id": tool_call["id"], "type": "function", "function": {"name": tool_call["name"], "arguments": tool_call["arguments"]}}
                    for tool_call in tool_calls.values()
                ],
            })
            for tool_call in tool_calls.values():
                result = "Could not save this."
                if tool_call["name"] == "remember_for_class":
                    try:
                        result = add_course_memory(course["id"], json.loads(tool_call["arguments"]).get("memory"))
                    except Exception as exception:
                        print(f"Could not save class memory: {exception}")
                messages.append({"role": "tool", "tool_call_id": tool_call["id"], "content": result})
            if reply:
                # keep what comes next apart from what was already said
                yield f"data: {json.dumps(chr(10) + chr(10))}\n\n"

        yield "data: [DONE]\n\n"
    
    return Response(response_stream(), mimetype="text/event-stream")

@server.route("/get_youtube_video_suggestions", methods=["POST"])
def get_youtube_video_suggestions():
    # youtube blocks client side requests, so we need to make it server side
    question = request.get_json()
    response = requests.post("https://www.youtube.com/youtubei/v1/search?prettyPrint=false", json={
        "context": {
            "client": {
                "hl": "en",
                "gl": "US",
                "clientName": "WEB",
                "clientVersion": "2.20250430.01.00",
                "originalUrl": f"https://www.youtube.com/results?search_query={question['question']['question']} organic chemistry tutor"
            },
            "request": {
                "useSsl": True
            }
        },
        "query": question["question"]["question"] + " organic chemistry tutor"
    })

    return jsonify(response.json())

if __name__ == "__main__":
    server.run(host="0.0.0.0", port=8000, threaded=True, debug=True)
