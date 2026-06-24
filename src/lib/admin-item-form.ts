import {
  buildStructuredDetailsPayload,
  emptyStructuredDetails,
  parseStructuredDetails,
  type StructuredItemDetails,
} from "@/lib/admin-item-details";
import type { Category } from "@/lib/types";
import type { ItineraryItem } from "@/lib/schema";

export type ItemFormState = {
  id?: number;
  dayId: string;
  category: Category;
  title: string;
  summary: string;
  startDatetime: string;
  endDatetime: string;
  sortOrder: string;
  structured: StructuredItemDetails;
};

export function toDatetimeLocal(value: string | Date | null | undefined): string {
  if (!value) return "";
  const d = typeof value === "string" ? new Date(value) : value;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function emptyItemForm(category: Category = "flight"): ItemFormState {
  return {
    dayId: "",
    category,
    title: "",
    summary: "",
    startDatetime: "",
    endDatetime: "",
    sortOrder: "0",
    structured: emptyStructuredDetails(category),
  };
}

export function itemToForm(item: ItineraryItem): ItemFormState {
  const category = item.category as Category;
  return {
    id: item.id,
    dayId: item.dayId ? String(item.dayId) : "",
    category,
    title: item.title,
    summary: item.summary ?? "",
    startDatetime: toDatetimeLocal(item.startDatetime),
    endDatetime: toDatetimeLocal(item.endDatetime),
    sortOrder: String(item.sortOrder ?? 0),
    structured: parseStructuredDetails(category, item.details as Record<string, unknown>),
  };
}

export function buildItemApiPayload(form: ItemFormState) {
  return {
    dayId: form.dayId ? Number(form.dayId) : null,
    category: form.category,
    title: form.title.trim(),
    summary: form.summary || null,
    startDatetime: form.startDatetime || null,
    endDatetime: form.endDatetime || null,
    sortOrder: Number(form.sortOrder || 0),
    details: buildStructuredDetailsPayload(form.category, form.structured),
  };
}
