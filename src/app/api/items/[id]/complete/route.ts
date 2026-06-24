import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { requireEditAccess, isAuthError } from "@/lib/api-auth";
import { db } from "@/lib/db";
import { getItemCompletion, withItemCompletion } from "@/lib/item-completion";
import { itineraryItems } from "@/lib/schema";
import { bumpSyncVersion } from "@/lib/sync";

type Params = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Params) {
  const user = await requireEditAccess();
  if (isAuthError(user)) return user;

  const { id } = await params;
  const itemId = Number(id);
  const body = (await request.json()) as { completed?: boolean };

  const [existing] = await db
    .select()
    .from(itineraryItems)
    .where(eq(itineraryItems.id, itemId))
    .limit(1);

  if (!existing) {
    return NextResponse.json({ error: "Item not found" }, { status: 404 });
  }

  const details = (existing.details ?? {}) as Record<string, unknown>;
  const shouldComplete = body.completed !== false;

  const nextDetails = withItemCompletion(
    details,
    shouldComplete
      ? {
          completedAt: new Date().toISOString(),
          completedBy: user.username,
        }
      : null,
  );

  const [item] = await db
    .update(itineraryItems)
    .set({ details: nextDetails })
    .where(eq(itineraryItems.id, itemId))
    .returning();

  await bumpSyncVersion();

  return NextResponse.json({
    item,
    completed: getItemCompletion(item.details) != null,
  });
}
