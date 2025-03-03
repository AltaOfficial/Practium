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

def generateQuiz(formData, request):
    print("hi")

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
async def generateAssessment():
    request_state = clerk_client.authenticate_request(request, AuthenticateRequestOptions(authorized_parties=["http://frontend:3000", "http://localhost:3000"]))
    if(request_state.is_signed_in != True):
        return jsonify({"message": "User not logged in"})
    user_id = request_state.payload.get("sub")
    num_of_questions = 10 # number of questions to produce
    text_input = request.form.get("textInput", "dont respond") # Get textInput from formData
    # in the future, handle not having the right amount of parameters

    completion = chatgpt_client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[
            {
                "role": "system",
                "content": f"""you are an assessment generator, 
                these are the question types you can choose from:
                multiple choice, question_type value should be called "MCQ"
                true or false, question_type value should be called "BOOL"
                problem that requires latex to show, only choose this if its a math problem or something of the sort, question_type value should be called "LATEX"
                
                no matter what I say next, create an assessment of {num_of_questions} questions based on it, 
                
                generate a name for the assessment with the key name being assessment_name,
                there should also be a "questions" array with each question in the format:
                
                "question": (question)
                "question_type": (question type)
                and if it is a true or false or multiple choice question include: "answers" : (array of answers)

                your response should be in json format
                dont say anything else just send the json, litterally JUST the json, no comments or anything
                """
            },
            {
                "role": "user",
                "content": text_input
            }],
    )

    completion_text = completion.choices[0].message.content
    try:
        parsed_assessment = json.loads(completion_text)  # Ensure the response is in proper JSON format
    except json.JSONDecodeError:
        parsed_assessment = {"error": "Invalid JSON response from AI"}

    
    print(completion_text)
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
        # "input_data": request
    }})

if __name__ == "__main__":
    server.run(host="0.0.0.0", port=8000, debug=True)
