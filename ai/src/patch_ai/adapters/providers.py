from typing import Any, TypeVar

from langchain_core.documents import Document
from langchain_openai import ChatOpenAI, OpenAIEmbeddings
from langchain_pinecone import PineconeVectorStore
from pydantic import BaseModel

from patch_ai.api.budget import remaining_seconds
from patch_ai.config import Settings
from patch_ai.observability import stage

Model = TypeVar("Model", bound=BaseModel)


class Providers:
    """Only maintained LangChain integrations; no direct OpenAI/Pinecone SDK calls."""

    def __init__(self, settings: Settings) -> None:
        self.settings = settings

    def model(
        self,
        schema: type[Model],
        system: str,
        data: str,
        *,
        routing: bool = False,
        complex_reasoning: bool = False,
    ) -> Model:
        settings = self.settings
        if complex_reasoning:
            model = settings.openai_complex_reasoning_model
            reasoning_effort = settings.openai_complex_reasoning_effort
        elif routing:
            model = settings.openai_routing_model
            reasoning_effort = settings.openai_routing_reasoning_effort
        else:
            model = settings.openai_answer_model
            reasoning_effort = settings.openai_answer_reasoning_effort
        llm = ChatOpenAI(
            model=model,
            api_key=settings.openai_api_key,
            reasoning_effort=reasoning_effort,
            max_completion_tokens=8192,
            timeout=remaining_seconds(min(settings.ai_service_request_timeout_seconds, 30)),
            max_retries=0,
        )
        with stage("model", outputSchema=schema.__name__, routing=routing):
            result = llm.with_structured_output(schema, method="json_schema").invoke(
                [("system", system), ("human", data)],
                config={"callbacks": [], "metadata": {"workflow": "bounded-generation"}},
            )
        return schema.model_validate(result)

    def store(self) -> PineconeVectorStore:
        embeddings = OpenAIEmbeddings(
            model=self.settings.openai_embedding_model,
            api_key=self.settings.openai_api_key,
            max_retries=0,
            timeout=remaining_seconds(30),
        )
        return PineconeVectorStore(
            index_name=self.settings.pinecone_index_name,
            embedding=embeddings,
            pinecone_api_key=self.settings.pinecone_api_key.get_secret_value(),
            namespace=self.settings.pinecone_namespace,
        )

    def upsert(self, documents: list[Document], ids: list[str]) -> None:
        with stage("vector_upsert", recordCount=len(ids)):
            if len(documents) != len(ids):
                raise ValueError("VECTOR_ID_COUNT_MISMATCH")
            for offset in range(0, len(ids), 64):
                remaining_seconds(30)
                self.store().add_documents(
                    documents[offset : offset + 64],
                    ids=ids[offset : offset + 64],
                    batch_size=64,
                    async_req=False,
                    timeout=remaining_seconds(30),
                )

    def search(
        self, query: str, filters: dict[str, Any], count: int
    ) -> list[tuple[Document, float]]:
        if not filters or not filters.get("$and"):
            raise ValueError("FILTER_REQUIRED")
        with stage("vector_query", candidateCount=count, filterClauseCount=len(filters["$and"])):
            return self.store().similarity_search_with_score(
                query, k=count, filter=filters, timeout=remaining_seconds(30)
            )

    def delete(self, filters: dict[str, Any]) -> None:
        if not filters.get("$and"):
            raise ValueError("FILTER_REQUIRED")
        with stage("vector_delete", filterClauseCount=len(filters["$and"])):
            self.store().delete(filter=filters, timeout=remaining_seconds(30))
