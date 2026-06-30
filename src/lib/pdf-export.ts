import { formatBookingGroupsDisplay } from "@/lib/booking-groups";
import type { ItineraryDay, ItineraryItem } from "@/lib/schema";
import { formatClockTimeWithPrefs } from "@/lib/display-format";
import { resolveFlightSchedule } from "@/lib/flight-datetime";
import {
  formatFlightNumberDisplay,
  formatJourneyFlightLabel,
  normalizeFlightDetails,
} from "@/lib/flight-numbers";
import { formatFlightSeatsSummary } from "@/lib/flight-seats";
import {
  formatTravellerLabel,
  getAccommodationDetails,
  getActivityDetails,
  getCarRentalDetails,
  getFlightDetails,
  getPetRelocationDetails,
  type Category,
  type FlightDetails,
  type FlightSegment,
} from "@/lib/types";
import {
  DEFAULT_USER_PREFERENCES,
  type UserPreferences,
} from "@/lib/user-preferences";

export type ExportOptions = {
  categories: Category[];
  groupByDay: boolean;
  preferences?: UserPreferences;
};

let activePdfPreferences = DEFAULT_USER_PREFERENCES;

const PAGE_MARGIN = 14;
const LINE_HEIGHT = 3.3;
const BLOCK_PAD_TOP = 4.5;
const BLOCK_PAD_BOTTOM = 0.05;
const BLOCK_INSET = 2.5;
const BLOCK_GAP = 2.8;
const TRANSIT_BEFORE_PULL = 1.1;
const TRANSIT_AFTER_GAP = 3.5;
const TAG_HEIGHT = 3.8;
const TAG_PAD_X = 2;
const NAVY = [30, 58, 95] as const;
const BORDER = [100, 100, 100] as const;
const TAG_RED_BG = [254, 226, 226] as const;
const TAG_RED_TEXT = [185, 28, 28] as const;
const TRANSIT_BG = 223; // 12.5% gray on white
const ROUTE_ARROW_GAP = 1.4;
const ROUTE_ARROW_WIDTH = 5.2;

type PdfDoc = import("jspdf").jsPDF;

type BlockLine = {
  text: string;
  route?: string[];
  size?: number;
  bold?: boolean;
  indent?: number;
  tag?: string | null;
  transit?: boolean;
  gapAfter?: number;
};

class PdfWriter {
  y = PAGE_MARGIN + 4;

  constructor(
    readonly doc: PdfDoc,
    readonly contentWidth: number,
    readonly pageHeight: number,
  ) {}

  get pageBottom(): number {
    return this.pageHeight - PAGE_MARGIN;
  }

  get remaining(): number {
    return this.pageBottom - this.y;
  }

  newPage(): void {
    this.doc.addPage();
    this.y = PAGE_MARGIN + 4;
  }

  ensureSpace(needed: number, keepTogether = false): void {
    if (needed <= this.remaining) return;
    if (keepTogether && needed <= this.pageHeight - PAGE_MARGIN * 2 - 6) {
      this.newPage();
      return;
    }
    if (this.remaining < LINE_HEIGHT * 2) {
      this.newPage();
    }
  }

  private setStyle({
    size = 9,
    bold = false,
    color = [0, 0, 0] as const,
  }: {
    size?: number;
    bold?: boolean;
    color?: readonly [number, number, number];
  }) {
    this.doc.setFont("helvetica", bold ? "bold" : "normal");
    this.doc.setFontSize(size);
    this.doc.setTextColor(color[0], color[1], color[2]);
  }

  lineWidth(
    text: string,
    size = 9,
    indent = 0,
    maxWidth?: number,
  ): number {
    this.doc.setFontSize(size);
    const lines = this.doc.splitTextToSize(
      text,
      (maxWidth ?? this.contentWidth) - indent,
    ) as string[];
    return lines.length * LINE_HEIGHT;
  }

  measureTransit(text: string, size = 8): number {
    const boxWidth = this.contentWidth - BLOCK_INSET * 4;
    this.doc.setFontSize(size);
    const lines = this.doc.splitTextToSize(text, boxWidth) as string[];
    const innerPad = LINE_HEIGHT * 0.35;
    return (
      lines.length * LINE_HEIGHT +
      innerPad * 2 +
      TRANSIT_AFTER_GAP -
      TRANSIT_BEFORE_PULL
    );
  }

