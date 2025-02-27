#!/usr/bin/env python3

# Docs: https://platform.openai.com/docs/guides/structured-outputs
# Additional resources: https://github.com/OthersideAI/chronology

from flask import Flask, jsonify
from openai import OpenAI
from dotenv import load_dotenv
import request

# Load environment variables
load_dotenv()

# Initialize OpenAI client
chatgpt_client = OpenAI()

server = Flask(__name__)

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
    response = send_openai_chat("give me a louis dot structure of H2O (water)")
    return jsonify(response)
    #return jsonify({"message": "server is running"})

if __name__ == "__main__":
    server.run(host="0.0.0.0", port=8000, debug=True)
