"""OPENAI_BASE_URL decides which provider the client talks to (OpenAI by default, OpenRouter etc. on request)."""
import pytest

from app.core.config import settings
from app.dependencies.services import get_openai_client


@pytest.fixture(autouse=True)
def fresh_client_cache():
    get_openai_client.cache_clear()
    yield
    get_openai_client.cache_clear()


def test_defaults_to_openai(monkeypatch):
    monkeypatch.setattr(settings, "OPENAI_BASE_URL", None)
    assert str(get_openai_client().base_url).startswith("https://api.openai.com/")


def test_empty_string_means_default_too(monkeypatch):
    # A blank value in .env or the host's dashboard shouldn't break the client.
    monkeypatch.setattr(settings, "OPENAI_BASE_URL", "")
    assert str(get_openai_client().base_url).startswith("https://api.openai.com/")


def test_can_point_at_openrouter(monkeypatch):
    monkeypatch.setattr(settings, "OPENAI_BASE_URL", "https://openrouter.ai/api/v1")
    monkeypatch.setattr(settings, "OPENAI_API_KEY", "sk-or-test")
    client = get_openai_client()
    assert str(client.base_url).rstrip("/") == "https://openrouter.ai/api/v1"
    assert client.api_key == "sk-or-test"