  measureRouteLine(airports: string[], size = 9, indent = 0): number {
    if (!airports.length) return LINE_HEIGHT;
    this.doc.setFontSize(size);
    let total = 0;
    for (let i = 0; i < airports.length; i++) {
      total += this.doc.getTextWidth(airports[i]);
      if (i < airports.length - 1) {
        total += ROUTE_ARROW_GAP + ROUTE_ARROW_WIDTH + ROUTE_ARROW_GAP;
      }
    }
    const maxWidth = this.contentWidth - BLOCK_INSET * 2 - indent;
    if (total <= maxWidth) return LINE_HEIGHT;
    return LINE_HEIGHT * Math.ceil(total / maxWidth);
  }

  measureBlock(lines: BlockLine[]): number {
    let height = BLOCK_PAD_TOP + BLOCK_PAD_BOTTOM;
    for (const line of lines) {
      if (line.transit) {
        height += this.measureTransit(line.text, line.size ?? 8);
      } else if (line.tag) {
        height += LINE_HEIGHT;
      } else if (line.route?.length) {
        height += this.measureRouteLine(
          line.route,
          line.size ?? 9,
          line.indent ?? 0,
        );
      } else {
        height += this.lineWidth(
          line.text,
          line.size ?? 9,
          line.indent ?? 0,
        );
      }
      height += line.gapAfter ?? 0;
    }
    return height + BLOCK_GAP;
  }

  drawTag(label: string, x: number, y: number, size = 7): number {
    this.setStyle({ size, bold: true, color: TAG_RED_TEXT });
    const textWidth = this.doc.getTextWidth(label);
    const width = textWidth + TAG_PAD_X * 2;
    const top = y - TAG_HEIGHT + 0.8;
    this.doc.setFillColor(TAG_RED_BG[0], TAG_RED_BG[1], TAG_RED_BG[2]);
    this.doc.roundedRect(x, top, width, TAG_HEIGHT, 1, 1, "F");
    this.doc.text(label, x + TAG_PAD_X, y - 0.5);
    this.doc.setTextColor(0, 0, 0);
    return width;
  }

  private drawTransitLine(text: string, size = 8): void {
    const boxX = PAGE_MARGIN + BLOCK_INSET * 2;
    const boxWidth = this.contentWidth - BLOCK_INSET * 4;
    this.doc.setFontSize(size);
    const lines = this.doc.splitTextToSize(text, boxWidth) as string[];
    const innerPad = LINE_HEIGHT * 0.35;
    const boxHeight = lines.length * LINE_HEIGHT + innerPad * 2;
    this.y -= TRANSIT_BEFORE_PULL;
    this.ensureSpace(boxHeight + TRANSIT_AFTER_GAP);
    const boxY = this.y;
    this.doc.setFillColor(TRANSIT_BG, TRANSIT_BG, TRANSIT_BG);
    this.doc.rect(boxX, boxY, boxWidth, boxHeight, "F");
    this.setStyle({ size, bold: true });
    let textY = boxY + innerPad + LINE_HEIGHT - 0.3;
    for (const line of lines) {
      const textWidth = this.doc.getTextWidth(line);
      this.doc.text(line, boxX + (boxWidth - textWidth) / 2, textY);
      textY += LINE_HEIGHT;
    }
    this.y = boxY + boxHeight + TRANSIT_AFTER_GAP;
  }

  private drawRouteArrow(x: number, baselineY: number): void {
    const shaftLen = 3.4;
    const head = 1.1;
    const y = baselineY - 1.15;
    this.doc.setDrawColor(35, 35, 35);
    this.doc.setLineWidth(0.42);
    this.doc.line(x, y, x + shaftLen, y);
    const tipX = x + shaftLen + head;
    this.doc.line(x + shaftLen, y - head * 0.75, tipX, y);
    this.doc.line(tipX, y, x + shaftLen, y + head * 0.75);
  }

  private drawRouteLine(
    airports: string[],
    size: number,
    bold: boolean,
    indent: number,
  ): void {
    if (!airports.length) return;
    this.ensureSpace(LINE_HEIGHT);
    this.setStyle({ size, bold });
    let x = PAGE_MARGIN + BLOCK_INSET + indent;
    for (let i = 0; i < airports.length; i++) {
      this.doc.text(airports[i], x, this.y);
      x += this.doc.getTextWidth(airports[i]);
      if (i < airports.length - 1) {
        x += ROUTE_ARROW_GAP;
        this.drawRouteArrow(x, this.y);
        x += ROUTE_ARROW_WIDTH + ROUTE_ARROW_GAP;
      }
    }
    this.y += LINE_HEIGHT;
  }

