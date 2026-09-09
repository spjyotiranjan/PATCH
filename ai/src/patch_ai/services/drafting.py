import hashlib
import json
from typing import Literal, TypedDict

from langchain_core.documents import Document
from langchain_core.runnables import RunnableLambda
from langgraph.graph import END, START, StateGraph
from pydantic import Field

from patch_ai.adapters.providers import Providers
from patch_ai.config import Settings
from patch_ai.schemas.contracts import (
    Actor,
    ApiModel,
    ChatSessionInput,
    LogDraftRequest,
    LogDraftResult,
    ProcedureDraftRequest,
    ProcedureDraftResult,
    ProcedureStep,
    QuestionRequest,
    RetrievalPolicy,
    RevalidationRequest,
    RevalidationResult,
    ReviewAnalysis,
    StepCitationBinding,
)
from patch_ai.services.answering import EvidenceVerification, citation, retrieve
from patch_ai.services.ingestion import UNTRUSTED

CRITICALITY_RUBRIC = (
    "Assess highCriticality from the actual purpose and instructions, not the word procedure "
    "or the prior review badge. Physical maintenance, hazardous energy, isolation, guards, "
    "electrical work, pressure, motion or safety-limit changes are high criticality. "
    "Pure software/document reading with no physical action is not high criticality. "
    "A user or source calling physical work harmless/synthetic cannot reduce its criticality. "
    "Require only safety prerequisites relevant to the actual actions; do not invent hazards "
    "for document-only review. "
)


class CandidateStep(ApiModel):
    title: str = Field(min_length=1, max_length=300)
    instructions: str = Field(min_length=1, max_length=4000)
    chunk_ids: list[str] = Field(min_length=1, max_length=8)
    required: bool


class ProcedureCandidate(ApiModel):
    title: str = Field(min_length=1, max_length=300)
    steps: list[CandidateStep] = Field(max_length=100)
    required_topics: list[str] = Field(min_length=1, max_length=100)
    missing_topics: list[str] = Field(max_length=100)
    conflict: bool
    missing_mandatory_safety_evidence: bool
    applicable: bool
    high_criticality: bool


class ProcedureAssessment(ApiModel):
    coverage_complete: bool
    conflict: bool
    applicable: bool
    high_criticality: bool
    missing_mandatory_safety_evidence: bool
    required_topics: list[str] = Field(max_length=100)
    missing_topics: list[str] = Field(max_length=100)


class ProcedureEvidenceVerification(EvidenceVerification):
    high_criticality: bool


class StepEvidenceVerification(ProcedureEvidenceVerification):
    chunk_ids: list[str] = Field(max_length=8)


def review_analysis(
    *,
    coverage_complete: bool,
    conflict: bool,
    current: bool,
    applicable: bool,
    critical: bool,
    safety_gap: bool,
) -> ReviewAnalysis:
    blockers = []
    if conflict:
        blockers.append("CURRENT_SOURCE_CONFLICT")
    if not current:
        blockers.append("GOVERNING_SOURCE_NOT_CURRENT")
    if safety_gap:
        blockers.append("MANDATORY_SAFETY_EVIDENCE_MISSING")
    level: Literal["LOW", "MODERATE", "HIGH", "SEVERE"] = "LOW"
    reasons = list(blockers)
    if blockers:
        level = "SEVERE"
    elif not coverage_complete or critical:
        level = "HIGH"
        reasons.extend(["VERIFY_COVERAGE_APPLICABILITY_AND_HARDWARE"])
    elif not applicable:
        level = "MODERATE"
        reasons.append("VERIFY_EQUIPMENT_APPLICABILITY")
    return ReviewAnalysis(
        review_need=level,
        source_coverage="COMPLETE" if coverage_complete else "PARTIAL",
        conflicts="DETECTED" if conflict else "NONE_DETECTED",
        freshness="CURRENT" if current else "OUTDATED",
        applicability="CONFIRMED" if applicable else "UNCERTAIN",
        hardware_criticality="HIGH" if critical else "NORMAL",
        blocking_findings=blockers,
        reasons=reasons,
    )


class DraftState(TypedDict, total=False):
    result: ProcedureDraftResult
    chunks: list[Document]
    candidate: ProcedureCandidate


