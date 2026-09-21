import base64
import logging
from typing import Any, TypeVar

from langchain_core.documents import Document
from langchain_core.messages import HumanMessage, SystemMessage
from langchain_openai import ChatOpenAI, OpenAIEmbeddings
from langchain_pinecone import PineconeVectorStore
from pydantic import BaseModel

from patch_ai.api.budget import remaining_seconds
from patch_ai.config import Settings
from patch_ai.observability import log_event, stage

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
        images: tuple[bytes, ...] = (),
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
        if len(images) > 4 or any(not image or len(image) > 2_000_000 for image in images):
            raise ValueError("VISUAL_MODEL_INPUT_LIMIT")
        content: list[str | dict[str, Any]] = [{"type": "text", "text": data}]
        for image in images:
            content.append(
                {
                    "type": "image_url",
                    "image_url": {
                        "url": "data:image/png;base64," + base64.b64encode(image).decode("ascii"),
                        "detail": "high",
                    },
                }
            )
        with stage(
            "model",
            outputSchema=schema.__name__,
            routing=routing,
            imageCount=len(images),
            imageBytes=sum(map(len, images)),
            inputCharacters=len(system) + len(data),
        ):
            result = llm.with_structured_output(
                schema, method="json_schema", include_raw=True
            ).invoke(
                [SystemMessage(content=system), HumanMessage(content=content if images else data)],
                config={"callbacks": [], "metadata": {"workflow": "bounded-generation"}},
            )
        # Raw messages stay transient. Export only numeric usage, never content,
        # reasoning, URLs or provider errors. Units here are provider-reported tokens.
        if not isinstance(result, dict):
            raise ValueError("MODEL_RESPONSE_INVALID")
        usage = getattr(result.get("raw"), "usage_metadata", None) or {}
        log_event(
            logging.INFO,
            "patch_ai.model_usage",
            outputSchema=schema.__name__,
            inputUnits=usage.get("input_tokens"),
            outputUnits=usage.get("output_tokens"),
            cachedInputUnits=(usage.get("input_token_details") or {}).get("cache_read", 0),
        )
        if result.get("parsing_error") or result.get("parsed") is None:
            raise ValueError("MODEL_RESPONSE_INVALID")
        return schema.model_validate(result["parsed"])

    def store(self, *, visual: bool = False) -> PineconeVectorStore:
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
            namespace=self.settings.pinecone_visual_namespace
            if visual
            else self.settings.pinecone_namespace,
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

    def visual_upsert(self, document: Document, vector_id: str) -> None:
        with stage("visual_vector_upsert", recordCount=1):
            # Pinecone rejects a dimension mismatch before accepting the vector.
            self.store(visual=True).add_documents(
                [document], ids=[vector_id], async_req=False, timeout=remaining_seconds(30)
            )

    def visual_search(
        self, query: str, filters: dict[str, Any], count: int
    ) -> list[tuple[Document, float]]:
        if not filters.get("$and"):
            raise ValueError("FILTER_REQUIRED")
        with stage("visual_vector_query", candidateCount=count):
            return self.store(visual=True).similarity_search_with_score(
                query, k=count, filter=filters, timeout=remaining_seconds(15)
            )

    def visual_delete(self, filters: dict[str, Any]) -> None:
        if not filters.get("$and"):
            raise ValueError("FILTER_REQUIRED")
        self.store(visual=True).delete(filter=filters, timeout=remaining_seconds(30))