  private drawLine(line: BlockLine): void {
    const size = line.size ?? 9;
    const indent = line.indent ?? 0;
    const x = PAGE_MARGIN + BLOCK_INSET + indent;

    if (line.route?.length) {
      this.drawRouteLine(line.route, size, line.bold ?? false, indent);
      this.y += line.gapAfter ?? 0;
      return;
    }

    if (line.tag) {
      this.ensureSpace(LINE_HEIGHT + 1);
      this.setStyle({ size, bold: line.bold });
      this.doc.text(line.text, x, this.y);
      const textWidth = this.doc.getTextWidth(line.text);
      this.drawTag(line.tag, x + textWidth + 3, this.y, 6.5);
      this.y += LINE_HEIGHT;
      return;
    }

    this.setStyle({ size, bold: line.bold });
    const maxWidth = this.contentWidth - BLOCK_INSET * 2 - indent;
    const wrapped = this.doc.splitTextToSize(line.text, maxWidth) as string[];
    for (const row of wrapped) {
      this.ensureSpace(LINE_HEIGHT);
      this.doc.text(row, x, this.y);
      this.y += LINE_HEIGHT;
    }
    if (line.gapAfter) this.y += line.gapAfter;
  }

  drawBlock(lines: BlockLine[], { bordered = true, keepTogether = true } = {}): void {
    if (!lines.length) return;

    const blockHeight = this.measureBlock(lines);
    this.ensureSpace(
      Math.min(blockHeight, this.pageHeight - PAGE_MARGIN * 2 - 6),
      keepTogether && blockHeight <= this.pageHeight - PAGE_MARGIN * 2 - 6,
    );

    const startY = this.y;
    this.y += BLOCK_PAD_TOP;

    for (const line of lines) {
      if (line.transit) {
        this.drawTransitLine(line.text, line.size ?? 8);
      } else {
        this.drawLine(line);
      }
    }

    this.y += BLOCK_PAD_BOTTOM;

    if (bordered) {
      const height = this.y - startY;
      this.doc.setDrawColor(BORDER[0], BORDER[1], BORDER[2]);
      this.doc.setLineWidth(0.35);
      this.doc.rect(PAGE_MARGIN, startY, this.contentWidth, height);
    }

    this.y += BLOCK_GAP;
  }

  writeHeading(text: string, size = 13): void {
    this.ensureSpace(10, true);
    this.y += 4.5;
    this.setStyle({ size, bold: true, color: NAVY });
    this.doc.text(text, PAGE_MARGIN, this.y);
    this.y += LINE_HEIGHT + 0.8;
  }

  writeSubheading(text: string): void {
    this.ensureSpace(8, true);
    this.y += 3;
    this.setStyle({ size: 10, bold: true });
    this.doc.text(text, PAGE_MARGIN, this.y);
    this.y += LINE_HEIGHT + 0.6;
  }

  writePlain(text: string, size = 10): void {
    this.setStyle({ size });
    this.doc.text(text, PAGE_MARGIN, this.y);
    this.y += LINE_HEIGHT + 1;
  }

  gap(amount = 2): void {
    this.y += amount;
  }
}

function ordinalSuffix(day: number): string {
  if (day % 10 === 1 && day % 100 !== 11) return "st";
  if (day % 10 === 2 && day % 100 !== 12) return "nd";
  if (day % 10 === 3 && day % 100 !== 13) return "rd";
  return "th";
}

function formatOrdinalDate(dateStr: string, includeYear = true): string {
  const date = new Date(`${dateStr}T12:00:00`);
  const day = date.getDate();
  const month = date.toLocaleDateString("en-GB", { month: "long" });
  const weekday = date.toLocaleDateString("en-GB", { weekday: "short" });
  const year = date.getFullYear();
  const base = `${day}${ordinalSuffix(day)} ${month}`;
  return includeYear ? `${base} ${year}, ${weekday}` : `${base}`;
}

function formatShortDailyDate(dateStr: string): string {
  const date = new Date(`${dateStr}T12:00:00`);
  return `${date.getDate()}${ordinalSuffix(date.getDate())} ${date.toLocaleDateString("en-GB", { month: "long" })}`;
}

