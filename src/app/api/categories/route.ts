import { NextResponse } from "next/server";
import { isAuthError, requireAuth } from "@/lib/api-auth";
import { getAllAppCategories } from "@/lib/app-categories";

export async function GET() {
  const user = await requireAuth();
  if (isAuthError(user)) return user;

  const categories = await getAllAppCategories();
  return NextResponse.json(categories);
}
