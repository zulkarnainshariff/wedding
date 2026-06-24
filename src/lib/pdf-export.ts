import type { ItineraryDay, ItineraryItem } from "@/lib/schema";
import {
  CATEGORY_META,
  CATEGORIES,
  formatDate,
  formatTravellerLabel,
  getAccommodationDetails,
  getActivityDetails,
  getCarRentalDetails,
  getFlightDetails,
  getPetRelocationDetails,
  type Category,
} from "@/lib/types";
import { formatSeatsSummary } from "@/lib/seats";

export type ExportOptions = {
  categories: Category[];
  groupByDay: boolean;
};

const PAGE_MARGIN = 14;
const LINE_HEIGHT = 5.5;

function addWrappedText(
  doc: import("jspdf").jsPDF,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
): number {
  const lines = doc.splitTextToSize(text, maxWidth) as string[];
  doc.text(lines, x, y);
  return y + lines.length * LINE_HEIGHT;
}

function ensureSpace(
  doc: import("jspdf").jsPDF,
  y: number,
  needed = 20,
): number {
  const pageHeight = doc.internal.pageSize.getHeight();
  if (y + needed > pageHeight - PAGE_MARGIN) {
    doc.addPage();
    return PAGE_MARGIN + 10;
  }
  return y;
}

function formatItemBlock(item: ItineraryItem): string[] {
  const lines: string[] = [item.title];
  if (item.summary) lines.push(item.summary);

  if (item.category === "flight") {
    const d = getFlightDetails(item.details);
    if (!d) return lines;
    if (d.flightNumber) lines.push(`Flight: ${d.flightNumber}`);
    lines.push(`Route: ${d.from} → ${d.to}`);
    if (d.departureTime) lines.push(`Departs: ${d.departureTime}`);
    if (d.arrivalTime) lines.push(`Arrives: ${d.arrivalTime}`);
    if (d.departureTerminal || d.arrivalTerminal) {
      lines.push(
        `Terminals: ${[d.departureTerminal && `Dep ${d.departureTerminal}`, d.arrivalTerminal && `Arr ${d.arrivalTerminal}`].filter(Boolean).join(" · ")}`,
      );
    }
    if (d.aircraft) lines.push(`Aircraft: ${d.aircraft}`);
    const passengers = d.passengers ?? d.travellers;
    if (passengers.length) {
      lines.push(
        `Passengers: ${passengers.map((name) => formatTravellerLabel(name)).join(", ")}`,
      );
    }
    const refs = d.bookingReferences
      ? Object.entries(d.bookingReferences)
          .map(([n, r]) => `${formatTravellerLabel(n)}: ${r}`)
          .join(" · ")
      : d.bookingReference;
    if (refs) lines.push(`Booking ref: ${refs}`);
    if (d.baggage) {
      const bag = Object.entries(d.baggage)
        .map(([n, kg]) =>
          kg == null
            ? `${formatTravellerLabel(n)}: N/A`
            : `${formatTravellerLabel(n)}: ${kg}kg`,
        )
        .join(" · ");
      lines.push(`Baggage: ${bag}`);
    }
    lines.push(`Seats: ${formatSeatsSummary(d.seats, passengers)}`);
    if (d.notes?.length) lines.push(`Notes: ${d.notes.join("; ")}`);
    return lines;
  }

  if (item.category === "pet_relocation") {
    const d = getPetRelocationDetails(item.details);
    if (!d) return lines;
    lines.push(`${d.petName} (${d.species}) · cargo via ${d.handler}`);
    lines.push(`Route: ${d.from} → ${d.to}`);
    if (d.notes?.length) lines.push(`Notes: ${d.notes.join("; ")}`);
    return lines;
  }

  if (item.category === "accommodation") {
    const d = getAccommodationDetails(item.details);
    if (!d) return lines;
    lines.push(`Status: ${d.bookingStatus}`);
    lines.push(`Location: ${d.location}`);
    const guests = Array.isArray(d.guests) ? d.guests.join(", ") : d.guests;
    lines.push(`Guests: ${guests}`);
    if (d.address) lines.push(`Address: ${d.address}`);
    if (d.checkInDate) {
      lines.push(`Check-in: ${d.checkInDate} at ${d.checkInTime}`);
    }
    if (d.checkOutDate) {
      lines.push(`Check-out: ${d.checkOutDate} at ${d.checkOutTime}`);
    }
    if (d.listingUrl) lines.push(`Listing: ${d.listingUrl}`);
    if (d.suggestions?.length) {
      lines.push(
        `Suggestions: ${d.suggestions.map((s) => `${s.label} (${s.url})`).join("; ")}`,
      );
    }
    if (d.notes?.length) lines.push(`Notes: ${d.notes.join("; ")}`);
    return lines;
  }

  if (item.category === "car_rental") {
    const d = getCarRentalDetails(item.details);
    if (!d) return lines;
    lines.push(`Status: ${d.bookingStatus === "suggested" ? "Not booked yet" : "Confirmed"}`);
    lines.push(`Company: ${d.company}`);
    lines.push(`Pickup: ${d.pickupLocation}`);
    if (d.mapUrl) lines.push(`Map: ${d.mapUrl}`);
    return lines;
  }

  if (item.category === "activity") {
    const d = getActivityDetails(item.details);
    if (!d) return lines;
    if (d.time) lines.push(`Time: ${d.time}`);
    if (d.participants?.length) lines.push(`With: ${d.participants.join(", ")}`);
    if (d.description) lines.push(d.description);
    if (d.location?.name) lines.push(`Location: ${d.location.name}`);
    return lines;
  }

  return lines;
}

