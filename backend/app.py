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
client = OpenAI()

# Initialize Clerk client
clerk_client = Clerk(os.environ.get("CLERK_SECRET_KEY"))

# Initialize Flask app
server = Flask(__name__)
CORS(server, supports_credentials=True)

def send_openai_chat():
    completion = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[
            {"role": "system", "content": "You are a helpful math tutor. Guide the user through the solution step by step."},
            {"role": "user", "content": "How can I solve 8x + 7 = -23?"}
        ],
    )
    return completion.choices[0].message.content  # Extract the response content

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

    completion = client.chat.completions.create(
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