function formatPdfClock(time: string | null | undefined): string {
  if (!time?.trim()) return "TBC";
  return formatClockTimeWithPrefs(time, activePdfPreferences);
}

function buildSimpleRouteAirports(
  from?: string | null,
  to?: string | null,
): string[] {
  const chain: string[] = [];
  pushAirport(chain, from);
  pushAirport(chain, to);
  return chain.length ? chain : ["—"];
}

function buildFlightRouteAirports(details: FlightDetails): string[] {
  const chain: string[] = [];

  if (details.segments?.length) {
    for (const segment of details.segments) {
      if (segment.transit) {
        pushAirport(
          chain,
          segment.airport?.trim().toUpperCase() ??
            extractTransitAirport(segment.transit),
        );
        continue;
      }
      pushAirport(chain, segmentAirportCode(segment, "from"));
      pushAirport(chain, segmentAirportCode(segment, "to"));
    }
    if (chain.length >= 2) return chain;
  }

  return buildSimpleRouteAirports(
    details.fromIata ?? details.from,
    details.toIata ?? details.to,
  );
}

function routeLine(
  airports: string[],
  opts: Omit<BlockLine, "text" | "route"> = {},
): BlockLine {
  return { text: "", route: airports, ...opts };
}

function segmentAirportCode(
  segment: FlightSegment,
  endpoint: "from" | "to",
): string | null {
  const raw =
    endpoint === "from"
      ? segment.fromIata ?? segment.from
      : segment.toIata ?? segment.to;
  const code = raw?.trim().toUpperCase();
  return code || null;
}

function pushAirport(chain: string[], code: string | null | undefined): void {
  if (!code?.trim()) return;
  const normalized = code.trim().toUpperCase();
  if (!chain.length || chain[chain.length - 1] !== normalized) {
    chain.push(normalized);
  }
}

function extractTransitAirport(transit: string): string | null {
  const inMatch = /\bin\s+([A-Za-z]{3})\b/i.exec(transit);
  if (inMatch) return inMatch[1].toUpperCase();
  const codeMatch = /\b([A-Z]{3})\b/.exec(transit);
  return codeMatch?.[1] ?? null;
}

function formatDepartureArrivalLine(
  departure: string,
  arrival: string,
  extra?: string | null,
): string {
  const parts = [`Dep: ${departure}`, `Arrival: ${arrival}`];
  if (extra) parts.push(extra);
  return parts.join("  ");
}

function formatTravellerList(names: string[], cargoParty: string[] = []): string {
  const cargo = new Set(cargoParty);
  return names.map((name) => formatTravellerLabel(name, cargo.has(name))).join(" / ");
}

export function formatGroupedBookingRefs(
  bookingReferences?: Record<string, string>,
  fallback?: string | null,
  bookingGroups?: import("./booking-groups").BookingGroup[],
): string | null {
  if (bookingGroups && bookingGroups.length > 0) {
    return formatBookingGroupsDisplay(bookingGroups, bookingReferences, fallback);
  }
  if (bookingReferences && Object.keys(bookingReferences).length > 0) {
    const byRef = new Map<string, string[]>();
    for (const [name, ref] of Object.entries(bookingReferences)) {
      const key = ref.trim();
      if (!key) continue;
      const list = byRef.get(key) ?? [];
      list.push(formatTravellerLabel(name));
      byRef.set(key, list);
    }
    const grouped = [...byRef.entries()]
      .map(([ref, names]) => `${names.join(" / ")}: ${ref}`)
      .join(" · ");
    return grouped || null;
  }
  return fallback?.trim() || null;
}

function getItemDate(
  item: ItineraryItem,
  dayById: Record<number, ItineraryDay>,
): string | null {
  if (item.eventDate) return item.eventDate;
  if (item.dayId && dayById[item.dayId]) return dayById[item.dayId].date;
  if (item.startDatetime) {
    return new Date(item.startDatetime).toISOString().slice(0, 10);
  }
  return null;
}

function sortByDateThenOrder(
  items: ItineraryItem[],
  dayById: Record<number, ItineraryDay>,
): ItineraryItem[] {
  return [...items].sort((a, b) => {
    const dateA = getItemDate(a, dayById) ?? "9999-12-31";
    const dateB = getItemDate(b, dayById) ?? "9999-12-31";
    if (dateA !== dateB) return dateA.localeCompare(dateB);
    return a.sortOrder - b.sortOrder;
  });
}

