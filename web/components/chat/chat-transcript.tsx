"use client";

import React, { useState } from "react";
import {
  User,
  Wrench,
  FileText,
  FolderKanban,
  AtSign,
  AlertTriangle,
  Copy,
  Check,
  Layers,
  Sparkles,
  ShieldAlert,
} from "lucide-react";
import { type ChatTurnData, type AssignedReference } from "./chat-types";

interface ChatTranscriptProps {
  turns: ChatTurnData[];
  onCitationClick?: (citationId: string) => void;
  onOpenEvidenceDrawer?: () => void;
  onSelectFollowUp?: (followUpText: string) => void;
  isSubmitting?: boolean;
}

export function ChatTranscript({
  turns,
  onCitationClick,
  onOpenEvidenceDrawer,
  onSelectFollowUp,
  isSubmitting = false,
}: ChatTranscriptProps) {
  const [copiedTurnId, setCopiedTurnId] = useState<string | null>(null);

  const handleCopyText = (turn: ChatTurnData) => {
    let fullText = turn.question;
    if (turn.answer) {
      const stepsText = turn.answer.steps.map((s) => s.text).join("\n");
      fullText = `${turn.answer.summary || ""}\n${stepsText}`;
    }
    navigator.clipboard.writeText(fullText);
    setCopiedTurnId(turn.id);
    setTimeout(() => setCopiedTurnId(null), 2000);
  };

  if (turns.length === 0 && !isSubmitting) {
    return (
      <div className="empty-transcript-state">
        <div className="patch-avatar-lg">
          <span>P.A.T.C.H.</span>
        </div>
        <h2>Precision Assistant for Technical Context &amp; Hardware</h2>
        <p>
          Ask a question about your Equipments, Projects, or manuals to receive
          source-referenced maintenance guidance.
        </p>
        <div className="starter-prompts-grid">
          <button
            type="button"
            className="starter-prompt-card"
            onClick={() =>
              onSelectFollowUp?.(
                "What are the likely causes of pressure instability on Filler 02?",
              )
            }
          >
            <Wrench size={16} />
            <span>Troubleshoot Filler 02 pressure instability</span>
          </button>

          <button
            type="button"
            className="starter-prompt-card"
            onClick={() =>
              onSelectFollowUp?.(
                "What are the alignment check steps for Conveyor 11?",
              )
            }
          >
            <FileText size={16} />
            <span>Check Conveyor 11 alignment procedure</span>
          </button>

          <button
            type="button"
            className="starter-prompt-card"
            onClick={() =>
              onSelectFollowUp?.(
                "Summarize LOTO safety requirements for Line 3 lockout review",
              )
            }
          >
            <FolderKanban size={16} />
            <span>Review Line 3 LOTO lockout requirements</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="chat-transcript-flow">
      {turns.map((turn) => (
        <div key={turn.id} className="chat-turn-group">
          {/* USER MESSAGE */}
          <article className="chat-bubble user-bubble">
            <header className="bubble-header">
              <div className="user-avatar">
                <User size={14} />
                <span>You</span>
              </div>
              <time className="bubble-time">{turn.timestamp}</time>
            </header>

            {/* Assigned References Chips */}
            {turn.assignedReferences && turn.assignedReferences.length > 0 && (
              <div className="bubble-references-bar">
                {turn.assignedReferences.map((ref) => (
                  <span
                    key={ref.id}
                    className={`transcript-chip chip-${ref.type.toLowerCase()}`}
                  >
                    <ReferenceIcon type={ref.type} />
                    <span>
                      <strong>@{ref.type}</strong> {ref.name}
                    </span>
                  </span>
                ))}
              </div>
            )}

            <div className="bubble-body">
              <p>{turn.question}</p>
            </div>
          </article>

          {/* ASSISTANT MESSAGE */}
          <article className="chat-bubble patch-bubble">
            <header className="bubble-header">
              <div className="patch-avatar">
                <Sparkles size={14} />
                <span>P.A.T.C.H.</span>
              </div>
              <time className="bubble-time">{turn.timestamp}</time>
            </header>

            {turn.state === "PENDING" ? (
              <div className="turn-loading-box">
                <div className="loading-spinner-small" />
                <span>Finding relevant Equipments and current sources…</span>
              </div>
            ) : (
              <div className="bubble-content-wrapper">
                {/* Evidence State Warning Banners if applicable */}
                {turn.status === "incomplete" && (
                  <div className="state-banner banner-warning">
                    <AlertTriangle size={16} />
                    <span>
                      <strong>Source review needed:</strong> Evidence for this
                      response is incomplete.
                    </span>
                  </div>
                )}
                {turn.status === "conflicting" && (
                  <div className="state-banner banner-danger">
                    <AlertTriangle size={16} />
                    <span>
                      <strong>Conflicting sources detected:</strong> Conflicting
                      specifications were found in the evidence drawer.
                    </span>
                  </div>
                )}
                {turn.status === "unavailable" && (
                  <div className="state-banner banner-danger">
                    <ShieldAlert size={16} />
                    <span>
                      <strong>Verified guidance unavailable:</strong> No
                      approved current evidence was found to answer this
                      question.
                    </span>
                  </div>
                )}

                {/* Summary Intro */}
                {turn.answer?.summary && (
                  <p className="answer-summary">{turn.answer.summary}</p>
                )}

                {/* Bullet / Numbered Steps */}
                {turn.answer?.steps && turn.answer.steps.length > 0 && (
                  <ol className="answer-steps-list">
                    {turn.answer.steps.map((step, idx) => (
                      <li key={step.id || idx} className="answer-step-item">
                        <span className="step-text">{step.text}</span>
                        {/* Inline Citations */}
                        {step.citationIds && step.citationIds.length > 0 && (
                          <span className="inline-citations-group">
                            {step.citationIds.map((citId) => {
                              const matchingCit = turn.citations?.find(
                                (c) => c.id === citId,
                              );
                              const label = matchingCit
                                ? `[${matchingCit.documentTitle}, Rev. ${
                                    matchingCit.revision.replace(/\D/g, "") ||
                                    "2"
                                  }]`
                                : "[Source]";
                              return (
                                <button
                                  type="button"
                                  key={citId}
                                  className="inline-citation-chip"
                                  onClick={() => {
                                    onCitationClick?.(citId);
                                    onOpenEvidenceDrawer?.();
                                  }}
                                  title="View source evidence in drawer"
                                >
                                  {label}
                                </button>
                              );
                            })}
                          </span>
                        )}
                      </li>
                    ))}
                  </ol>
                )}

                {/* Safety Boundary */}
                {turn.safetyBoundary && (
                  <div className="safety-boundary-box">
                    <div className="safety-badge">
                      <AlertTriangle size={14} />
                      <span>{turn.safetyBoundary.title}</span>
                    </div>
                    <p>{turn.safetyBoundary.text}</p>
                  </div>
                )}

                {/* Follow-up Suggestions */}
                {turn.followUps && turn.followUps.length > 0 && (
                  <div className="follow-up-suggestions-bar">
                    <span className="follow-up-label">
                      Follow-up suggestions
                    </span>
                    <div className="follow-up-pills flex-wrap">
                      {turn.followUps.map((prompt, pIdx) => (
                        <button
                          type="button"
                          key={pIdx}
                          className="follow-up-pill"
                          onClick={() => onSelectFollowUp?.(prompt)}
                        >
                          {prompt}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Response Action Bar */}
                <footer className="bubble-footer-actions">
                  <button
                    type="button"
                    className="btn-action-sm"
                    onClick={() => handleCopyText(turn)}
                    title="Copy response text"
                  >
                    {copiedTurnId === turn.id ? (
                      <>
                        <Check size={13} className="text-success" />
                        <span>Copied</span>
                      </>
                    ) : (
                      <>
                        <Copy size={13} />
                        <span>Copy</span>
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    className="btn-action-sm"
                    onClick={onOpenEvidenceDrawer}
                    title="View Evidence Used"
                  >
                    <Layers size={13} />
                    <span>Evidence Used</span>
                  </button>
                </footer>
              </div>
            )}
          </article>
        </div>
      ))}

      {isSubmitting && (
        <article className="chat-bubble patch-bubble">
          <header className="bubble-header">
            <div className="patch-avatar">
              <Sparkles size={14} />
              <span>P.A.T.C.H.</span>
            </div>
            <time className="bubble-time">Just now</time>
          </header>
          <div className="turn-loading-box">
            <div className="loading-spinner-small" />
            <span>Finding relevant Equipments and current sources…</span>
          </div>
        </article>
      )}
    </div>
  );
}

function ReferenceIcon({ type }: { type: AssignedReference["type"] }) {
  if (type === "EQUIPMENT") return <Wrench size={12} />;
  if (type === "DOCUMENT") return <FileText size={12} />;
  if (type === "PROJECT") return <FolderKanban size={12} />;
  return <AtSign size={12} />;
}
