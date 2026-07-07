import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { isAuthError, requireAuth, requireEditAccess } from "@/lib/api-auth";
import { db } from "@/lib/db";
import {
  canViewDocument,
  deleteDocumentFile,
  parseExtraViewers,
  readDocumentFile,
} from "@/lib/item-documents";
import { getDocumentCategories } from "@/lib/app-categories";
import {
  isDocumentCategory,
  resolveDocumentCategorySlug,
} from "@/lib/document-categories";
import { normalizeTravellerName } from "@/lib/travellers";
import { filterItemsByPermission } from "@/lib/permissions";
import { itemDocuments, itineraryItems } from "@/lib/schema";
import { bumpSyncVersion } from "@/lib/sync";

type Params = { params: Promise<{ docId: string }> };

export async function GET(_request: Request, { params }: Params) {
  const user = await requireAuth();
  if (isAuthError(user)) return user;

  const { docId } = await params;
  const [doc] = await db
    .select()
    .from(itemDocuments)
    .where(eq(itemDocuments.id, Number(docId)))
    .limit(1);

  if (!doc) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const [item] = doc.itemId
    ? await db
        .select()
        .from(itineraryItems)
        .where(eq(itineraryItems.id, doc.itemId))
        .limit(1)
    : [null];

  if (doc.itemId && !item) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (doc.itemId && item) {
    const [authorized] = filterItemsByPermission([item], user);
    if (!authorized || !canViewDocument(doc, item, user)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  } else if (!canViewDocument(doc, null, user)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const bytes = await readDocumentFile(doc.storageKey);
  return new NextResponse(new Uint8Array(bytes), {
    headers: {
      "Content-Type": doc.mimeType ?? "application/octet-stream",
      "Content-Disposition": `inline; filename="${doc.fileName.replace(/"/g, "")}"`,
      "Cache-Control": "private, no-store",
    },
  });
}

export async function DELETE(_request: Request, { params }: Params) {
  const user = await requireEditAccess();
  if (isAuthError(user)) return user;

  const { docId } = await params;
  const [doc] = await db
    .select()
    .from(itemDocuments)
    .where(eq(itemDocuments.id, Number(docId)))
    .limit(1);

  if (!doc) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await deleteDocumentFile(doc.storageKey);
  await db.delete(itemDocuments).where(eq(itemDocuments.id, doc.id));
  await bumpSyncVersion();
  return NextResponse.json({ ok: true });
}

export async function PATCH(request: Request, { params }: Params) {
  const user = await requireEditAccess();
  if (isAuthError(user)) return user;

  const { docId } = await params;
  const id = Number(docId);
  if (!Number.isFinite(id)) {
    return NextResponse.json({ error: "Invalid document id" }, { status: 400 });
  }

  const [doc] = await db
    .select()
    .from(itemDocuments)
    .where(eq(itemDocuments.id, id))
    .limit(1);

  if (!doc) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = (await request.json()) as {
    label?: unknown;
    coversTravellers?: unknown;
    extraViewers?: unknown;
    category?: unknown;
  };

  const label =
    typeof body.label === "string" ? body.label.trim() : undefined;
  if (label !== undefined && !label) {
    return NextResponse.json(
      { error: "Label cannot be empty" },
      { status: 400 },
    );
  }

  const coveredRaw: string[] = Array.isArray(body.coversTravellers)
    ? body.coversTravellers.filter(
        (entry): entry is string => typeof entry === "string",
      )
    : String(body.coversTravellers ?? "")
        .split(",")
        .map((entry) => entry.trim())
        .filter(Boolean);

  const coversTravellers = [
    ...new Set(
      coveredRaw.map((name) => normalizeTravellerName(name)).filter(Boolean),
    ),
  ];

  if (coversTravellers.length === 0) {
    return NextResponse.json(
      { error: "At least one traveller is required" },
      { status: 400 },
    );
  }

  const extraViewers = parseExtraViewers(
    Array.isArray(body.extraViewers)
      ? body.extraViewers
      : String(body.extraViewers ?? "")
          .split(",")
          .map((entry: string) => entry.trim())
          .filter(Boolean),
  );

  const categoryRaw =
    typeof body.category === "string" ? body.category.trim() : undefined;
  let category: string | undefined;
  if (categoryRaw !== undefined) {
    const documentCategories = await getDocumentCategories();
    if (
      categoryRaw &&
      !isDocumentCategory(categoryRaw, documentCategories)
    ) {
      return NextResponse.json(
        { error: "Unknown document category" },
        { status: 400 },
      );
    }
    category = resolveDocumentCategorySlug(
      categoryRaw,
      documentCategories,
    );
  }

  const [updated] = await db
    .update(itemDocuments)
    .set({
      ...(label !== undefined ? { label } : {}),
      ...(category !== undefined ? { category } : {}),
      travellerName: coversTravellers[0],
      coversTravellers,
      extraViewers,
    })
    .where(eq(itemDocuments.id, id))
    .returning();

  await bumpSyncVersion();
  return NextResponse.json(updated);
}
