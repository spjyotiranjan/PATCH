from functools import lru_cache
from pathlib import Path
from typing import Literal

from pydantic import Field, SecretStr, ValidationError, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

_OPENAI_MODEL_ID_PATTERN = r"^[a-z0-9](?:[a-z0-9._:-]{0,253}[a-z0-9])?$"


def _is_configured(value: str) -> bool:
    normalized = value.strip()
    return bool(normalized) and not normalized.startswith("replace-with-")


class Settings(BaseSettings):
    """AI runtime settings. Secret values are never returned by status endpoints."""

    model_config = SettingsConfigDict(
        env_file=(
            Path(__file__).resolve().parents[2] / ".env",
            Path(__file__).resolve().parents[2] / ".env.local",
        ),
        env_file_encoding="utf-8",
        extra="ignore",
        case_sensitive=False,
    )

    app_env: str = Field(default="development", pattern=r"^[a-z0-9][a-z0-9_-]{0,62}$")
    host: str = "0.0.0.0"
    port: int = Field(default=8000, ge=1, le=65535)
    log_level: str = "INFO"
    service_name: str = "patch-ai"

    ai_service_shared_secret: SecretStr = SecretStr("")
    ai_service_request_max_skew_seconds: int = Field(default=300, ge=30, le=3600)
    ai_service_request_timeout_seconds: int = Field(default=90, ge=1, le=120)

    source_download_timeout_seconds: int = Field(default=30, ge=1, le=120)
    source_download_max_bytes: int = Field(default=52_428_800, ge=1)
    source_url_allowed_hosts: str = ""
    supported_document_mime_types: str = (
        "application/pdf,text/plain,text/markdown,"
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    )

    ocr_tesseract_cmd: str = ""
    ocr_languages: str = Field(default="eng", pattern=r"^[A-Za-z0-9_]+(?:\+[A-Za-z0-9_]+)*$")
    ocr_render_dpi: int = Field(default=200, ge=72, le=400)
    ocr_max_image_pixels: int = Field(default=30_000_000, ge=1_000_000, le=50_000_000)
    ocr_timeout_seconds: int = Field(default=15, ge=1, le=30)

    openai_api_key: SecretStr = SecretStr("")
    openai_answer_model: str = Field(default="gpt-5.6-terra", pattern=_OPENAI_MODEL_ID_PATTERN)
    openai_answer_reasoning_effort: Literal["low", "medium", "high"] = "medium"
    openai_routing_model: str = Field(default="gpt-5.6-luna", pattern=_OPENAI_MODEL_ID_PATTERN)
    openai_routing_reasoning_effort: Literal["low", "medium", "high"] = "low"
    openai_complex_reasoning_model: str = Field(
        default="gpt-5.6-terra", pattern=_OPENAI_MODEL_ID_PATTERN
    )
    openai_complex_reasoning_effort: Literal["low", "medium", "high"] = "high"
    openai_embedding_model: str = Field(
        default="text-embedding-3-large", pattern=_OPENAI_MODEL_ID_PATTERN
    )

    pinecone_api_key: SecretStr = SecretStr("")
    pinecone_index_name: str = ""
    pinecone_namespace: str = Field(
        default="development", pattern=r"^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$"
    )

    chunk_size_tokens: int = Field(default=700, ge=100, le=4000)
    chunk_overlap_tokens: int = Field(default=120, ge=0, le=1000)
    entity_profile_candidate_count: int = Field(default=8, ge=1, le=100)
    entity_routing_enabled: bool = False
    entity_routing_max_selected_scopes: int = Field(default=5, ge=1, le=50)
    entity_routing_min_score: float = Field(default=0.45, ge=0, le=1)
    structural_fallback_max_document_versions: int = Field(default=200, ge=1, le=1000)
    retrieval_candidate_count: int = Field(default=20, ge=1, le=200)
    rerank_result_count: int = Field(default=8, ge=1, le=100)
    max_answer_citations: int = Field(default=8, ge=1, le=50)
    maintenance_log_indexing_enabled: bool = False

    sentry_dsn: SecretStr = SecretStr("")
    sentry_environment: str = "development"
    otel_service_name: str = "patch-ai"
    otel_exporter_otlp_endpoint: str = ""

    @model_validator(mode="after")
    def validate_limits(self) -> "Settings":
        if self.chunk_overlap_tokens >= self.chunk_size_tokens:
            raise ValueError("Chunk overlap must be smaller than chunk size")
        if self.maintenance_log_indexing_enabled:
            raise ValueError("Maintenance-log evidence is not enabled by the acceptance policy")
        return self

    @property
    def allowed_source_hosts(self) -> frozenset[str]:
        return frozenset(
            host.strip().lower()
            for host in self.source_url_allowed_hosts.split(",")
            if host.strip()
        )

    @property
    def supported_mime_types(self) -> frozenset[str]:
        return frozenset(
            mime_type.strip().lower()
            for mime_type in self.supported_document_mime_types.split(",")
            if mime_type.strip()
        )

    def unavailable_services(self) -> list[str]:
        unavailable: list[str] = []
        shared_secret = self.ai_service_shared_secret.get_secret_value()
        if not _is_configured(shared_secret) or len(shared_secret) < 32:
            unavailable.append("service-authentication")
        if not self.allowed_source_hosts or any(
            host.startswith("replace-with-") for host in self.allowed_source_hosts
        ):
            unavailable.append("source-download")
        if not _is_configured(self.openai_api_key.get_secret_value()):
            unavailable.append("openai")
        if not _is_configured(self.pinecone_api_key.get_secret_value()) or not _is_configured(
            self.pinecone_index_name
        ):
            unavailable.append("pinecone")
        return unavailable

    def is_ready(self) -> bool:
        return not self.unavailable_services()


@lru_cache
def get_settings() -> Settings:
    try:
        return Settings()
    except ValidationError:
        raise RuntimeError("AI configuration is invalid. Consult the setup guide.") from None
