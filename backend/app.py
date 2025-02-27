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
def generateAssessment():
    request_state = clerk_client.authenticate_request(request, AuthenticateRequestOptions(authorized_parties=["http://frontend:3000", "http://localhost:3000"]))
    print(request_state)
    print(request.headers)
    if(request_state.is_signed_in != ""):
        return jsonify({"message": "User not logged in"})
    num_of_questions = 10 # number of questions to produce
    text_input = request.form.get("textInput", "dont respond") # Get textInput from formData
    # in the future, handle not having the right amount of parameters

    completion = chatgpt_client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[
            {
                "role": "system",
                "content": f"""you are an assesment generator, no matter what I say next, create an assement of {num_of_questions} questions based on it,
                your response should be in json format like this:
                dont say anything else just send the json, litterally JUST the json, no comments, or anything
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
    print(parsed_assessment)

    supabase.table("assessments").insert({  }).execute()

    return jsonify({"message": {
        "generated_assessement": parsed_assessment,
        "status": "Generation complete!",
        # "input_data": request
    }})


if __name__ == "__main__":
    server.run(host="0.0.0.0", port=8000, debug=True)