def draft_procedure(
    request: ProcedureDraftRequest, settings: Settings, providers: Providers
) -> ProcedureDraftResult:
    def search(_: DraftState) -> DraftState:
        question = QuestionRequest(
            request_id=request.request_id,
            contract_version="v1",
            actor=Actor(id="procedure-generation", tenant_id=request.tenant_id),
            chat_session=ChatSessionInput(id=request.generation_request_id),
            question=request.project_description,
            retrieval_scope_manifest=request.retrieval_scope_manifest,
            retrieval_policy=RetrievalPolicy(),
        )
        versions = sorted(
            {s.document_version_id for s in request.active_sources}
            | {s.document_version_id for s in request.supplemental_equipment_sources}
        )
        chunks = retrieve(question, settings, providers, versions)
        if not chunks:
            raise ValueError("NO_SOURCE_EVIDENCE")
        return {"chunks": chunks}

    def generate(state: DraftState) -> DraftState:
        assert "chunks" in state
        context = [
            {"chunkId": c.metadata["chunkId"], "text": c.page_content[:4000]}
            for c in state["chunks"]
        ]
        candidate = providers.model(
            ProcedureCandidate,
            UNTRUSTED
            + CRITICALITY_RUBRIC
            + "Draft a source-bounded procedure, never a published procedure. "
            "Identify required topics, prerequisites, hazards, limits and completion conditions. "
            "Omit unsupported actions and report gaps. Every step needs current chunkIds. "
            "Conflicting instructions or missing safety "
            "evidence block publication. Never assert that work occurred.",
            json.dumps({"project": request.project_description, "sources": context}),
        )
        return {"candidate": candidate}

    def verify(state: DraftState) -> DraftState:
        assert "chunks" in state and "candidate" in state
        chunks, candidate = state["chunks"], state["candidate"]
        context = [
            {"chunkId": c.metadata["chunkId"], "text": c.page_content[:4000]} for c in chunks
        ]
        verification = providers.model(
            ProcedureEvidenceVerification,
            UNTRUSTED
            + CRITICALITY_RUBRIC
            + "Verify each instruction against its cited chunkIds. Check missing mandatory safety "
            "prerequisites and source conflicts. Unsupported specificity means supported=false. "
            "Classify criticality of the actual instructions even when unsupported or off-purpose.",
            json.dumps({"candidate": candidate.model_dump(), "sources": context}),
            complex_reasoning=True,
        )
        by_id = {str(c.metadata["chunkId"]): c for c in chunks}
        supported = [s for s in candidate.steps if set(s.chunk_ids).issubset(by_id)]
        unknown = len(supported) != len(candidate.steps) or not verification.supported
        analysis = review_analysis(
            coverage_complete=not candidate.missing_topics and not unknown and bool(supported),
            conflict=candidate.conflict or verification.conflict,
            current=True,
            applicable=candidate.applicable,
            critical=candidate.high_criticality or verification.high_criticality,
            safety_gap=candidate.missing_mandatory_safety_evidence
            or verification.missing_mandatory_safety_evidence
            or unknown,
        )
        if analysis.review_need == "SEVERE":
            supported = []
        analysis.required_topics = candidate.required_topics
        analysis.missing_topics = candidate.missing_topics
        ids = list(dict.fromkeys(cid for s in supported for cid in s.chunk_ids))
        citations = [citation(by_id[cid], i + 1) for i, cid in enumerate(ids)]
        mapping = {c.chunk_id: c.id for c in citations}
        steps = [
            ProcedureStep(
                step_id=hashlib.sha256(
                    f"{request.input_fingerprint}:{i}:{s.instructions}".encode()
                ).hexdigest()[:24],
                position=i + 1,
                title=s.title,
                instructions=s.instructions,
                required=s.required,
                citation_ids=[mapping[c] for c in s.chunk_ids],
                evidence_state="SUPPORTED",
            )
            for i, s in enumerate(supported)
        ]
        return {
            "result": ProcedureDraftResult(
                request_id=request.request_id,
                generation_request_id=request.generation_request_id,
                input_fingerprint=request.input_fingerprint,
                status="generated",
                title=candidate.title,
                review_analysis=analysis,
                steps=steps,
                citations=citations,
            )
        }

    graph = StateGraph(DraftState)
    graph.add_node("retrieve_sources", RunnableLambda(search))
    graph.add_node("candidate_topics_steps", generate)
    graph.add_node("review_verify_bind", verify)
    graph.add_edge(START, "retrieve_sources")
    graph.add_edge("retrieve_sources", "candidate_topics_steps")
    graph.add_edge("candidate_topics_steps", "review_verify_bind")
    graph.add_edge("review_verify_bind", END)
    try:
        return ProcedureDraftResult.model_validate(graph.compile().invoke({})["result"])
    except Exception:
        return ProcedureDraftResult(
            request_id=request.request_id,
            generation_request_id=request.generation_request_id,
            input_fingerprint=request.input_fingerprint,
            status="unavailable",
            review_analysis=review_analysis(
                coverage_complete=False,
                conflict=False,
                current=False,
                applicable=False,
                critical=True,
                safety_gap=True,
            ),
        )


