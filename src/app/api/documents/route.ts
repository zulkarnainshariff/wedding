import { NextResponse } from "next/server";
import { isAuthError, requireAuth, requireEditAccess } from "@/lib/api-auth";
import { getDocumentCategories } from "@/lib/app-categories";
import { resolveDocumentCategorySlug } from "@/lib/document-categories";
import { getAllVisibleDocuments } from "@/lib/document-queries";
import { db } from "@/lib/db";
import {
  buildStorageKey,
  ensureUploadDir,
  isAllowedDocumentUpload,
  MAX_DOCUMENT_BYTES,
  parseExtraViewers,
  resolveDocumentMimeType,
  writeDocumentFile,
} from "@/lib/item-documents";
import { itemDocuments } from "@/lib/schema";
import { bumpSyncVersion } from "@/lib/sync";
import { normalizeTravellerName } from "@/lib/travellers";

export async function GET() {
  const user = await requireAuth();
  if (isAuthError(user)) return user;

  const documents = await getAllVisibleDocuments(user);
  return NextResponse.json(documents);
}

export async function POST(request: Request) {
  const user = await requireEditAccess();
  if (isAuthError(user)) return user;

  try {
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
    const categoryRaw = String(formData.get("category") ?? "general").trim();
    const documentCategories = await getDocumentCategories();
    const category = resolveDocumentCategorySlug(
      categoryRaw,
      documentCategories,
    );
    const extraViewers = parseExtraViewers(
      String(formData.get("extraViewers") ?? "")
        .split(",")
        .map((entry) => entry.trim()),
    );

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "File is required" }, { status: 400 });
    }

    if (coversTravellers.length === 0) {
      return NextResponse.json(
        { error: "At least one traveller is required" },
        { status: 400 },
      );
    }

    const primaryTraveller = normalizeTravellerName(coversTravellers[0]);

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
    const storageKey = buildStorageKey(null, file.name);
    await ensureUploadDir();
    await writeDocumentFile(storageKey, bytes);

    const [doc] = await db
      .insert(itemDocuments)
      .values({
        itemId: null,
        category,
        travellerName: primaryTraveller,
        coversTravellers,
        label,
        fileName: file.name,
        storageKey,
        mimeType,
        fileSize: file.size,
        uploadedByUserId: user.id,
        extraViewers,
      })
      .returning();

    await bumpSyncVersion();
    return NextResponse.json(doc, { status: 201 });
  } catch (error) {
    console.error("Standalone document upload failed:", error);
    const message =
      error instanceof Error ? error.message : "Document upload failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
