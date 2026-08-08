import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { isAuthError, requireAuth } from "@/lib/api-auth";
import {
  listGalleryFilterOptions,
  renameGalleryPeopleName,
} from "@/lib/gallery-queries";

async function requireGalleryAdmin() {
  const user = await requireAuth();
  if (isAuthError(user)) return user;
  if (!user.isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  return user;
}

export async function PUT(request: Request) {
  const user = await requireGalleryAdmin();
  if (user instanceof NextResponse) return user;

  const body = await request.json();
  const from = String(body.from ?? body.oldName ?? "").trim();
  const to = String(body.to ?? body.newName ?? body.name ?? "").trim();

  if (!from || !to) {
    return NextResponse.json(
      { error: "Current and new people names are required." },
      { status: 400 },
    );
  }

  try {
    const result = await renameGalleryPeopleName(from, to);
    const filterOptions = await listGalleryFilterOptions();
    revalidatePath("/gallery");
    return NextResponse.json({
      ...result,
      people: filterOptions.people,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Could not rename people name.",
      },
      { status: 400 },
    );
  }
}
