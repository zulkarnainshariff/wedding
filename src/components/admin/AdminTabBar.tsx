"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Menu, MoreHorizontal, X } from "lucide-react";

type TabEntry = readonly [string, string];

export function AdminTabBarMobile({
  tabs,
  activeTab,
  onChange,
}: {
  tabs: ReadonlyArray<TabEntry>;
  activeTab: string;
  onChange: (tab: string) => void;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const activeLabel = tabs.find(([value]) => value === activeTab)?.[1] ?? "Menu";

  function selectTab(value: string) {
    onChange(value);
    setMobileOpen(false);
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setMobileOpen(true)}
        className="inline-flex items-center justify-center rounded-lg border border-stone-200 p-2 text-stone-600 hover:bg-stone-50"
        aria-label="Open management menu"
      >
        <Menu className="h-5 w-5" />
      </button>

      {mobileOpen ? (
        <div className="fixed inset-0 z-50">
          <button
            type="button"
            className="absolute inset-0 bg-black/30"
            aria-label="Close menu"
            onClick={() => setMobileOpen(false)}
          />
          <div className="absolute top-0 right-0 bottom-0 flex w-[min(20rem,85vw)] flex-col bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-stone-200 px-4 py-3">
              <p className="text-sm font-medium text-stone-700">{activeLabel}</p>
              <button
                type="button"
                onClick={() => setMobileOpen(false)}
                className="rounded-lg p-1 text-stone-500 hover:bg-stone-100"
                aria-label="Close menu"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <nav className="overflow-y-auto p-2">
              {tabs.map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => selectTab(value)}
                  className={[
                    "w-full rounded-lg px-3 py-2.5 text-left text-sm font-medium",
                    activeTab === value
                      ? "bg-brand-deep/10 text-brand-deep"
                      : "text-stone-600 hover:bg-stone-50",
                  ].join(" ")}
                >
                  {label}
                </button>
              ))}
            </nav>
          </div>
        </div>
      ) : null}
    </>
  );
}

export function AdminTabBarDesktop({
  tabs,
  activeTab,
  onChange,
}: {
  tabs: ReadonlyArray<TabEntry>;
  activeTab: string;
  onChange: (tab: string) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const measureRef = useRef<HTMLDivElement>(null);
  const [visibleCount, setVisibleCount] = useState(tabs.length);
  const [overflowOpen, setOverflowOpen] = useState(false);

  const recalculate = useCallback(() => {
    const container = containerRef.current;
    const measure = measureRef.current;
    if (!container || !measure) return;

    const buttons = measure.querySelectorAll<HTMLButtonElement>("[data-tab-measure]");
    if (buttons.length === 0) return;

    const overflowButtonWidth = 44;
    const available = container.clientWidth;
    let used = 0;
    let fit = 0;

    for (let index = 0; index < buttons.length; index += 1) {
      const width = buttons[index].offsetWidth;
      const needsOverflow = index < buttons.length - 1;
      const reserved = needsOverflow ? overflowButtonWidth : 0;
      if (used + width + reserved > available) break;
      used += width;
      fit = index + 1;
    }

    if (fit === 0 && buttons.length > 0) {
      fit = 1;
    }

    setVisibleCount(fit);
  }, [tabs.length]);

  useEffect(() => {
    recalculate();
    const container = containerRef.current;
    if (!container) return;

    const observer = new ResizeObserver(() => recalculate());
    observer.observe(container);
    return () => observer.disconnect();
  }, [recalculate, tabs]);

  const visibleTabs = tabs.slice(0, visibleCount);
  const overflowTabs = tabs.slice(visibleCount);

  function selectTab(value: string) {
    onChange(value);
    setOverflowOpen(false);
  }

  return (
    <div ref={containerRef} className="relative w-full">
      <div
        ref={measureRef}
        className="pointer-events-none invisible absolute top-0 left-0 flex whitespace-nowrap"
        aria-hidden
      >
        {tabs.map(([value, label]) => (
          <button
            key={`measure-${value}`}
            type="button"
            data-tab-measure
            className="border-b-2 border-transparent px-4 py-2 text-sm font-medium"
          >
            {label}
          </button>
        ))}
      </div>

      <div className="flex items-center border-b border-stone-200">
        {visibleTabs.map(([value, label]) => (
          <button
            key={value}
            type="button"
            onClick={() => onChange(value)}
            className={[
              "shrink-0 cursor-pointer border-b-2 px-4 py-2 text-sm font-medium whitespace-nowrap",
              activeTab === value
                ? "border-brand-deep text-brand-deep"
                : "border-transparent text-stone-500 hover:text-stone-700",
            ].join(" ")}
          >
            {label}
          </button>
        ))}

        {overflowTabs.length > 0 ? (
          <div className="relative shrink-0">
            <button
              type="button"
              onClick={() => setOverflowOpen((open) => !open)}
              className={[
                "inline-flex items-center justify-center border-b-2 px-3 py-2 text-sm font-medium",
                overflowTabs.some(([value]) => value === activeTab)
                  ? "border-brand-deep text-brand-deep"
                  : "border-transparent text-stone-500 hover:text-stone-700",
              ].join(" ")}
              aria-label="More tabs"
              aria-expanded={overflowOpen}
            >
              <MoreHorizontal className="h-5 w-5" />
            </button>
            {overflowOpen ? (
              <>
                <button
                  type="button"
                  className="fixed inset-0 z-40"
                  aria-label="Close overflow menu"
                  onClick={() => setOverflowOpen(false)}
                />
                <div className="absolute top-full right-0 z-50 mt-1 min-w-[12rem] rounded-lg border border-stone-200 bg-white py-1 shadow-lg">
                  {overflowTabs.map(([value, label]) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => selectTab(value)}
                      className={[
                        "block w-full px-4 py-2 text-left text-sm",
                        activeTab === value
                          ? "bg-brand-deep/10 font-medium text-brand-deep"
                          : "text-stone-600 hover:bg-stone-50",
                      ].join(" ")}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
