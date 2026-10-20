import openai
from openai import OpenAI

from app.core.exceptions import AIProviderError
from app.llm.llm_service import LLMService
from app.models.models.llm_response import LLMResponse


def describe_openai_error(error: openai.OpenAIError) -> str:
    """User-safe message; provider error text can echo parts of the API key."""
    if isinstance(error, openai.AuthenticationError):
        return "The AI provider rejected the API key."
    if isinstance(error, openai.RateLimitError):
        return "The AI provider rate limit or quota was reached. Try again shortly."
    if isinstance(error, (openai.APIConnectionError, openai.APITimeoutError)):
        return "The AI provider could not be reached."
    return "The AI provider returned an error."


class OpenAILLMService(LLMService):
    def __init__(self, client: OpenAI, model: str):
        self._client = client
        self._model = model

    def generate(self, prompt: str) -> LLMResponse:
        try:
            response = self._client.responses.create(
                model=self._model,
                input=prompt,
            )
        except openai.OpenAIError as e:
            raise AIProviderError(describe_openai_error(e)) from e
        return LLMResponse(text=response.output_text)
