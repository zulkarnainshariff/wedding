import { NextResponse } from "next/server";
import { requireAuth, isAuthError } from "@/lib/api-auth";
import { getAllVisibleDocuments } from "@/lib/document-queries";

export async function GET() {
  const user = await requireAuth();
  if (isAuthError(user)) return user;

  const documents = await getAllVisibleDocuments(user);
  return NextResponse.json(documents);
}
