import { useState } from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ChatSourceComposer } from "@/components/chat-source-composer";
import { findMention, mentionResults } from "@/lib/chat-mentions";
import type { Reference } from "@/lib/api/chat-workflow";

const refs: Reference[] = [
  { type: "PROJECT", id: "project-1", label: "Cooling water" },
  { type: "EQUIPMENT", id: "equipment-1", label: "P-101 pump" },
  { type: "DOCUMENT", id: "document-1", label: "Pump reference" },
];

function Composer({
  references = refs,
  error = null,
  retry = vi.fn(),
  disabled = false,
}: {
  references?: Reference[] | null;
  error?: string | null;
  retry?: () => void;
  disabled?: boolean;
}) {
  const [question, setQuestion] = useState("");
  const [assigned, setAssigned] = useState<Reference[]>([]);
  return (
    <ChatSourceComposer
      question={question}
      onQuestionChange={setQuestion}
      assigned={assigned}
      onAssignedChange={setAssigned}
      references={references}
      error={error}
      retry={retry}
      disabled={disabled}
    />
  );
}

describe("chat mention parsing", () => {
  it("recognizes categories, multiword labels and the singular document alias", () => {
    expect(findMention("Ask @", 5)?.category).toBeNull();
    expect(findMention("Ask @documents:Pump reference", 29)?.query).toBe(
      "Pump reference",
    );
    expect(findMention("@document:Pump", 14)?.category?.type).toBe("DOCUMENT");
    expect(findMention("@EQUIPMENT:P-101", 16)?.category?.type).toBe(
      "EQUIPMENT",
    );
  });
  it("does not interpret emails, unknown categories, newlines or selected text", () => {
    for (const value of [
      "name@example.com",
      "@unknown:test",
      "@project:cool\nwater",
    ])
      expect(findMention(value, value.length)).toBeNull();
    expect(findMention("@project:", -1)).toBeNull();
  });
  it("filters only available IDs of the selected type and excludes attached sources", () => {
    expect(mentionResults(refs, "DOCUMENT", "pump", [])).toEqual([refs[2]]);
    expect(mentionResults(refs, "DOCUMENT", "pump", [refs[2]])).toEqual([]);
    expect(mentionResults(refs, "PROJECT", "missing", [])).toEqual([]);
  });
});

describe("chat source composer", () => {
  it("offers three categories, inserts the colon, attaches by keyboard and removes its preview", async () => {
    const user = userEvent.setup();
    render(<Composer />);
    const question = screen.getByLabelText("Question");
    await user.type(question, "Explain @");
    expect(
      screen.getAllByRole("option").map((option) => option.textContent),
    ).toEqual(["Project", "Equipment", "Document"]);
    await user.keyboard("{Enter}");
    expect(question).toHaveValue("Explain @project:");
    await user.type(question, "Cooling");
    await user.keyboard("{Enter}");
    await waitFor(() => expect(question).toHaveValue("Explain "));
    expect(screen.getByText("@project:Cooling water")).toBeVisible();
    await user.click(
      screen.getByRole("button", { name: "Remove Cooling water" }),
    );
    expect(screen.queryByText("@project:Cooling water")).toBeNull();
  });
  it("supports direct document mentions and mouse selection without duplicating attachments", async () => {
    const user = userEvent.setup();
    render(<Composer />);
    const question = screen.getByLabelText("Question");
    await user.type(question, "@documents:reference");
    await user.click(screen.getByRole("option", { name: "Pump reference" }));
    expect(question).toHaveValue("");
    expect(screen.getByText("@documents:Pump reference")).toBeVisible();
    await user.type(question, "@documents:");
    expect(screen.getByRole("status")).toHaveTextContent("No matching sources");
    expect(screen.queryByRole("option")).toBeNull();
  });
  it("dismisses suggestions with Escape and preserves text around a caret mention", async () => {
    const user = userEvent.setup();
    render(<Composer />);
    const question = screen.getByLabelText("Question") as HTMLTextAreaElement;
    await user.type(question, "Before @equipment:Pump after");
    question.setSelectionRange(22, 22);
    fireEvent.select(question);
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("listbox")).toBeNull();
    fireEvent.change(question, {
      target: {
        value: "Before @equipment:P-101 after",
        selectionStart: 23,
        selectionEnd: 23,
      },
    });
    await user.click(screen.getByRole("option", { name: "P-101 pump" }));
    expect(question).toHaveValue("Before  after");
  });
  it("shows loading and recoverable errors without changing the draft", async () => {
    const user = userEvent.setup();
    const retry = vi.fn();
    const view = render(<Composer references={null} />);
    await user.type(screen.getByLabelText("Question"), "@project:");
    expect(screen.getByRole("status")).toHaveTextContent(
      "Loading available sources",
    );
    view.rerender(
      <Composer references={null} error="Unavailable" retry={retry} />,
    );
    await user.click(screen.getByRole("button", { name: "Try again" }));
    expect(retry).toHaveBeenCalledOnce();
    expect(screen.getByLabelText("Question")).toHaveValue("@project:");
    view.rerender(<Composer disabled />);
    expect(screen.getByLabelText("Question")).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "Attach context" }),
    ).toBeDisabled();
    expect(screen.queryByRole("listbox")).toBeNull();
  });
});
