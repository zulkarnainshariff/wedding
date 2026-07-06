import { asc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { isAuthError, requireAuth, requireEditAccess } from "@/lib/api-auth";
import { db } from "@/lib/db";
import {
  buildStorageKey,
  ensureUploadDir,
  filterVisibleDocuments,
  isAllowedDocumentUpload,
  MAX_DOCUMENT_BYTES,
  parseExtraViewers,
  resolveDocumentMimeType,
  writeDocumentFile,
} from "@/lib/item-documents";
import {
  defaultDocumentCategoryForItem,
  isDocumentCategory,
} from "@/lib/document-categories";
import { filterItemsByPermission } from "@/lib/permissions";
import { itemDocuments, itineraryItems } from "@/lib/schema";
import { bumpSyncVersion } from "@/lib/sync";
import { normalizeTravellerName } from "@/lib/travellers";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  const user = await requireAuth();
  if (isAuthError(user)) return user;

  const { id: rawId } = await params;
  const itemId = Number(rawId);

  const [item] = await db
    .select()
    .from(itineraryItems)
    .where(eq(itineraryItems.id, itemId))
    .limit(1);

  if (!item) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const [authorized] = filterItemsByPermission([item], user);
  if (!authorized) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const docs = await db
    .select()
    .from(itemDocuments)
    .where(eq(itemDocuments.itemId, itemId))
    .orderBy(asc(itemDocuments.travellerName), asc(itemDocuments.label));

  return NextResponse.json(filterVisibleDocuments(docs, item, user));
}

export async function POST(request: Request, { params }: Params) {
  const user = await requireEditAccess();
  if (isAuthError(user)) return user;

  try {
    const { id: rawId } = await params;
    const itemId = Number(rawId);

    const [item] = await db
      .select()
      .from(itineraryItems)
      .where(eq(itineraryItems.id, itemId))
      .limit(1);

    if (!item) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const formData = await request.formData();
    const file = formData.get("file");
    const travellerName = String(formData.get("travellerName") ?? "").trim();
    const coveredRaw = String(formData.get("coveredTravellers") ?? "").trim();
    const coveredFromField = coveredRaw
      ? coveredRaw
          .split(",")
          .map((entry) => entry.trim())
          .filter(Boolean)
      : travellerName
        ? [travellerName]
        : [];
    const coversTravellers = [
      ...new Set(
        coveredFromField
          .map((name) => normalizeTravellerName(name))
          .filter(Boolean),
      ),
    ];
    const label = String(formData.get("label") ?? "").trim() || "Document";
    const categoryRaw = String(formData.get("category") ?? item.category).trim();
    const category = isDocumentCategory(categoryRaw)
      ? categoryRaw
      : defaultDocumentCategoryForItem(item.category);
    const extraViewers = parseExtraViewers(
      String(formData.get("extraViewers") ?? "")
        .split(",")
        .map((entry) => entry.trim()),
    );

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "File is required" }, { status: 400 });
    }

    if (!travellerName && coversTravellers.length === 0) {
      return NextResponse.json(
        { error: "At least one traveller is required" },
        { status: 400 },
      );
    }

    const primaryTraveller = normalizeTravellerName(
      travellerName || coversTravellers[0],
    );

    if (!isAllowedDocumentUpload(file.name, file.type || null)) {
      return NextResponse.json(
        { error: "Only PDF and image files are allowed" },
        { status: 400 },
      );
    }

    if (file.size > MAX_DOCUMENT_BYTES) {
      return NextResponse.json(
        { error: "File is too large (max 12 MB)" },
        { status: 400 },
      );
    }

    const mimeType = resolveDocumentMimeType(file.name, file.type || null);
    const bytes = new Uint8Array(await file.arrayBuffer());
    const storageKey = buildStorageKey(itemId, file.name);
    await ensureUploadDir();
    await writeDocumentFile(storageKey, bytes);

    const [doc] = await db
      .insert(itemDocuments)
      .values({
        itemId,
        category,
        travellerName: primaryTraveller,
        coversTravellers:
          coversTravellers.length > 0 ? coversTravellers : [primaryTraveller],
        label,
        fileName: file.name,
        storageKey,
        mimeType,
        fileSize: file.size,
        uploadedByUserId: user.id,
        extraViewers: extraViewers,
      })
      .returning();

    await bumpSyncVersion();
    return NextResponse.json(doc, { status: 201 });
  } catch (error) {
    console.error("Document upload failed:", error);
    const message =
      error instanceof Error ? error.message : "Document upload failed";
    const hint =
      message.includes("EACCES") || message.includes("permission denied")
        ? "Server could not write the upload folder. Check data/uploads permissions."
        : message.includes("item_documents")
          ? "Documents table may be missing — run database migrations."
          : message;
    return NextResponse.json({ error: hint }, { status: 500 });
  }
}
