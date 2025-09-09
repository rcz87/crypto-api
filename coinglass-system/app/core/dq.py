import json
from typing import Any, Dict
from app.core.cache import redis_client

class DataQueue:
    def __init__(self, queue_name: str):
        self.queue_name = queue_name

    def push(self, data: Dict[str, Any]):
        redis_client.lpush(self.queue_name, json.dumps(data))

    def pop(self) -> Dict[str, Any] | None:
        result = redis_client.brpop(self.queue_name, timeout=1)
        if result:
            return json.loads(result[1])
        return None

    def size(self) -> int:
        return redis_client.llen(self.queue_name)

    def clear(self):
        redis_client.delete(self.queue_name)