"use client";

import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Button } from "@/components/ui";
import type { AI } from "@/lib/api/contracts";

// Structural subset of the parsed tree: no direct imports from transitive packages.
type MarkdownNode = {
  type: string;
  tagName?: string;
  properties?: Record<string, unknown>;
  children?: MarkdownNode[];
};

/** Locate the final readable inline block; never insert controls inside code. */
function citationAnchor(node: MarkdownNode): MarkdownNode | null {
  if (node.type === "element" && node.tagName === "pre") return null;
  if (node.type === "element" && /^(p|h[1-6]|td|th)$/.test(node.tagName ?? ""))
    return node;
  if (node.tagName === "li") {
    const lastBlock = node.children
      ?.filter((child) =>
        /^(p|ul|ol|pre|blockquote|table)$/.test(child.tagName ?? ""),
      )
      .at(-1);
    return lastBlock ? citationAnchor(lastBlock) : node;
  }
  const last = node.children
    ?.filter((child) => child.type === "element")
    .at(-1);
  if (last) return citationAnchor(last);
  return null;
}

export function ChatMarkdown({
  text,
  citationIds = [],
  citations = [],
  onEvidence,
}: {
  text: string;
  citationIds?: string[];
  citations?: AI["Citation"][];
  onEvidence?: () => void;
}) {
  const sources = [...new Set(citationIds)].flatMap((id) => {
    const index = citations.findIndex((citation) => citation.id === id);
    return index < 0 ? [] : [{ citation: citations[index], number: index + 1 }];
  });
  function addCitations() {
    return (tree: MarkdownNode) => {
      if (!sources.length || !onEvidence) return;
      let anchor = citationAnchor(tree);
      if (!anchor) {
        anchor = {
          type: "element",
          tagName: "p",
          properties: { className: ["chat-markdown-source-tail"] },
          children: [],
        };
        tree.children?.push(anchor);
      }
      anchor.children ??= [];
      anchor.children.push({
        type: "element",
        tagName: "span",
        properties: { "data-patch-sources": true },
        children: [],
      });
    };
  }

  return (
    <div className="chat-markdown chat-answer-passage">
      <Markdown
        skipHtml
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[addCitations]}
        disallowedElements={["img"]}
        components={{
          // Source opening is always an authorized product action, never a model URL.
          a: ({ children }) => <span>{children}</span>,
          h1: ({ children }) => <h3>{children}</h3>,
          h2: ({ children }) => <h3>{children}</h3>,
          h3: ({ children }) => <h4>{children}</h4>,
          h4: ({ children }) => <h4>{children}</h4>,
          h5: ({ children }) => <h4>{children}</h4>,
          h6: ({ children }) => <h4>{children}</h4>,
          table: ({ children }) => (
            <div
              className="chat-markdown-table"
              role="region"
              aria-label="Answer table"
              tabIndex={0}
            >
              <table>{children}</table>
            </div>
          ),
          pre: ({ children }) => <pre tabIndex={0}>{children}</pre>,
          input: ({ checked }) => (
            <input
              type="checkbox"
              checked={checked ?? false}
              disabled
              aria-label="Read-only source checklist item"
            />
          ),
          span: ({ children, node }) =>
            node?.properties["data-patch-sources"] ? (
              <sup className="chat-citation-group">
                {sources.map(({ citation, number }) => (
                  <Button
                    className="chat-citation"
                    variant="quiet"
                    key={citation.id}
                    onClick={onEvidence}
                    aria-label={`Source ${citation.id}`}
                    title={citation.documentTitle ?? undefined}
                  >
                    {number}
                  </Button>
                ))}
              </sup>
            ) : (
              <span>{children}</span>
            ),
        }}
      >
        {text}
      </Markdown>
    </div>
  );
}
