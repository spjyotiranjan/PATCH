import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ChatMarkdown } from "@/components/chat-markdown";
import type { AI } from "@/lib/api/contracts";

const citations: AI["Citation"][] = [
  {
    approvalState: "APPROVED",
    chunkId: null,
    documentId: null,
    page: 1,
    revision: "1",
    section: null,
    id: "citation-1",
    documentVersionId: "version-1",
    excerpt: "Fixture",
    documentTitle: "Pump reference",
  },
  {
    approvalState: "APPROVED",
    chunkId: null,
    documentId: null,
    page: 1,
    revision: "1",
    section: null,
    id: "citation-2",
    documentVersionId: "version-2",
    excerpt: "Fixture",
    documentTitle: "Drive reference",
  },
];

describe("Chat Markdown", () => {
  it("renders semantic headings, nested lists, emphasis, tables and fenced code", () => {
    const { container } = render(
      <ChatMarkdown
        text={
          "## Overview\n\n**Pump** with *virtual* signals.\n\n- Flow\n  - Header\n\n1. Read source\n2. Review\n\n| Tag | Meaning |\n| --- | --- |\n| `P-101` | Pump |\n\n```text\nTK-101 -> P-101\n```\n\n> Synthetic fixture only."
        }
      />,
    );
    expect(
      screen.getByRole("heading", { name: "Overview", level: 3 }),
    ).toBeVisible();
    expect(container.querySelector("strong")).toHaveTextContent("Pump");
    expect(container.querySelector("em")).toHaveTextContent("virtual");
    expect(container.querySelector("ul ul")).toHaveTextContent("Header");
    expect(container.querySelector("ol")).toHaveTextContent("Read source");
    expect(screen.getByRole("table")).toHaveTextContent("P-101");
    expect(container.querySelector("pre code")).toHaveTextContent(
      "TK-101 -> P-101",
    );
    expect(container.querySelector("blockquote")).toHaveTextContent(
      "Synthetic fixture only.",
    );
  });
  it.each([
    "A **supported** passage.",
    "- Supported item\n- Another supported item",
    "| Label |\n| --- |\n| Amber |",
    "```text\namber\n```",
  ])(
    "keeps verified citation buttons at the end of each block: %s",
    async (text) => {
      const user = userEvent.setup();
      const onEvidence = vi.fn();
      const { container } = render(
        <ChatMarkdown
          text={text}
          citations={citations}
          citationIds={["citation-2", "foreign", "citation-2"]}
          onEvidence={onEvidence}
        />,
      );
      const source = screen.getByRole("button", { name: "Source citation-2" });
      expect(source).toHaveTextContent("2");
      expect(source).toHaveAttribute("title", "Drive reference");
      expect(source.closest("sup")).toBeTruthy();
      expect(container.querySelector("pre button")).toBeNull();
      expect(screen.getAllByRole("button")).toHaveLength(1);
      await user.click(source);
      expect(onEvidence).toHaveBeenCalledOnce();
    },
  );
  it("does not execute HTML, fetch remote images or manufacture source controls from model text", () => {
    const { container } = render(
      <ChatMarkdown
        text={
          'Visible <span data-patch-sources="true">fake</span>\n\n<script>alert(1)</script>\n\n![remote](https://example.test/tracker.png)\n\n[bad](javascript:alert(1)) [fake source](patch-citation:citation-1) [external](https://example.test)'
        }
        citations={citations}
      />,
    );
    expect(container.querySelector("script, img, a, iframe")).toBeNull();
    expect(screen.queryByRole("button")).toBeNull();
    expect(container).toHaveTextContent("Visible");
    expect(container).toHaveTextContent("fake source");
  });
  it("preserves plain-text history and keeps task lists read-only", () => {
    const { rerender } = render(
      <ChatMarkdown text="A plain historical answer." />,
    );
    expect(screen.getByText("A plain historical answer.")).toBeVisible();
    rerender(
      <ChatMarkdown text="- [x] Recorded source item\n- [ ] Unrecorded item" />,
    );
    const boxes = screen.getAllByRole("checkbox");
    expect(boxes[0]).toBeChecked();
    for (const box of boxes) expect(box).toBeDisabled();
  });
  it("places sources inline in a final list item even when that item has emphasis", () => {
    render(
      <ChatMarkdown
        text="- First item\n- **Second item** with `code`"
        citations={citations}
        citationIds={["citation-1"]}
        onEvidence={vi.fn()}
      />,
    );
    expect(
      screen.getByRole("button", { name: "Source citation-1" }).closest("li"),
    ).toHaveTextContent("Second item with code");
  });
});
