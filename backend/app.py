#!/usr/bin/env python3

# Docs: https://platform.openai.com/docs/guides/structured-outputs
# Additional resources: https://github.com/OthersideAI/chronology

from flask import Flask, jsonify
from openai import OpenAI
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Initialize OpenAI client
client = OpenAI()

# Initialize Flask app
server = Flask(__name__)

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
    response = send_openai_chat()
    return jsonify({"message": response})  # Return response as JSON

if __name__ == "__main__":
    server.run(host="0.0.0.0", port=8000, debug=True)
