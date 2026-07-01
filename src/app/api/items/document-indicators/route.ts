import { NextResponse } from "next/server";
import { requireAuth, isAuthError } from "@/lib/api-auth";
import { getDocumentIndicators } from "@/lib/document-queries";

export async function GET() {
  const user = await requireAuth();
  if (isAuthError(user)) return user;

  const indicators = await getDocumentIndicators(user);
  return NextResponse.json(indicators);
}
