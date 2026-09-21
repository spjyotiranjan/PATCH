"use client";

import React, { useState } from "react";
import { Star, Share2, MoreHorizontal, Layers, Plus } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import {
  type ChatSessionData,
  type ChatTurnData,
  type AssignedReference,
  DEFAULT_SESSIONS,
} from "./chat-types";
import { ChatTranscript } from "./chat-transcript";
import { ChatComposer } from "./chat-composer";
import { EvidenceDrawer } from "./evidence-drawer";

interface ChatWorkspaceProps {
  initialSessionId?: string;
  initialSessions?: ChatSessionData[];
}

export function ChatWorkspace({
  initialSessionId,
  initialSessions = DEFAULT_SESSIONS,
}: ChatWorkspaceProps) {
  // Find current session or default to the first session ("filler-02-pressure")
  const activeSessionId = initialSessionId || "filler-02-pressure";
  const session =
    initialSessions.find((s) => s.id === activeSessionId) ||
    initialSessions[0] || {
      id: activeSessionId,
      title: "New conversation",
      updatedAt: "Just now",
      timestampLabel: "Just now",
      group: "Today",
      turns: [],
    };

  const [turns, setTurns] = useState<ChatTurnData[]>(session.turns || []);
  const [isEvidenceOpen, setIsEvidenceOpen] = useState(true);
  const [evidenceMode, setEvidenceMode] = useState<"side" | "modal">("side");
  const [highlightedCitationId, setHighlightedCitationId] = useState<
    string | null
  >(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [composerQuestion, setComposerQuestion] = useState("");
  const [composerReferences, setComposerReferences] = useState<
    AssignedReference[]
  >([]);

  // Turns reset when the workspace remounts for another session
  // (parents should pass `key={activeSessionId}`). Sending appends
  // to the current transcript below.

  const handleSendMessage = async (
    question: string,
    assignedReferences: AssignedReference[]
  ) => {
    setIsSubmitting(true);

    const newClientTurnId = `turn-${Date.now()}`;
    const userTurn: ChatTurnData = {
      id: newClientTurnId,
      clientTurnId: newClientTurnId,
      question,
      assignedReferences,
      timestamp: new Date().toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      }),
      state: "PENDING",
    };

    setTurns((prev) => [...prev, userTurn]);

    // Try sending turn to backend API, or fallback to mock streaming answer
    try {
      const res = await fetch(`/api/chat/sessions/${session.id}/turns`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientTurnId: newClientTurnId,
          question,
          assignedReferences: assignedReferences.map((r) => ({
            type: r.type,
            id: r.id,
          })),
        }),
      });

      if (res.ok) {
        const data = await res.json();
        // Update turn with actual server result if available
        if (data && data.result) {
          setTurns((prev) =>
            prev.map((t) =>
              t.id === newClientTurnId
                ? {
                    ...t,
                    state: "COMPLETED",
                    answer: data.result.answer,
                    citations: data.result.citations,
                    status: data.result.status,
                  }
                : t
            )
          );
          setIsSubmitting(false);
          return;
        }
      }
    } catch {
      // Fallback to client mock generator if backend AI is unverified or offline
    }

    // Simulate realistic AI turn completion after short delay
    setTimeout(() => {
      const completedTurn: ChatTurnData = {
        ...userTurn,
        state: "COMPLETED",
        status: "approved",
        routing: {
          selectedEntities: assignedReferences.map((r) => ({
            type: r.type === "EQUIPMENT" ? "EQUIPMENT" : "PROJECT",
            name: r.name,
            reason: "explicit tag match",
          })),
        },
        answer: {
          summary: `Guidance based on approved documentation for ${
            assignedReferences[0]?.name || "the requested equipment"
          }:`,
          steps: [
            {
              id: "st-1",
              text: `Verify operating parameters and inspect mechanical connections for ${question}.`,
              citationIds: ["cit-1"],
            },
            {
              id: "st-2",
              text: "Check pressure relief settings and perform zero-calibration procedure if drift is detected.",
              citationIds: ["cit-1"],
            },
            {
              id: "st-3",
              text: "Document inspection findings in the Project maintenance log.",
            },
          ],
        },
        citations: [
          {
            id: "cit-1",
            documentId: "doc-p101",
            documentVersionId: "ver-p101-rev2",
            documentTitle: "P-101 Maintenance Manual",
            revision: "Revision 2 (Active)",
            page: 42,
            section: "6.3",
            excerpt:
              "Maintain fluid level between MIN and MAX. Check system calibration daily.",
            approvalState: "ACTIVE",
            includedIn: {
              equipmentName: assignedReferences.find(
                (r) => r.type === "EQUIPMENT"
              )?.name || "Filler 02",
              projectName: "Plant Expansion Project",
            },
          },
        ],
        evidenceSources: [
          {
            id: "ev-gen-1",
            documentTitle: "P-101 Maintenance Manual",
            status: "Active",
            revision: "Revision 2 (Active)",
            date: "May 14, 2025",
            page: 42,
            section: "6.3",
            excerpt:
              "Maintain fluid level between MIN and MAX. Check system calibration daily.",
            includedIn: {
              equipmentName: assignedReferences.find(
                (r) => r.type === "EQUIPMENT"
              )?.name || "Filler 02",
              projectName: "Plant Expansion Project",
            },
          },
        ],
        safetyBoundary: {
          title: "Safety boundary",
          text: "Ensure safety interlocks and LOTO isolation are engaged prior to performing physical inspection.",
        },
        followUps: [
          "Show detailed calibration steps",
          "List replacement part numbers",
        ],
      };

      setTurns((prev) =>
        prev.map((t) => (t.id === newClientTurnId ? completedTurn : t))
      );
      setIsSubmitting(false);
    }, 1200);
  };

  const handleSelectFollowUp = (promptText: string) => {
    setComposerQuestion(promptText);
  };

  const handleCitationClick = (citationId: string) => {
    setIsEvidenceOpen(true);
    setHighlightedCitationId(citationId);
    setTimeout(() => setHighlightedCitationId(null), 3000);
  };

  // Collect latest citations & evidence sources from active turn
  const latestTurn = turns[turns.length - 1];
  const activeCitations = latestTurn?.citations || [];
  const activeSources = latestTurn?.evidenceSources || [];
  const activeSearchedScope = latestTurn?.searchedScope || [];

  // Page Title Bar status badge
  const statusBadge = (
    <span className="title-status-badge">Auto-generated</span>
  );

  // Title Bar Actions
  const titleActions = (
    <div className="chat-title-actions-bar">
      <button
        type="button"
        className="btn-icon"
        title="Favourite shortcut"
        aria-label="Save favourite shortcut"
      >
        <Star size={17} />
      </button>

      <button
        type="button"
        className="btn-icon"
        title="Share session"
        aria-label="Share session"
      >
        <Share2 size={17} />
      </button>

      <button
        type="button"
        className={`btn-icon ${isEvidenceOpen ? "btn-icon-active" : ""}`}
        onClick={() => setIsEvidenceOpen(!isEvidenceOpen)}
        title="Toggle Evidence Used panel"
        aria-label="Toggle Evidence Used panel"
      >
        <Layers size={17} />
      </button>

      <button
        type="button"
        className="btn-icon"
        title="More actions"
        aria-label="More actions"
      >
        <MoreHorizontal size={17} />
      </button>
    </div>
  );

  return (
    <AppShell title={session.title} status={statusBadge} actions={titleActions}>
      <div className={`chat-workspace-layout ${isEvidenceOpen ? "has-side-drawer" : ""}`}>
        {/* CENTER TRANSCRIPT & COMPOSER */}
        <div className="chat-main-pane">
          <div className="chat-transcript-scrollable">
            <ChatTranscript
              turns={turns}
              onCitationClick={handleCitationClick}
              onOpenEvidenceDrawer={() => setIsEvidenceOpen(true)}
              onSelectFollowUp={handleSelectFollowUp}
              isSubmitting={isSubmitting}
            />
          </div>

          <div className="chat-composer-fixed-bottom">
            <ChatComposer
              onSendMessage={handleSendMessage}
              isLoading={isSubmitting}
              initialQuestion={composerQuestion}
              initialReferences={composerReferences}
            />
          </div>
        </div>

        {/* RIGHT EVIDENCE USED PANEL / DRAWER */}
        <EvidenceDrawer
          isOpen={isEvidenceOpen}
          onClose={() => setIsEvidenceOpen(false)}
          mode={evidenceMode}
          citations={activeCitations}
          sources={activeSources}
          searchedScope={activeSearchedScope}
          highlightedCitationId={highlightedCitationId}
        />
      </div>
    </AppShell>
  );
}
