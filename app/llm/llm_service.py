from abc import ABC, abstractmethod
from app.models.models.llm_response import LLMResponse


class LLMService(ABC):

    @abstractmethod
    def generate(
        self,
        prompt: str
    ) -> LLMResponse:
        pass