function isFlightLike(item: ItineraryItem): boolean {
  return item.category === "flight" || item.category === "pet_relocation";
}

function flightUnbookedTag(item: ItineraryItem): string | null {
  if (item.category === "pet_relocation") {
    return getPetRelocationDetails(item.details)?.status === "tbc" ? "TBC" : null;
  }
  return getFlightDetails(item.details)?.status === "tbc" ? "TBC" : null;
}

function stayUnbookedTag(item: ItineraryItem): string | null {
  return getAccommodationDetails(item.details)?.bookingStatus === "suggested"
    ? "NOT BOOKED"
    : null;
}

function carUnbookedTag(item: ItineraryItem): string | null {
  return getCarRentalDetails(item.details)?.bookingStatus === "suggested"
    ? "NOT BOOKED"
    : null;
}

function formatArrivalWithDayNote(item: ItineraryItem, details: FlightDetails): string {
  const arrival = formatPdfClock(details.arrivalTime);
  if (arrival === "TBC") return "TBC";

  const schedule = resolveFlightSchedule({
    eventDate: item.eventDate,
    startDatetime: item.startDatetime,
    endDatetime: item.endDatetime,
    details: item.details,
  });

  const depDate = schedule.eventDate ?? item.eventDate;
  const arrDate = schedule.arrivalDate;

  if (!arrDate || !depDate || arrDate === depDate) return arrival;

  return `${arrival} • ${formatOrdinalDate(arrDate)}`;
}

function formatBaggageSummary(
  baggage: Record<string, number | null> | undefined,
  cargoParty: string[] = [],
): string | null {
  if (!baggage) return null;
  const cargo = new Set(cargoParty);
  const weights = Object.entries(baggage)
    .filter(([name]) => !cargo.has(name))
    .map(([, kg]) => kg)
    .filter((kg): kg is number => kg != null);

  if (!weights.length) return null;
  if (new Set(weights).size === 1) {
    return `${weights[0]}kg x ${weights.length}`;
  }

  return Object.entries(baggage)
    .map(([name, kg]) =>
      cargo.has(name) || kg == null
        ? `${formatTravellerLabel(name, true)}: N/A`
        : `${formatTravellerLabel(name)}: ${kg}kg`,
    )
    .join(" · ");
}

function flightNumberLabel(details: FlightDetails): string {
  const display = formatJourneyFlightLabel(normalizeFlightDetails(details));
  if (display) return display;
  return details.status === "tbc" ? "TBC" : "—";
}

function flightTravellerHeading(item: ItineraryItem): string {
  if (item.category === "pet_relocation") {
    const details = getPetRelocationDetails(item.details);
    if (!details) return item.title;
    return `${formatTravellerLabel(details.petName)} (Pet Relocation flight)`;
  }
  const details = getFlightDetails(item.details);
  if (!details) return item.title;
  return formatTravellerList(
    details.passengers ?? details.travellers,
    details.cargoParty,
  );
}

function formatTransitLabel(segment: FlightSegment): string {
  const airport =
    segment.airport?.trim().toUpperCase() ??
    extractTransitAirport(segment.transit ?? "");
  const duration = segment.transit?.replace(/^Transit\s+/i, "").trim();
  const label = airport
    ? duration
      ? `Transit ${duration} in ${airport}`
      : `Transit in ${airport}`
    : segment.transit?.startsWith("Transit")
      ? segment.transit
      : `Transit ${segment.transit ?? ""}`.trim();
  return `— ${label} —`;
}

function segmentLines(segment: FlightSegment): BlockLine[] {
  if (segment.transit) {
    return [{ text: formatTransitLabel(segment), transit: true, size: 8 }];
  }

  const number =
    formatFlightNumberDisplay(
      segment.marketingFlightNumber,
      segment.operatingFlightNumber,
    ) || segment.flightNumber;
  const lines: BlockLine[] = [
    { text: number ?? "—", bold: true, indent: 2, size: 8.5 },
    routeLine(
      buildSimpleRouteAirports(
        segment.fromIata ?? segment.from,
        segment.toIata ?? segment.to,
      ),
      { indent: 2, size: 8.5 },
    ),
    {
      text: formatDepartureArrivalLine(
        formatPdfClock(segment.departureTime),
        formatPdfClock(segment.arrivalTime),
        segment.flightTime ? `Flight Time: ${segment.flightTime}` : null,
      ),
      indent: 2,
      size: 8.5,
    },
  ];

  if (segment.departureTerminal || segment.arrivalTerminal) {
    lines.push({
      text: `Terminal ${segment.departureTerminal ?? "—"} Terminal ${segment.arrivalTerminal ?? "—"}`,
      indent: 2,
      size: 8.5,
    });
  }
  if (segment.aircraft) {
    lines.push({ text: `A/C ${segment.aircraft}`, indent: 2, size: 8.5 });
  }
  return lines;
}

