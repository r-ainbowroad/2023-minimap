import json
import urllib.request
import datetime
import uuid

target = "http://ponyplace-compute.ferrictorus.com/analytics/placepixel"
headers = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/113.0",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
    "Content-Type": "application/json",
}

data = {
    "id": str(uuid.uuid4()),
    "event": 'pixel',
    "type": 'manual',
    "pos": {
        "x": 405,
        "y": 700
    },
    "template": "mlp",
    "color": 0,
    "timestamp": int(datetime.datetime.now().timestamp()),
    "nextPixelPlace": int(datetime.datetime.now().timestamp()) + 30,
}

content = json.dumps(data)
print(content)

request = urllib.request.Request(target, data = content.encode("utf-8"), headers = headers, method = "POST")
responseObject = urllib.request.urlopen(request, timeout=5)