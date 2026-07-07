export type FormattedTextSegment =
  | { kind: "text"; value: string }
  | { kind: "bold"; value: string }
  | { kind: "italic"; value: string };

export type LinkTextSegment =
  | { kind: "text"; value: string }
  | { kind: "link"; href: string; value: string };

const INLINE_FORMAT_PATTERN = /\*\*(.+?)\*\*|\*(.+?)\*|_(.+?)_/g;
const MARKDOWN_LINK_PATTERN = /\[([^\]]+)\]\(([^)]+)\)/g;
const BARE_URL_PATTERN = /\bhttps?:\/\/[^\s<>"']+|\bwww\.[^\s<>"']+/gi;

function isSafeHref(href: string): boolean {
  const trimmed = href.trim();
  if (/^https?:\/\//i.test(trimmed)) return true;
  if (/^mailto:/i.test(trimmed)) return true;
  return false;
}

function normalizeLinkHref(href: string): string | null {
  const trimmed = href.trim();
  if (/^www\./i.test(trimmed)) {
    const withScheme = `https://${trimmed}`;
    return isSafeHref(withScheme) ? withScheme : null;
  }
  return isSafeHref(trimmed) ? trimmed : null;
}

function splitTrailingUrlPunctuation(raw: string): { url: string; trailing: string } {
  let url = raw;
  let trailing = "";

  while (url.length > 0) {
    const char = url.at(-1);
    if (!char || !/[.,;:!?)]/.test(char)) break;
    if (char === ")") {
      const opens = (url.match(/\(/g) ?? []).length;
      const closes = (url.match(/\)/g) ?? []).length;
      if (closes <= opens) break;
    }
    trailing = char + trailing;
    url = url.slice(0, -1);
  }

  return { url, trailing };
}

function parseBareUrls(text: string): LinkTextSegment[] {
  const segments: LinkTextSegment[] = [];
  let lastIndex = 0;

  for (const match of text.matchAll(BARE_URL_PATTERN)) {
    const index = match.index ?? 0;
    if (index > lastIndex) {
      segments.push({ kind: "text", value: text.slice(lastIndex, index) });
    }

    const { url, trailing } = splitTrailingUrlPunctuation(match[0]);
    const href = normalizeLinkHref(url);
    if (href) {
      segments.push({ kind: "link", href, value: url });
      if (trailing) {
        segments.push({ kind: "text", value: trailing });
      }
    } else {
      segments.push({ kind: "text", value: match[0] });
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

/** Parse markdown links and bare URLs in plain text. */
export function parseLinksInText(text: string): LinkTextSegment[] {
  const segments: LinkTextSegment[] = [];
  let lastIndex = 0;

  for (const match of text.matchAll(MARKDOWN_LINK_PATTERN)) {
    const index = match.index ?? 0;
    if (index > lastIndex) {
      segments.push(...parseBareUrls(text.slice(lastIndex, index)));
    }

    const label = match[1] ?? "";
    const href = normalizeLinkHref(match[2] ?? "");
    if (href && label) {
      segments.push({ kind: "link", href, value: label });
    } else {
      segments.push({ kind: "text", value: match[0] });
    }

    lastIndex = index + match[0].length;
  }

  if (lastIndex < text.length) {
    segments.push(...parseBareUrls(text.slice(lastIndex)));
  }

  if (segments.length === 0 && text.length > 0) {
    return parseBareUrls(text);
  }

  return segments;
}

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