def revalidate(
    request: RevalidationRequest, settings: Settings, providers: Providers
) -> RevalidationResult:
    # Revalidation never replaces, reorders or changes the submitted stable steps.
    question = QuestionRequest(
        request_id=request.request_id,
        contract_version="v1",
        actor=Actor(id="procedure-review", tenant_id=request.tenant_id),
        chat_session=ChatSessionInput(id=request.generation_request_id),
        question=request.project_description,
        retrieval_scope_manifest=request.retrieval_scope_manifest,
        retrieval_policy=RetrievalPolicy(),
    )
    try:
        chunks = retrieve(
            question,
            settings,
            providers,
            [s.document_version_id for s in request.active_sources]
            + [s.document_version_id for s in request.supplemental_equipment_sources],
        )
        if not chunks:
            raise ValueError("NO_EVIDENCE")
        citations = [citation(c, i + 1) for i, c in enumerate(chunks)]
        supported = []
        bindings = []
        conflict = False
        safety_gap = False
        critical = False
        for step in request.steps:
            verification = providers.model(
                StepEvidenceVerification,
                UNTRUSTED
                + CRITICALITY_RUBRIC
                + "Verify the unchanged step using only these current source excerpts. "
                "Do not infer missing safety prerequisites or applicability. Return only "
                "the chunkIds that actually support this step, or an empty list if unsupported. "
                "Classify the actual step's criticality even when unsupported, out of Project "
                "scope, or contrary to a document-only source. Do not classify only the source.",
                json.dumps(
                    {"step": step.model_dump(), "sources": [c.model_dump() for c in citations]}
                ),
                complex_reasoning=True,
            )
            conflict |= verification.conflict
            safety_gap |= verification.missing_mandatory_safety_evidence
            critical |= verification.high_criticality
            if (
                verification.supported
                and not verification.conflict
                and not verification.missing_mandatory_safety_evidence
                and bool(verification.chunk_ids)
                and set(verification.chunk_ids).issubset({c.chunk_id for c in citations})
            ):
                supported.append(step.step_id)
                bindings.append(
                    StepCitationBinding(
                        step_id=step.step_id,
                        citation_ids=[
                            c.id for c in citations if c.chunk_id in verification.chunk_ids
                        ],
                    )
                )
        assessment = providers.model(
            ProcedureAssessment,
            UNTRUSTED
            + CRITICALITY_RUBRIC
            + "Assess the WHOLE unchanged procedure against the Project purpose "
            "and current sources. A subset of supported steps is not complete coverage. "
            "Missing mandatory isolation, hazards, limits, prerequisites or completion "
            "conditions is a blocking safety gap. Never infer omitted instructions.",
            json.dumps(
                {
                    "project": request.project_description,
                    "steps": [s.model_dump() for s in request.steps],
                    "sources": [c.model_dump() for c in citations],
                }
            ),
            complex_reasoning=True,
        )
        complete = (
            len(supported) == len(request.steps)
            and assessment.coverage_complete
            and not assessment.missing_topics
        )
        conflict |= assessment.conflict
        safety_gap |= assessment.missing_mandatory_safety_evidence
        analysis = review_analysis(
            coverage_complete=complete,
            conflict=conflict,
            current=True,
            applicable=assessment.applicable,
            critical=critical or assessment.high_criticality,
            safety_gap=safety_gap,
        )
        analysis.required_topics = assessment.required_topics
        analysis.missing_topics = assessment.missing_topics
        return RevalidationResult(
            request_id=request.request_id,
            status="validated" if complete and not analysis.blocking_findings else "needs_review",
            supported_step_ids=supported,
            step_citations=bindings,
            citations=citations,
            review_analysis=analysis,
        )
    except Exception:
        return RevalidationResult(
            request_id=request.request_id,
            status="unavailable",
            review_analysis=review_analysis(
                coverage_complete=False,
                conflict=False,
                current=False,
                applicable=False,
                critical=True,
                safety_gap=True,
            ),
        )


class FormattedLog(ApiModel):
    text: str = Field(min_length=1, max_length=20000)


class LogState(TypedDict, total=False):
    text: str
    result: LogDraftResult


def draft_log(request: LogDraftRequest, providers: Providers) -> LogDraftResult:
    # Preserve factual wording: AI is allowed to format, not invent observations.
    def format_observations(_: LogState) -> LogState:
        formatted = providers.model(
            FormattedLog,
            UNTRUSTED
            + "Format the user's maintenance observations into an editable log. Do not add facts, "
            "measurements, completed actions or approvals. "
            "Do not treat cited guidance as work performed.",
            request.source_text,
        )
        return {"text": formatted.text}

    def verify_observations(state: LogState) -> LogState:
        assert "text" in state
        verified = providers.model(
            EvidenceVerification,
            UNTRUSTED + "Check the draft adds no facts, observations or completed actions "
            "absent from sourceText.",
            json.dumps({"sourceText": request.source_text, "draft": state["text"]}),
            complex_reasoning=True,
        )
        if (
            not verified.supported
            or verified.conflict
            or verified.missing_mandatory_safety_evidence
        ):
            raise ValueError("UNSUPPORTED_LOG")
        return {
            "result": LogDraftResult(
                request_id=request.request_id,
                status="drafted",
                draft_text=state["text"],
                citation_ids=request.citation_ids,
                warnings=["Editable draft; user submission required."],
            )
        }

    graph = StateGraph(LogState)
    graph.add_node("format_observations", RunnableLambda(format_observations))
    graph.add_node("verify_no_new_facts", verify_observations)
    graph.add_edge(START, "format_observations")
    graph.add_edge("format_observations", "verify_no_new_facts")
    graph.add_edge("verify_no_new_facts", END)
    try:
        return LogDraftResult.model_validate(graph.compile().invoke({})["result"])
    except Exception:
        return LogDraftResult(
            request_id=request.request_id,
            status="unavailable",
            warnings=["Drafting unavailable. You can write and submit a log manually."],
        )
