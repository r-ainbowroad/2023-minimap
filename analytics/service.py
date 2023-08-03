import flask
import json
import datetime
import pg8000.native

app = flask.Flask(__name__)

class database:
    def __init__(self):
        self.db = pg8000.native.Connection(
            user="writer",
            host="host",
            database="ponyplace_analytics",
            password="lol",
            ssl_context=True)

    def logPixel(self, timestamp, template, json):
        self.db.run(
            "INSERT INTO placements(timestamp, template, json) VALUES (:timestamp, :template, :json);",
            timestamp = timestamp,
            template = template,
            json = json,
        )

    def logOther(self, timestamp, event, json):
        self.db.run(
                "INSERT INTO others(timestamp, event, json) VALUES (:timestamp, :event, :json);",
            timestamp = timestamp,
            event = event,
            json = json,
        )

db = database()


@app.post("/placepixel")
def placepixel():
    body = flask.request.get_json()

    if not "timestamp" in body:
        return ("", 400)
    if not "event" in body:
        return ("", 400)

    timestamp = datetime.datetime.fromtimestamp(body["timestamp"])
    event = body["event"]

    if event == "pixel":
        template = ""
        if "template" in body:
            template = body["template"]

        db.logPixel(str(timestamp), template, json.dumps(body))
        return ("", 200)
    else:
        db.logOther(str(timestamp), event, json.dumps(body))
        return ("", 200)


class StripPrefix:
    def __init__(self, app, target):
        self.target = target
        self.app = app
    def __call__(self, env, resp):
        if (env["PATH_INFO"].startswith(self.target)):
            env["PATH_INFO"] = env["PATH_INFO"][len(self.target):]
        return self.app(env,resp)

class ExceptionWrapper:
    def __init__(self, app):
        self.app = app
    def __call__(self, env, resp):
        try:
            return self.app(env,resp)
        except:
            print(traceback.format_exc(),file=sys.stderr)
            # we're in raw WSGI territory here
            resp("500 Internal Server Error",[("content-type", "text/html")])
            return [
b"""<!DOCTYPE HTML PUBLIC "-//W3C//DTD HTML 4.01//EN" "http://www.w3.org/TR/html4/strict.dtd">
<html>
<head>
<meta http-equiv="Content-Type" content="text/html;charset=utf-8">
<title>500 Internal Server Error</title>
<body><h1>500 Internal Server Error</h1></body>
</html>"""
]

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=8080)
else:
    application = ExceptionWrapper(StripPrefix(app, "/analytics"))
