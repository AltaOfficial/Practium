#!/$HOME/.local/share/pipx/venvs/flask/bin/python3

# docs: https://platform.openai.com/docs/guides/structured-outputs
# this might also be useful but idk: https://github.com/OthersideAI/chronology

from flask import Flask, jsonify
import request 
from openai import OpenAI
from Pydantic import BaseModel



# ----all of this was copied from the docs----
client = OpenAI()

class Step(BaseModel):
    explanation: str
    output: str

class MathReasoning(BaseModel):
    steps: list[Step]
    final_answer: str

completion = client.beta.chat.completions.parse(
    model="gpt-4o-2024-08-06",
    messages=[
        {"role": "system", "content": "You are a helpful math tutor. Guide the user through the solution step by step."},
        {"role": "user", "content": "how can I solve 8x + 7 = -23"}
    ],
    response_format=MathReasoning,
)

math_reasoning = completion.choices[0].message.parsed
#------------
# the idea I have for above should look something like this
# where for a step by step solution do this
#    messages=[
#        {"role": "system", "content": "You are a tutor. Guide the user through the solution step by step."},
#        {"role": "user", "content": "<image>, &context"}
#    ],
#
# to check if the users answer is correct
#    messages=[
#        {"role": "system", "content": "You are a tutor. check to see if the users anwser is correct."},
#        {"role": "user", "content": "<image>, &context"}
#    ],
# adding a image isn't nesseasry

# future thing with ui, add options for users to type in math equations, like the sqrt of something


#openai.api_key='key' # place key here

server = Flask(__name__)

@server.route('/')
def index():
    return "this is the AI Homework Helper!"

#@server.route('/output', methods=['POST'])
#def output():
    #image = Image.open()

server.run(host="0.0.0.0", port=3000)

if __name__ == '__main__':
    server.run(debug=True)

