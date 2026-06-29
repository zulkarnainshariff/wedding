"use client";

import { useItineraryUI, type ViewMode } from "@/components/itinerary/ItineraryUIContext";

export function ViewModeToggle() {
  const { viewMode, setViewMode } = useItineraryUI();

  return (
    <div className="inline-flex rounded-xl border border-stone-200 bg-white p-1 text-sm shadow-sm">
      <ToggleButton
        active={viewMode === "condensed"}
        onClick={() => setViewMode("condensed")}
        label="Condensed"
      />
      <ToggleButton
        active={viewMode === "detailed"}
        onClick={() => setViewMode("detailed")}
        label="Detailed"
      />
    </div>
  );
}

function ToggleButton({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "cursor-pointer rounded-lg px-3 py-1.5 font-medium transition",
        active
          ? "bg-brand-deep text-white"
          : "text-stone-500 hover:text-stone-800",
      ].join(" ")}
    >
      {label}
    </button>
  );
}

export function useViewMode(): ViewMode {
  return useItineraryUI().viewMode;
}
