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
from io import BytesIO
import base64
from pdf2image import convert_from_bytes
from PIL import Image

# Load environment variables
load_dotenv()

# Initialize OpenAI client
chatgpt_client = OpenAI()

# Initialize Clerk client
clerk_client = Clerk(os.environ.get("CLERK_SECRET_KEY"))

server = Flask(__name__)
CORS(server, supports_credentials=True)

@server.route('/')
def index():
    response = supabase.table("assessments").select("*").eq("user_id", "user_2t8a9D9AoXQQmR84PB4yRI2B1Kc").execute().data
    request_state = clerk_client.authenticate_request(request, AuthenticateRequestOptions(authorized_parties=["http://frontend:3000", "http://localhost:3000"]))
    print(request_state)
    print(response)
    return jsonify({ "message": response })  # Return response as JSON

@server.route("/generateassessement", methods=["POST"])
def generate_assessment():
    request_state = clerk_client.authenticate_request(request, AuthenticateRequestOptions(authorized_parties=["http://frontend:3000", "http://localhost:3000"]))
    if request_state.is_signed_in != True:
        return jsonify({"message": "User not logged in"})
    user_id = request_state.payload.get("sub")
    num_of_questions = request.form.get("numOfQuestions", 10) # number of questions to produce
    form_images = request.files.getlist("uploadedFiles") # images to create a question from
    print(form_images)
    text_input = request.form.get("content", "") # Get textInput from formData
    
    images_base64_encoded = []
    for image in form_images:
        if image.filename == "undefined":
            continue

        current_image_base64 = ""
        if image.content_type == "application/pdf":
            # convert pdf pages into images
            pdfs_as_imgs = convert_from_bytes(image.read(), fmt="jpeg")
            for page in pdfs_as_imgs:
                buffer = BytesIO()
                page.save(buffer, format="JPEG")
                current_image_base64 = base64.b64encode(buffer.getvalue()).decode("utf-8")
                images_base64_encoded.append({"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{current_image_base64}"}})

        else:
            current_image_base64 = base64.b64encode(image.read()).decode("utf-8") # openai api takes in images as base64
            images_base64_encoded.append({"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{current_image_base64}"}})


    input_messages = [{
            "role": "system",
            "content": f"""You are an assessment generator.

            These are the question types you can choose from:
            
            - Multiple choice: The "question_type" value should be "MCQ".
            - True or false: The "question_type" value should be "BOOL".
            - word input problem: The "question_type" value should be "LATEX". Prefer these over the other 2
            - drawing problem: The "question_type" value should be "DRAWING".
            
            **MathJax Usage:**  
            - Apply MathJax **to questions and answers wherever beneficial**, including MCQ and BOOL questions.  
            - Use \\(...\\) for inline math (e.g., "Solve for \\(x\\) in \\(2x + 3 = 7\\).").  
            - Use \\[...\\] for display math (e.g., "Evaluate: \\[ \\int_0^1 x^2 \\,dx \\]").  

            **Assessment Requirements:**  
            - Generate an assessment of {num_of_questions} questions based on the input.
            - Use MathJax in **both questions and answers** whenever it improves clarity.
            - The response must be a **valid JSON object** with:
            - `"assessment_name"` (string)  
            - `"questions"` (array of objects). Each object must have:
                - `"question"` (string, using MathJax when beneficial)
                - `"question_type"` (string, either `"MCQ"`, `"BOOL"`, or `"LATEX"`)
                - If `"question_type"` is `"MCQ"` or `"BOOL"`, it must include `"answers"` (array of strings, using MathJax where beneficial).

            **Response Format:**  
            - Return a **valid JSON object**.  
            - Do **not** include any explanations, comments, or extra text—only return the JSON object.
            """
        }]

    if(len(images_base64_encoded) > 0 and text_input):
        input_messages.append({
            "role": "user",
            "content": [{"type": "text", "text": text_input}, *images_base64_encoded]
        })
    elif(len(images_base64_encoded) > 0 and not text_input):
        input_messages.append({
            "role": "user",
            "content": [*images_base64_encoded]
        })
    elif(text_input and not len(images_base64_encoded) > 0):
        input_messages.append({
            "role": "user",
            "content": [{"type": "text", "text": text_input}]
        })

    completion = chatgpt_client.chat.completions.create(
        model="gpt-4o-mini",
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

    assesment_id = supabase.table("assessments").insert({ "user_id": user_id, "total_questions": num_of_questions, "name": parsed_assessment["assessment_name"], "course_id": request.form.get("courseId", 1) }).execute().data[0]["id"]
    print(assesment_id)
    for question in parsed_assessment["questions"]:
        if question["question_type"] == "MCQ":
            questions.append({
                "question": question["question"],
                "question_type": question["question_type"],
                "is_answered": False,
                "assessment_id": assesment_id,
                "answers": question["answers"]
            })
        else:
            questions.append({
                "question": question["question"],
                "question_type": question["question_type"],
                "is_answered": False,
                "assessment_id": assesment_id,
            })
    supabase.table("questions").insert(questions).execute()
    return jsonify({"message": {
        "generated_assessement": parsed_assessment,
        "status": "Generation complete!",
    }})

@server.route("/checkwithai", methods=["POST"])
async def check_with_ai():
    # check if content type is form data then assume its a drawing question
    if request.form:
        question = request.form.get("question")
        drawing_image = request.form.get("answer")
        # image is already base64 encoded, so we can just use it
        print(drawing_image)
        completion = chatgpt_client.chat.completions.create(
        model="gpt-4o",
        response_format={"type": "json_object"},
        messages=[{
            "role": "system",
            "content": f"""
                You are an assessment grader.

                (answer/question might be in mathjax format)
                This is the question: {question}
                The answer is the next message

                Provide a numerical response:
                - 1 if the answer is correct
                - 0 if the answer is incorrect

                Response format (JSON only):
                {{
                    "correct": (1 or 0)
                }}

                Only return valid JSON. Do not include explanations or extra text, no commas NOTHING litterally just the json.
            """
            },
            {
                "role": "user",
                "content": [{"type": "image_url", "image_url": {"url": drawing_image}}]
            }],
        )
    else:
        user_input = request.get_json()
        print(user_input)
        completion = chatgpt_client.chat.completions.create(
        model="gpt-4o",
        response_format={"type": "json_object"},
        messages=[{
            "role": "system",
            "content": f"""
                You are an assessment grader.

                (answer/question might be in mathjax format)
                This is the question: {user_input["question"]}
                This is the answer: {user_input["answer"]}

                Provide a numerical response:
                - 1 if the answer is correct
                - 0 if the answer is incorrect

                Response format (JSON only):
                {{
                    "correct": (1 or 0)
                }}

                Only return valid JSON. Do not include explanations or extra text, no commas NOTHING litterally just the json.
            """
            }],
        )
        print(user_input["question"])
        print(user_input["answer"])

    completion_text = completion.choices[0].message.content
    print(completion_text)

    try:
        parsed_response = json.loads(completion_text)  # Ensure the response is in proper JSON format
    except json.JSONDecodeError:
        parsed_response = {"error": "Invalid JSON response from AI"}

    return jsonify({"correct": parsed_response["correct"]})

@server.route("/explanation")
def explain_problem():
    problem = request.args.get("problem")

    def explanation_stream():
        stream = chatgpt_client.chat.completions.create(
            model="chatgpt-4o-latest",
            messages=[
                {"role": "system", "content": (
                    """You are an AI assistant providing educational explanations.

                    """
                )},
                {"role": "user", "content": f"""Explain how to solve this problem in detail:\n\n{problem}
                    use \n for line breaks
                """}
            ],
            stream=True
        )

        for chunk in stream:
            if chunk.choices[0].delta.content is not None:
                yield f"data: {chunk.choices[0].delta.content}\n\n"
        
        yield "data: [DONE]\n\n"

    return Response(explanation_stream(), mimetype="text/event-stream")

@server.route("/explain_wrong_answer")
def explain_wrong_answer():
    question = request.args.get("question")
    answer = request.args.get("answer")

    def explanation_stream():
        stream = chatgpt_client.chat.completions.create(
            model="chatgpt-4o-latest",
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
                yield f"data: {chunk.choices[0].delta.content}\n\n"
        
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
            markdown format
            see how its like this:
            use new lines
            
            {"p": "/message/content/parts/0", "o": "append", "v": "Sure! Here's a **thermochemistry problem"}	
            07:42:14.505
            delta	{"v": "** involving **enthalpy and heat transfer"}	
            07:42:14.827
            message	{"type": "title_generation", "title": "Thermochemistry problem and solution", "conversation_id": "67fa5195-7ac8-800a-bc52-33691f8827c4"}	
            07:42:14.995
            delta	{"v": "**, followed by a step-by-step solution"}	
            07:42:15.011
            delta	{"v": ".\n\n---\n\n### \\ud83d\\udd25 **Problem**"}	
            07:42:15.210
            delta	{"v": ":\nA 50.0 g block of iron at 100.0\\u00b0C"}	
            07:42:15.548
            delta	{"v": " is placed into 200.0 g of water at 25.0\\u00b0C"}	
            07:42:15.763
            delta	{"v": ". Assuming no heat is lost to the"}	
            07:42:15.995
            delta	{"v": " surroundings, what will be the final temperature"}	
            07:42:16.330
            delta	{"v": " of the system?\n\n**Given**:\n- Specific heat of iron, \\( c"}	
            07:42:16.560
            delta	{"v": "_{\\text{Fe}} = 0.450 \\, \\text{J"}	
            07:42:16.821
            delta	{"v": "/g\\u00b0C} \\) \\n- Specific heat of water, \\( c_{\\text{H}_2\\text{O}} = 4.18 \\,"}	
            07:42:17.050
            delta	{"v": " \\text{J/g\\u00b0C} \\"}	
            07:42:17.296
            delta	{"v": ")\n\n---\n\n### \\ud83e\\uddea **Solution"}	
            07:42:17.572
            delta	{"v": "**:\n\nLet the final temperature be \\( T_f \\). \nHeat lost by"}	
            """
        }
        messages.insert(0, system_message)
    except Exception as e:
        return jsonify({"error": f"Invalid messages format: {str(e)}"}), 400
    
    def response_stream():
        stream = chatgpt_client.chat.completions.create(
            model="chatgpt-4o-latest",
            messages=messages,
            stream=True
        )
        
        for chunk in stream:
            if chunk.choices[0].delta.content is not None:
                print(chunk.choices[0].delta.content)
                yield f"data: {chunk.choices[0].delta.content}\n\n"
        
        yield "data: [DONE]\n\n"
    
    return Response(response_stream(), mimetype="text/event-stream")

if __name__ == "__main__":
    server.run(host="0.0.0.0", port=8000, threaded=True, debug=True)