function buildFlightAtAGlanceBlock(
  item: ItineraryItem,
  dayById: Record<number, ItineraryDay>,
): BlockLine[] | null {
  const date = getItemDate(item, dayById);
  if (!date) return null;

  const tag = flightUnbookedTag(item);
  const lines: BlockLine[] = [
    { text: formatOrdinalDate(date), bold: true, tag },
    { text: flightTravellerHeading(item) },
  ];

  if (item.category === "pet_relocation") {
    const details = getPetRelocationDetails(item.details);
    if (!details) return lines;
    lines.push(routeLine(buildSimpleRouteAirports(details.from, details.to)));
    lines.push({
      text:
        details.departureTime || details.arrivalTime
          ? formatDepartureArrivalLine(
              formatPdfClock(details.departureTime),
              formatPdfClock(details.arrivalTime),
            )
          : "Dep: TBC  Arrival: TBC",
    });
    return lines;
  }

  const details = getFlightDetails(item.details);
  if (!details) return lines;
  lines.push(routeLine(buildFlightRouteAirports(details)));
  const dep = formatPdfClock(details.departureTime);
  const arr = formatArrivalWithDayNote(item, details);
  lines.push({
    text: tag
      ? "Dep: TBC  Arrival: TBC"
      : formatDepartureArrivalLine(dep, arr),
  });
  return lines;
}

function buildFlightDetailsBlock(
  item: ItineraryItem,
  dayById: Record<number, ItineraryDay>,
): BlockLine[] | null {
  const date = getItemDate(item, dayById);
  if (!date) return null;

  const tag = flightUnbookedTag(item);
  const lines: BlockLine[] = [
    { text: formatOrdinalDate(date), bold: true, tag },
    { text: flightTravellerHeading(item) },
  ];

  if (item.category === "pet_relocation") {
    const details = getPetRelocationDetails(item.details);
    if (!details) return lines;
    lines.push({
      text: `Flight No ${details.status === "tbc" ? "TBC" : "—"}`,
      bold: true,
    });
    lines.push(routeLine(buildSimpleRouteAirports(details.from, details.to)));
    lines.push({
      text:
        details.departureTime || details.arrivalTime
          ? formatDepartureArrivalLine(
              formatPdfClock(details.departureTime),
              formatPdfClock(details.arrivalTime),
            )
          : "Dep: TBC  Arrival: TBC",
    });
    if (details.notes?.length) {
      lines.push({ text: `Notes: ${details.notes.join("; ")}` });
    }
    return lines;
  }

  const details = normalizeFlightDetails(getFlightDetails(item.details)!);
  lines.push({ text: flightNumberLabel(details), bold: true });
  lines.push(routeLine(buildFlightRouteAirports(details)));
  lines.push({
    text: formatDepartureArrivalLine(
      formatPdfClock(details.departureTime),
      formatArrivalWithDayNote(item, details),
      details.totalFlightTime ? `Total Flight Time: ${details.totalFlightTime}` : null,
    ),
  });

  const refs = formatGroupedBookingRefs(
    details.bookingReferences,
    details.bookingReference,
    details.bookingGroups,
  );
  if (refs) {
    lines.push({ text: "Booking Reference" });
    lines.push({ text: refs });
  }

  const baggage = formatBaggageSummary(details.baggage, details.cargoParty);
  if (baggage) lines.push({ text: `Baggage ${baggage}` });
  if (details.aircraft) lines.push({ text: `A/C ${details.aircraft}` });

  const passengers = details.passengers ?? details.travellers;
  const seats = formatFlightSeatsSummary(details, passengers);
  if (seats && seats !== "—") lines.push({ text: `Seats: ${seats}` });
  if (details.notes?.length) lines.push({ text: `Note ${details.notes.join("; ")}` });

  if (details.segments?.length) {
    lines.push({ text: "Flight Details", bold: true, size: 8.5 });
    for (const segment of details.segments) {
      lines.push(...segmentLines(segment));
    }
  }

  return lines;
}

