import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { isAuthError, requireAuth, requireEditAccess } from "@/lib/api-auth";
import { db } from "@/lib/db";
import {
  canViewDocument,
  deleteDocumentFile,
  readDocumentFile,
} from "@/lib/item-documents";
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

  const [item] = await db
    .select()
    .from(itineraryItems)
    .where(eq(itineraryItems.id, doc.itemId))
    .limit(1);

  if (!item) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const [authorized] = filterItemsByPermission([item], user);
  if (!authorized || !canViewDocument(doc, item, user)) {
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
