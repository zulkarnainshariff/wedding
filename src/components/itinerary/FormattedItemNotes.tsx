"use client";

import { Fragment } from "react";
import {
  itemNotesHasContent,
  normalizeItemNotesText,
  parseInlineFormattedText,
  splitItemNoteLines,
} from "@/lib/item-note-format";

function InlineFormattedText({ text }: { text: string }) {
  const segments = parseInlineFormattedText(text);

  return (
    <>
      {segments.map((segment, index) => {
        if (segment.kind === "bold") {
          return <strong key={index}>{segment.value}</strong>;
        }
        if (segment.kind === "italic") {
          return <em key={index}>{segment.value}</em>;
        }
        return <Fragment key={index}>{segment.value}</Fragment>;
      })}
    </>
  );
}

export function FormattedItemNotes({
  notes,
  className = "text-sm text-stone-700",
}: {
  notes?: string[] | string | null;
  className?: string;
}) {
  if (!itemNotesHasContent(notes)) return null;

  const lines = splitItemNoteLines(normalizeItemNotesText(notes));

  return (
    <div className={className}>
      {lines.map((line, index) => (
        <Fragment key={index}>
          {index > 0 ? <br /> : null}
          <InlineFormattedText text={line} />
        </Fragment>
      ))}
    </div>
  );
}

export function ItemNotesSection({
  notes,
  title = "Notes",
  variant = "card",
}: {
  notes?: string[] | string | null;
  title?: string;
  variant?: "card" | "section";
}) {
  if (!itemNotesHasContent(notes)) return null;

  const wrapperClassName =
    variant === "card"
      ? "rounded-xl border border-stone-200 bg-stone-50 px-4 py-3"
      : "border-t border-stone-100 py-4";

  return (
    <div className={wrapperClassName}>
      <h3 className="text-sm font-semibold tracking-wide text-stone-500 uppercase">
        {title}
      </h3>
      <div className="mt-2">
        <FormattedItemNotes notes={notes} />
      </div>
    </div>
  );
}