function formatStayRange(item: ItineraryItem): string {
  const details = getAccommodationDetails(item.details);
  if (!details) return item.title;

  let range = "";
  if (details.checkInDate) {
    const checkIn = new Date(`${details.checkInDate}T12:00:00`);
    const checkInDay = checkIn.getDate();
    const checkInMonth = checkIn.toLocaleDateString("en-GB", { month: "long" });
    if (details.checkOutDate) {
      const checkOut = new Date(`${details.checkOutDate}T12:00:00`);
      const checkOutDay = checkOut.getDate();
      if (checkInMonth === checkOut.toLocaleDateString("en-GB", { month: "long" })) {
        range = `${checkInDay}${ordinalSuffix(checkInDay)} to ${checkOutDay}${ordinalSuffix(checkOutDay)} ${checkInMonth}`;
      } else {
        range = `${formatShortDailyDate(details.checkInDate)} to ${formatShortDailyDate(details.checkOutDate)}`;
      }
    } else {
      range = `${checkInDay}${ordinalSuffix(checkInDay)} ${checkInMonth} onwards`;
    }
  }

  const guests = Array.isArray(details.guests)
    ? details.guests.join(" / ")
    : details.guests;
  const platform =
    details.platform === "private-home"
      ? "Private stay"
      : details.platform === "airbnb"
        ? "AirBNB"
        : details.platform;

  return [range, guests, platform, details.location].filter(Boolean).join(" – ");
}

function formatActivityTime(time: string | null | undefined): string {
  if (!time?.trim()) return "";
  const formatted = formatClockTimeWithPrefs(time, activePdfPreferences);
  return formatted === "—" ? time.trim() : formatted;
}

function normalizeActivityText(value: string): string {
  return value
    .trim()
    .replace(/\.+$/g, "")
    .replace(/\s+/g, " ")
    .toLowerCase();
}

function isRedundantActivityDescription(title: string, description: string): boolean {
  const titleNorm = normalizeActivityText(title);
  const descNorm = normalizeActivityText(description);
  if (!descNorm || titleNorm === descNorm) return true;

  const stripLead = (value: string) =>
    value.replace(
      /^(get|take|drive to|arrive at|arrive in|leave for|head to|head directly to|check in at|check out from|collect|park car with)\s+/i,
      "",
    );

  if (normalizeActivityText(stripLead(descNorm)) === normalizeActivityText(stripLead(titleNorm))) {
    return true;
  }

  if (descNorm.includes(titleNorm) && descNorm.length - titleNorm.length <= 24) {
    return true;
  }

  return false;
}

function activityLineText(item: ItineraryItem): string {
  const details = getActivityDetails(item.details);
  const time = formatActivityTime(details?.time);
  const description = details?.description?.trim();

  if (description && !isRedundantActivityDescription(item.title, description)) {
    return time ? `• ${time} – ${description}` : `• ${description}`;
  }

  return time ? `• ${time} – ${item.title}` : `• ${item.title}`;
}

function collectDateRange(
  items: ItineraryItem[],
  days: ItineraryDay[],
  dayById: Record<number, ItineraryDay>,
): string | null {
  const dates = [
    ...days.map((day) => day.date),
    ...items.map((item) => getItemDate(item, dayById)).filter(Boolean),
  ] as string[];
  if (!dates.length) return null;
  dates.sort();
  return `${formatOrdinalDate(dates[0])} – ${formatOrdinalDate(dates[dates.length - 1])}`;
}

