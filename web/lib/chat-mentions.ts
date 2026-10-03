import type { Reference } from "@/lib/api/chat-workflow";

export const mentionCategories = [
  { type: "PROJECT", keyword: "project", label: "Project" },
  { type: "EQUIPMENT", keyword: "equipment", label: "Equipment" },
  { type: "DOCUMENT", keyword: "documents", label: "Document" },
] as const;

/** A mention is a UI search token; only selecting an authorized result attaches it. */
export function findMention(text: string, caret: number) {
  if (caret < 0 || caret > text.length) return null;
  const before = text.slice(0, caret);
  const start = before.lastIndexOf("@");
  if (start < 0 || (start > 0 && !/\s/.test(before[start - 1]))) return null;
  const token = before.slice(start + 1);
  if (/[\r\n@]/.test(token)) return null;
  const colon = token.indexOf(":");
  if (colon < 0) {
    if (!/^[a-z]*$/i.test(token)) return null;
    return { start, end: caret, category: null, query: token.toLowerCase() };
  }
  const keyword = token.slice(0, colon).toLowerCase();
  const category = mentionCategories.find(
    (item) =>
      item.keyword === keyword ||
      (item.type === "DOCUMENT" && keyword === "document"),
  );
  return category
    ? { start, end: caret, category, query: token.slice(colon + 1) }
    : null;
}

export function mentionResults(
  references: Reference[],
  type: Reference["type"],
  query: string,
  assigned: Reference[],
) {
  return references.filter(
    (ref) =>
      ref.type === type &&
      ref.label
        .toLocaleLowerCase()
        .includes(query.trim().toLocaleLowerCase()) &&
      !assigned.some((item) => item.type === ref.type && item.id === ref.id),
  );
}
