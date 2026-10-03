"use client";

import { useId, useLayoutEffect, useRef, useState } from "react";
import {
  AtSign,
  ChevronRight,
  FileText,
  FolderKanban,
  Settings2,
  X,
} from "lucide-react";
import type { Reference } from "@/lib/api/chat-workflow";
import {
  findMention,
  mentionCategories,
  mentionResults,
} from "@/lib/chat-mentions";

const icons = {
  ENTITY: Settings2,
  PROJECT: FolderKanban,
  EQUIPMENT: Settings2,
  DOCUMENT: FileText,
};

export function ChatSourceComposer({
  question,
  onQuestionChange,
  assigned,
  onAssignedChange,
  references,
  error,
  retry,
  disabled,
}: {
  question: string;
  onQuestionChange: (value: string) => void;
  assigned: Reference[];
  onAssignedChange: (value: Reference[]) => void;
  references: Reference[] | null;
  error: string | null;
  retry: () => void;
  disabled: boolean;
}) {
  const input = useRef<HTMLTextAreaElement>(null);
  const pendingCaret = useRef<number | null>(null);
  useLayoutEffect(() => {
    if (pendingCaret.current === null) return;
    const position = pendingCaret.current;
    pendingCaret.current = null;
    input.current?.focus();
    input.current?.setSelectionRange(position, position);
  }, [question]);
  const id = useId();
  const [caret, setCaret] = useState(0);
  const [focused, setFocused] = useState(false);
  const [dismissed, setDismissed] = useState<string | null>(null);
  const [highlight, setHighlight] = useState(0);
  const mention = findMention(question, caret);
  const signature = JSON.stringify(mention);
  const open =
    focused && !disabled && mention !== null && dismissed !== signature;
  const categories = mentionCategories.filter((item) =>
    item.keyword.startsWith(mention?.query ?? ""),
  );
  const results = mention?.category
    ? mentionResults(
        references ?? [],
        mention.category.type,
        mention.query,
        assigned,
      )
    : [];
  const options = mention?.category ? results : categories;
  const active = Math.min(highlight, Math.max(0, options.length - 1));
  const canSelect = !mention?.category || assigned.length < 50;
  const listVisible =
    !mention?.category || (canSelect && references !== null && !error);

  function replace(start: number, end: number, text: string) {
    const next = question.slice(0, start) + text + question.slice(end);
    if (next.length > 10000) return;
    const position = start + text.length;
    pendingCaret.current = position;
    onQuestionChange(next);
    setCaret(position);
    setHighlight(0);
    setDismissed(null);
  }

  function select(index: number) {
    if (!mention || disabled || !canSelect) return;
    if (mention.category) {
      const ref = results[index];
      if (!ref) return;
      onAssignedChange([...assigned, ref]);
      replace(mention.start, mention.end, "");
    } else {
      const category = categories[index];
      if (category)
        replace(mention.start, mention.end, `@${category.keyword}:`);
    }
  }

  return (
    <div
      className="chat-mention-composer"
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget))
          setFocused(false);
      }}
    >
      <div className="chat-attachment-toolbar">
        <button
          type="button"
          className="chat-attach-trigger"
          disabled={disabled}
          onClick={() => {
            const start = input.current?.selectionStart ?? question.length;
            const end = input.current?.selectionEnd ?? start;
            replace(
              start,
              end,
              `${start && !/\s/.test(question[start - 1]) ? " " : ""}@`,
            );
          }}
        >
          <AtSign size={15} aria-hidden="true" /> Attach context
        </button>
        <span>Type @ to find a source</span>
      </div>
      {assigned.length > 0 && (
        <div className="chat-attachment-previews" aria-label="Attached context">
          {assigned.map((ref) => (
            <span
              className="chat-attachment-preview"
              key={`${ref.type}:${ref.id}`}
            >
              <span>
                @
                {
                  mentionCategories.find((item) => item.type === ref.type)
                    ?.keyword
                }
                :{ref.label}
              </span>
              <button
                type="button"
                disabled={disabled}
                aria-label={`Remove ${ref.label}`}
                onClick={() =>
                  onAssignedChange(
                    assigned.filter(
                      (item) => item.type !== ref.type || item.id !== ref.id,
                    ),
                  )
                }
              >
                <X size={13} aria-hidden="true" />
              </button>
            </span>
          ))}
        </div>
      )}
      <label className="sr-only" htmlFor={`${id}-question`}>
        Question
      </label>
      <textarea
        ref={input}
        id={`${id}-question`}
        required
        maxLength={10000}
        value={question}
        disabled={disabled}
        placeholder="Ask a question, or type @ to attach context…"
        aria-autocomplete="list"
        aria-controls={open && listVisible ? `${id}-options` : undefined}
        aria-activedescendant={
          open && listVisible && options.length && canSelect
            ? `${id}-option-${active}`
            : undefined
        }
        onFocus={() => setFocused(true)}
        onChange={(event) => {
          onQuestionChange(event.target.value);
          setCaret(event.target.selectionStart);
          setHighlight(0);
          setDismissed(null);
        }}
        onSelect={(event) => {
          const target = event.currentTarget;
          setCaret(
            target.selectionStart === target.selectionEnd
              ? target.selectionStart
              : -1,
          );
        }}
        onKeyDown={(event) => {
          if (!open || event.nativeEvent.isComposing) return;
          if (event.key === "Escape") {
            event.preventDefault();
            setDismissed(signature);
          }
          if (
            (event.key === "ArrowDown" || event.key === "ArrowUp") &&
            options.length
          ) {
            event.preventDefault();
            const next =
              (active + (event.key === "ArrowDown" ? 1 : -1) + options.length) %
              options.length;
            setHighlight(next);
            document
              .getElementById(`${id}-option-${next}`)
              ?.scrollIntoView({ block: "nearest" });
          }
          if (
            (event.key === "Enter" || event.key === "Tab") &&
            options.length &&
            canSelect
          ) {
            event.preventDefault();
            select(active);
          }
        }}
      />
      {open && (
        <div className="chat-mention-menu">
          <div className="chat-mention-heading">
            {mention.category
              ? `Choose ${mention.category.label.toLowerCase()}`
              : "Attach context"}
            <span>↑ ↓ to browse · Enter to select</span>
          </div>
          {mention.category && assigned.length >= 50 ? (
            <p role="status">
              You can attach up to 50 sources. Remove one to add another.
            </p>
          ) : (
            <>
              {mention.category && error ? (
                <div role="status" className="chat-mention-empty">
                  Sources could not be loaded.{" "}
                  <button type="button" onClick={retry}>
                    Try again
                  </button>
                </div>
              ) : mention.category && references === null ? (
                <p role="status">Loading available sources…</p>
              ) : (
                <>
                  <div
                    id={`${id}-options`}
                    role="listbox"
                    aria-label={
                      mention.category
                        ? `${mention.category.label} suggestions`
                        : "Attachment types"
                    }
                  >
                    {options.map((option, index) => {
                      const Icon = icons[option.type];
                      return (
                        <button
                          type="button"
                          role="option"
                          aria-selected={index === active}
                          tabIndex={-1}
                          id={`${id}-option-${index}`}
                          key={
                            "id" in option
                              ? `${option.type}:${option.id}`
                              : option.type
                          }
                          onMouseDown={(event) => event.preventDefault()}
                          onMouseEnter={() => setHighlight(index)}
                          onClick={() => select(index)}
                        >
                          <Icon size={17} aria-hidden="true" />
                          <span>{option.label}</span>
                          <ChevronRight size={14} aria-hidden="true" />
                        </button>
                      );
                    })}
                  </div>
                  {!options.length && (
                    <p role="status">
                      {mention.category
                        ? "No matching sources available to attach."
                        : "Choose project, equipment or documents."}
                    </p>
                  )}
                </>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
