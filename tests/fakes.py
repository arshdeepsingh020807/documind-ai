"""Offline stand-in for the OpenAI client: deterministic bag-of-words embeddings and a canned LLM."""
import hashlib
import re
from types import SimpleNamespace

import httpx
import numpy as np
import openai

DIMENSION = 1536


def _vector(text: str) -> list[float]:
    vec = np.zeros(DIMENSION, dtype=np.float32)
    for word in re.findall(r"[a-z0-9]+", text.lower()):
        bucket = int(hashlib.md5(word.encode()).hexdigest(), 16) % DIMENSION
        vec[bucket] += 1.0
    norm = np.linalg.norm(vec)
    if norm:
        vec /= norm
    return vec.tolist()


def _response(status: int) -> httpx.Response:
    return httpx.Response(status, request=httpx.Request("POST", "https://api.openai.test/v1/x"))


class FakeOpenAI:
    """Set `fail_with` to "auth", "rate_limit" or "connection" to make every call fail."""

    def __init__(self):
        self.fail_with: str | None = None
        self.embedding_calls: list[int] = []
        self.embeddings = SimpleNamespace(create=self._create_embeddings)
        self.responses = SimpleNamespace(create=self._create_response)

    def _maybe_fail(self):
        if self.fail_with == "auth":
            raise openai.AuthenticationError("bad key sk-secret", response=_response(401), body=None)
        if self.fail_with == "rate_limit":
            raise openai.RateLimitError("quota", response=_response(429), body=None)
        if self.fail_with == "connection":
            raise openai.APIConnectionError(request=httpx.Request("POST", "https://api.openai.test"))

    def _create_embeddings(self, model, input):
        self._maybe_fail()
        texts = [input] if isinstance(input, str) else list(input)
        self.embedding_calls.append(len(texts))
        # Reverse the order to prove callers sort by `index` rather than trusting arrival order.
        data = [SimpleNamespace(index=i, embedding=_vector(t)) for i, t in enumerate(texts)]
        return SimpleNamespace(data=list(reversed(data)))

    def _create_response(self, model, input):
        self._maybe_fail()
        question = input.rsplit("Question:\n", 1)[-1].split("\n\nAnswer:")[0].strip()
        # Cite the first passage, as the prompt instructs, so citation rendering gets exercised.
        cite = " [1]" if "\n[1]\n" in input else ""
        return SimpleNamespace(output_text=f"FAKE ANSWER to: {question}{cite}")
