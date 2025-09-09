import json, time
from websocket import WebSocketApp

class WSClient:
    def __init__(self, url: str, on_message):
        self.url = url
        self.on_message = on_message

    def run(self, reconnect_seconds: int = 5):
        while True:
            ws = WebSocketApp(self.url, on_message=lambda ws, msg: self.on_message(json.loads(msg)))
            try:
                ws.run_forever()
            except Exception:
                pass
            time.sleep(reconnect_seconds)