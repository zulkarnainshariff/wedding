export function getSubItemTimeLabel(item: {
  startDatetime: Date | string | null;
  details: unknown;
}): string | null {
  const details =
    item.details && typeof item.details === "object"
      ? (item.details as Record<string, unknown>)
      : {};
  if (typeof details.time === "string" && details.time.trim()) {
    return details.time.trim();
  }
  if (item.startDatetime) {
    const date = new Date(item.startDatetime);
    return date.toLocaleTimeString(undefined, {
      hour: "numeric",
      minute: "2-digit",
    });
  }
  return null;
}