export async function generateItineraryPdf(
  days: ItineraryDay[],
  items: ItineraryItem[],
  options: ExportOptions,
): Promise<void> {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const contentWidth = pageWidth - PAGE_MARGIN * 2;

  const filtered = items.filter((item) =>
    options.categories.includes(item.category as Category),
  );

  if (filtered.length === 0) {
    throw new Error("No items selected for export.");
  }

  let y = PAGE_MARGIN + 6;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text("Wedding Travel Itinerary", PAGE_MARGIN, y);
  y += 10;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  y = addWrappedText(
    doc,
    `Exported ${new Date().toLocaleString("en-GB")}`,
    PAGE_MARGIN,
    y,
    contentWidth,
  );
  y += 6;

  const renderItem = (item: ItineraryItem) => {
    y = ensureSpace(doc, y, 30);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    const categoryLabel =
      CATEGORY_META[item.category as Category]?.label ?? item.category;
    y = addWrappedText(doc, categoryLabel, PAGE_MARGIN, y, contentWidth);
    y += 1;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    for (const line of formatItemBlock(item)) {
      y = ensureSpace(doc, y);
      y = addWrappedText(doc, line, PAGE_MARGIN, y, contentWidth);
      y += 1;
    }
    y += 4;
  };

  if (options.groupByDay) {
    const dayById = Object.fromEntries(days.map((d) => [d.id, d]));
    const byDate = new Map<string, ItineraryItem[]>();

    for (const item of filtered) {
      const day = item.dayId ? dayById[item.dayId] : null;
      const key = day?.date ?? item.eventDate ?? "unscheduled";
      if (!byDate.has(key)) byDate.set(key, []);
      byDate.get(key)!.push(item);
    }

    const sortedDates = [...byDate.keys()].sort();

    for (const date of sortedDates) {
      const day = days.find((d) => d.date === date);
      y = ensureSpace(doc, y, 16);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(13);
      const heading = day
        ? `Day ${day.dayNumber} — ${formatDate(day.date)}`
        : date === "unscheduled"
          ? "Unscheduled"
          : formatDate(date);
      y = addWrappedText(doc, heading, PAGE_MARGIN, y, contentWidth);
      if (day?.title) {
        doc.setFont("helvetica", "normal");
        doc.setFontSize(10);
        y = addWrappedText(doc, day.title, PAGE_MARGIN, y + 1, contentWidth);
      }
      y += 4;

      for (const item of byDate.get(date)!) {
        renderItem(item);
      }
      y += 2;
    }
  } else {
    for (const category of CATEGORIES) {
      if (!options.categories.includes(category)) continue;
      const categoryItems = filtered.filter((i) => i.category === category);
      if (categoryItems.length === 0) continue;

      y = ensureSpace(doc, y, 16);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(14);
      y = addWrappedText(
        doc,
        CATEGORY_META[category].plural,
        PAGE_MARGIN,
        y,
        contentWidth,
      );
      y += 4;

      for (const item of categoryItems) {
        renderItem(item);
      }
      y += 4;
    }
  }

  doc.save(`wedding-itinerary-${new Date().toISOString().slice(0, 10)}.pdf`);
}
