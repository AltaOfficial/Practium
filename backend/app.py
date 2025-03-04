#!/usr/bin/env python3

# Docs: https://platform.openai.com/docs/guides/structured-outputs
# Additional resources: https://github.com/OthersideAI/chronology

from flask import Flask, jsonify, request
from openai import OpenAI
from dotenv import load_dotenv
from flask_cors import CORS
import json
from client import supabase
from clerk_backend_api import Clerk
from clerk_backend_api.jwks_helpers import AuthenticateRequestOptions
import os
import asyncio

# Load environment variables
load_dotenv()

# Initialize OpenAI client
chatgpt_client = OpenAI()

# Initialize Clerk client
clerk_client = Clerk(os.environ.get("CLERK_SECRET_KEY"))

server = Flask(__name__)
CORS(server, supports_credentials=True)

def send_openai_chat(userInput):
    completion = chatgpt_client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[
            {"role": "system", "content": "You are a helpful tutor. Guide the user by creating 10 examples in latex form. Format the response with: question of the subjest, answer of the subject"},
            {"role": "user", "content": f"{userInput}"}
        ],
    )
    return completion.choices[0].message.content  # Extract the response content

# future thing with ui, add options for users to type in math equations, like the sqrt of something

@server.route('/user_init_response', methods=['POST'])
def user_init_response():
    #userInput = "give me a louis dot structure of H2O (water)" 

    # test with curl command
    # curl -X POST http://localhost:8000/user_init_response \ -H "Content-Type: application/json" \ -d '{"query": "Give me a Louis dot structure of H2O"}'
    user_input = request.get_json()
    if user_input is None or 'query' not in user_input:
        return jsonify({"error", "Not json"}), 400

    response = send_openai_chat(user_input)
    return jsonify({response}), 200
    

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
    if(request_state.is_signed_in != True):
        return jsonify({"message": "User not logged in"})
    user_id = request_state.payload.get("sub")
    num_of_questions = request.form.get("textInput", 10) # number of questions to produce
    text_input = request.form.get("textInput", "dont respond") # Get textInput from formData
    # in the future, handle not having the right amount of parameters

    completion = chatgpt_client.chat.completions.create(
        model="gpt-4o-mini",
        response_format={ "type": "json_object" },
        messages=[{
            "role": "system",
            "content": f"""You are an assessment generator.

            These are the question types you can choose from:
            
            - Multiple choice: The "question_type" value should be "MCQ".
            - True or false: The "question_type" value should be "BOOL".
            - Math problem requiring MathJax: The "question_type" value should be "LATEX". Use this type when MathJax improves readability.
            
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
        },
        {
            "role": "user",
            "content": text_input
        }])

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
        if(question["question_type"] == "MCQ"):
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

    completion_text = completion.choices[0].message.content
    print(completion_text)
    print(user_input["question"])
    print(user_input["answer"])

    try:
        parsed_response = json.loads(completion_text)  # Ensure the response is in proper JSON format
    except json.JSONDecodeError:
        parsed_response = {"error": "Invalid JSON response from AI"}

    return jsonify({"correct": parsed_response["correct"]})

if __name__ == "__main__":
    server.run(host="0.0.0.0", port=8000, debug=True)
