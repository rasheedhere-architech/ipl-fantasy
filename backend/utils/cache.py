import time
from typing import Any, Optional

class SimpleCache:
    def __init__(self, default_ttl: int = 86400):
        self._cache = {}
        self._default_ttl = default_ttl

    def get(self, key: str) -> Optional[Any]:
        if key in self._cache:
            value, timestamp, ttl = self._cache[key]
            # Use specific TTL if provided, otherwise default
            effective_ttl = ttl if ttl is not None else self._default_ttl
            if time.time() - timestamp < effective_ttl:
                return value
            else:
                del self._cache[key]
        return None

    def set(self, key: str, value: Any, ttl: Optional[int] = None):
        self._cache[key] = (value, time.time(), ttl)

    def invalidate(self, key: str):
        if key in self._cache:
            del self._cache[key]
        # Handle wildcard invalidation for match leaderboards
        if key.endswith("*"):
            prefix = key[:-1]
            keys_to_del = [k for k in self._cache.keys() if k.startswith(prefix)]
            for k in keys_to_del:
                del self._cache[k]

    def clear(self):
        self._cache = {}

# Global instance for app-wide caching
backend_cache = SimpleCache(ttl=86400) # 24 hours
