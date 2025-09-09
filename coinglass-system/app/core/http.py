import time, random
import requests

DEFAULT_TIMEOUT = (5, 15)

class Http:
    def __init__(self, headers: dict):
        self.headers = headers

    def get(self, url: str, params: dict | None = None, retries: int = 5):
        backoff = 0.2
        for i in range(retries):
            try:
                r = requests.get(url, headers=self.headers, params=params, timeout=DEFAULT_TIMEOUT)
                if r.status_code == 429 or r.status_code >= 500:
                    raise RuntimeError(f"retryable status {r.status_code}")
                r.raise_for_status()
                return r
            except Exception:
                if i == retries - 1:
                    raise
                time.sleep(backoff + random.uniform(0, 0.2))
                backoff = min(backoff * 2, 3)