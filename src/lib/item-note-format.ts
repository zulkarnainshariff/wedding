export type FormattedTextSegment =
  | { kind: "text"; value: string }
  | { kind: "bold"; value: string }
  | { kind: "italic"; value: string };

const INLINE_FORMAT_PATTERN = /\*\*(.+?)\*\*|\*(.+?)\*|_(.+?)_/g;

export function normalizeItemNotesText(
  notes?: string[] | string | null,
): string {
  if (!notes) return "";
  if (Array.isArray(notes)) return notes.join("\n");
  return notes;
}

export function splitItemNoteLines(text: string): string[] {
  return text.split(/\r?\n/);
}

export function itemNotesHasContent(notes?: string[] | string | null): boolean {
  return normalizeItemNotesText(notes).trim().length > 0;
}

export function parseItemNotesForStorage(raw: string): string[] | undefined {
  const lines = splitItemNoteLines(raw);
  if (!lines.some((line) => line.trim().length > 0)) return undefined;
  return lines;
}

export function parseInlineFormattedText(text: string): FormattedTextSegment[] {
  const segments: FormattedTextSegment[] = [];
  let lastIndex = 0;

  for (const match of text.matchAll(INLINE_FORMAT_PATTERN)) {
    const index = match.index ?? 0;
    if (index > lastIndex) {
      segments.push({ kind: "text", value: text.slice(lastIndex, index) });
    }

    if (match[1] !== undefined) {
      segments.push({ kind: "bold", value: match[1] });
    } else {
      segments.push({ kind: "italic", value: match[2] ?? match[3] ?? "" });
    }

    lastIndex = index + match[0].length;
  }

  if (lastIndex < text.length) {
    segments.push({ kind: "text", value: text.slice(lastIndex) });
  }

  if (segments.length === 0 && text.length > 0) {
    segments.push({ kind: "text", value: text });
  }

  return segments;
}
