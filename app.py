#!/$HOME/.local/share/pipx/venvs/flask/bin/python3

#import request 
from flask import Flask#, render_template, jsonify

server = Flask(__name__)

@server.route('/')
def index():
    return "balls"

server.run(host="0.0.0.0", port=3000)
#def home():
#    return render_template('index.html')

#if __name__ == '__main__':
#    server.run(debug=True)

