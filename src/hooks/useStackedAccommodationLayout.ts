"use client";

import { useEffect, useState } from "react";

/** Single-column tile layouts (mobile and xl); false on md–lg two-column grids. */
export function useStackedAccommodationLayout(): boolean {
  const [stacked, setStacked] = useState(true);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px), (min-width: 1280px)");
    const update = () => setStacked(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  return stacked;
}