function renderItinerary(
  writer: PdfWriter,
  days: ItineraryDay[],
  items: ItineraryItem[],
  options: ExportOptions,
): void {
  activePdfPreferences = options.preferences ?? DEFAULT_USER_PREFERENCES;

  const dayById = Object.fromEntries(days.map((day) => [day.id, day]));
  const filtered = items.filter((item) =>
    options.categories.includes(item.category as Category),
  );
  if (!filtered.length) {
    throw new Error("No items selected for export.");
  }

  const dateRange = collectDateRange(filtered, days, dayById);
  writer.writeHeading("Wedding Trip", 16);
  if (dateRange) writer.writePlain(dateRange, 9);
  writer.gap(3);

  const flightItems = filtered.filter(isFlightLike);
  const stayItems = filtered.filter((item) => item.category === "accommodation");
  const activityItems = filtered.filter((item) => item.category === "activity");
  const carItems = filtered.filter((item) => item.category === "car_rental");
  const insuranceItems = filtered.filter(
    (item) => item.category === "travel_insurance",
  );

  if (flightItems.length) {
    writer.writeHeading("Flight Itineraries");
    writer.writeSubheading("At A Glance");
    for (const item of sortByDateThenOrder(flightItems, dayById)) {
      const block = buildFlightAtAGlanceBlock(item, dayById);
      if (block) writer.drawBlock(block);
    }

    writer.writeSubheading("Flight Details");
    for (const item of sortByDateThenOrder(flightItems, dayById)) {
      const block = buildFlightDetailsBlock(item, dayById);
      if (!block) continue;
      const maxPageBlock = writer.pageHeight - PAGE_MARGIN * 2 - 8;
      if (writer.measureBlock(block) > maxPageBlock) {
        const headerEnd = block.findIndex((line) => line.text === "Flight Details");
        if (headerEnd === -1) {
          writer.drawBlock(block, { keepTogether: false });
        } else {
          writer.drawBlock(block.slice(0, headerEnd));
          writer.drawBlock(block.slice(headerEnd), { keepTogether: false });
        }
      } else {
        writer.drawBlock(block);
      }
    }
  }

  if (stayItems.length) {
    writer.writeHeading("Accommodations");
    for (const item of sortByDateThenOrder(stayItems, dayById)) {
      writer.drawBlock([
        {
          text: formatStayRange(item),
          tag: stayUnbookedTag(item),
        },
      ]);
    }
    writer.gap(1);
  }

  if (activityItems.length) {
    writer.writeHeading("Daily Itinerary");
    if (options.groupByDay) {
      const byDay = new Map<number, ItineraryItem[]>();
      for (const item of sortByDateThenOrder(activityItems, dayById)) {
        if (!item.dayId) continue;
        const list = byDay.get(item.dayId) ?? [];
        list.push(item);
        byDay.set(item.dayId, list);
      }

      for (const day of days.filter((entry) => byDay.has(entry.id))) {
        const dayItems = byDay.get(day.id) ?? [];
        const lines: BlockLine[] = [
          {
            text: `${formatShortDailyDate(day.date)} ${day.title ?? dayItems[0]?.title ?? ""}`.trim(),
            bold: true,
          },
        ];
        for (const item of dayItems) {
          lines.push({
            text: activityLineText(item),
            indent: 2,
            size: 8.5,
          });
        }
        writer.drawBlock(lines);
      }
    } else {
      for (const item of activityItems) {
        const date = item.eventDate ?? "";
        const prefix = date ? `${formatShortDailyDate(date)} ` : "";
        const body = activityLineText(item).replace(/^•\s*/, "");
        writer.drawBlock([
          {
            text: `${prefix}${body}`,
          },
        ]);
      }
    }
  }

  if (carItems.length) {
    writer.writeHeading("Car Rentals");
    for (const item of sortByDateThenOrder(carItems, dayById)) {
      const lines: BlockLine[] = [
        { text: item.title, bold: true, tag: carUnbookedTag(item) },
      ];
      if (item.summary) lines.push({ text: item.summary, indent: 2, size: 8.5 });
      writer.drawBlock(lines);
    }
  }

  if (insuranceItems.length) {
    writer.writeHeading("Travel Insurance");
    for (const item of sortByDateThenOrder(insuranceItems, dayById)) {
      const lines: BlockLine[] = [{ text: item.title, bold: true }];
      if (item.summary) lines.push({ text: item.summary, indent: 2, size: 8.5 });
      writer.drawBlock(lines);
    }
  }
}

export function itineraryPdfFilename(): string {
  return `wedding-trip-itinerary-${new Date().toISOString().slice(0, 10)}.pdf`;
}

export async function buildItineraryPdfBlob(
  days: ItineraryDay[],
  items: ItineraryItem[],
  options: ExportOptions,
): Promise<Blob> {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const writer = new PdfWriter(doc, pageWidth - PAGE_MARGIN * 2, pageHeight);
  renderItinerary(writer, days, items, options);
  return doc.output("blob");
}

export function downloadItineraryPdf(blob: Blob, filename = itineraryPdfFilename()): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export async function generateItineraryPdf(
  days: ItineraryDay[],
  items: ItineraryItem[],
  options: ExportOptions,
): Promise<void> {
  const blob = await buildItineraryPdfBlob(days, items, options);
  downloadItineraryPdf(blob);
}
