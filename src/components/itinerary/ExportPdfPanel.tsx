"use client";

import { useState } from "react";
import {
  ExportPdfButton,
  ExportPdfModal,
} from "@/components/itinerary/ExportPdfModal";

export function ExportPdfPanel({
  compact = false,
  inline = false,
}: {
  compact?: boolean;
  inline?: boolean;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <ExportPdfButton
        compact={compact}
        inline={inline}
        onOpen={() => setOpen(true)}
      />
      <ExportPdfModal open={open} onClose={() => setOpen(false)} />
    </>
  );
}
