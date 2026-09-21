"use client";

import React, { useState, useRef, useEffect } from "react";
import {
  Send,
  Paperclip,
  AtSign,
  X,
  Wrench,
  FileText,
  FolderKanban,
  Search,
} from "lucide-react";
import {
  type AssignedReference,
  AVAILABLE_REFERENCES,
} from "./chat-types";

interface ChatComposerProps {
  onSendMessage: (
    question: string,
    assignedReferences: AssignedReference[]
  ) => void;
  isLoading?: boolean;
  initialQuestion?: string;
  initialReferences?: AssignedReference[];
}

export function ChatComposer({
  onSendMessage,
  isLoading = false,
  initialQuestion = "",
  initialReferences = [],
}: ChatComposerProps) {
  const [question, setQuestion] = useState(initialQuestion);
  const [assignedReferences, setAssignedReferences] = useState<
    AssignedReference[]
  >(initialReferences);
  const [showMentionMenu, setShowMentionMenu] = useState(false);
  const [mentionSearch, setMentionSearch] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Initial values are read once on mount. Parents that need to
  // reset the composer for a new session should remount it with a
  // React `key` instead of changing these props afterwards.

  // Adjust textarea height dynamically
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(
        textareaRef.current.scrollHeight,
        180
      )}px`;
    }
  }, [question]);

  // Handle outside click for mention menu
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        menuRef.current &&
        !menuRef.current.contains(event.target as Node) &&
        !textareaRef.current?.contains(event.target as Node)
      ) {
        setShowMentionMenu(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setQuestion(val);

    // Detect `@` at end of string or cursor position
    const lastWord = val.split(/\s+/).pop() || "";
    if (lastWord.startsWith("@")) {
      setShowMentionMenu(true);
      setMentionSearch(lastWord.slice(1).toLowerCase());
    } else if (showMentionMenu && !val.includes("@")) {
      setShowMentionMenu(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    } else if (e.key === "Escape") {
      setShowMentionMenu(false);
    }
  };

  const handleSelectReference = (ref: AssignedReference) => {
    if (!assignedReferences.some((r) => r.id === ref.id)) {
      setAssignedReferences([...assignedReferences, ref]);
    }

    // Clean up `@` text if user was typing it
    const words = question.split(/\s+/);
    if (words[words.length - 1]?.startsWith("@")) {
      words.pop();
      setQuestion(words.join(" "));
    }

    setShowMentionMenu(false);
    setMentionSearch("");
    textareaRef.current?.focus();
  };

  const handleRemoveReference = (id: string) => {
    setAssignedReferences(assignedReferences.filter((r) => r.id !== id));
  };

  const handleSubmit = () => {
    if (!question.trim() || isLoading) return;
    onSendMessage(question.trim(), assignedReferences);
    setQuestion("");
    setAssignedReferences([]);
    setShowMentionMenu(false);
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  };

  const filteredReferences = AVAILABLE_REFERENCES.filter(
    (ref) =>
      !assignedReferences.some((r) => r.id === ref.id) &&
      (ref.name.toLowerCase().includes(mentionSearch) ||
        ref.type.toLowerCase().includes(mentionSearch))
  );

  return (
    <div className="chat-composer-container">
      {/* Mention Menu Popover */}
      {showMentionMenu && (
        <div className="mention-popover" ref={menuRef}>
          <div className="mention-header">
            <Search size={14} />
            <span>Search reference (@document | @equipment | @project)</span>
          </div>
          <div className="mention-list">
            {filteredReferences.length > 0 ? (
              filteredReferences.map((ref) => (
                <button
                  type="button"
                  key={ref.id}
                  className="mention-item"
                  onClick={() => handleSelectReference(ref)}
                >
                  <ReferenceIcon type={ref.type} />
                  <span className="mention-type">@{ref.type}</span>
                  <span className="mention-name">{ref.name}</span>
                </button>
              ))
            ) : (
              <div className="mention-empty">No matching references found</div>
            )}
          </div>
        </div>
      )}

      {/* Selected Reference Chips */}
      {assignedReferences.length > 0 && (
        <div className="assigned-chips-bar">
          {assignedReferences.map((ref) => (
            <span
              key={ref.id}
              className={`reference-chip chip-${ref.type.toLowerCase()}`}
            >
              <ReferenceIcon type={ref.type} />
              <span>
                <strong>@{ref.type}</strong> {ref.name}
              </span>
              <button
                type="button"
                className="chip-remove-btn"
                onClick={() => handleRemoveReference(ref.id)}
                aria-label={`Remove @${ref.type} ${ref.name}`}
              >
                <X size={12} />
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Main Composer Row */}
      <div className="composer-box">
        <textarea
          ref={textareaRef}
          className="composer-textarea"
          value={question}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          placeholder="Ask a follow-up question..."
          rows={1}
          disabled={isLoading}
          aria-label="Ask a question or enter a query"
        />

        <div className="composer-actions">
          <button
            type="button"
            className="composer-icon-btn"
            onClick={() => setShowMentionMenu(!showMentionMenu)}
            title="Attach reference tag (@)"
            aria-label="Attach reference tag"
          >
            <AtSign size={18} />
          </button>

          <button
            type="button"
            className="composer-icon-btn"
            title="Attach file or screenshot"
            aria-label="Attach file"
          >
            <Paperclip size={18} />
          </button>

          <button
            type="button"
            className="composer-send-btn"
            onClick={handleSubmit}
            disabled={!question.trim() || isLoading}
            aria-label="Send message"
          >
            <Send size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}

function ReferenceIcon({ type }: { type: AssignedReference["type"] }) {
  if (type === "EQUIPMENT") return <Wrench size={13} />;
  if (type === "DOCUMENT") return <FileText size={13} />;
  if (type === "PROJECT") return <FolderKanban size={13} />;
  return <AtSign size={13} />;
}
