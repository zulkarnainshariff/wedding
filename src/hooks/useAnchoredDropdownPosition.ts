"use client";

import { useEffect, useState, type CSSProperties, type RefObject } from "react";

export function useAnchoredDropdownPosition(
  open: boolean,
  anchorRef: RefObject<HTMLElement | null>,
  options?: { minWidth?: number; maxHeight?: number; gap?: number },
) {
  const [style, setStyle] = useState<CSSProperties>({ visibility: "hidden" });
  const minWidth = options?.minWidth ?? 288;
  const maxHeight = options?.maxHeight ?? 320;
  const gap = options?.gap ?? 4;

  useEffect(() => {
    if (!open) return;

    function update() {
      const anchor = anchorRef.current;
      if (!anchor) return;

      const rect = anchor.getBoundingClientRect();
      const viewportPadding = 8;
      const width = Math.min(
        window.innerWidth - viewportPadding * 2,
        Math.max(rect.width, minWidth),
      );

      let left = rect.left;
      if (left + width > window.innerWidth - viewportPadding) {
        left = window.innerWidth - viewportPadding - width;
      }
      left = Math.max(viewportPadding, left);

      const spaceBelow = window.innerHeight - rect.bottom - gap - viewportPadding;

      setStyle({
        position: "fixed",
        top: rect.bottom + gap,
        left,
        width,
        maxHeight: Math.min(maxHeight, Math.max(spaceBelow, 120)),
        zIndex: 50,
        visibility: "visible",
      });
    }

    update();
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [open, anchorRef, gap, maxHeight, minWidth]);

  return style;
}
