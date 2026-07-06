import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { canEditItinerary, canManageUsers } from "@/lib/permissions";
import { isAuthError, requireAuth } from "@/lib/api-auth";
import {
  createCategory,
  deleteCategory,
  getCategoryUsageCounts,
  updateCategory,
  validateCategorySlug,
  type CreateCategoryInput,
  type PageBehavior,
} from "@/lib/app-categories";
import { logAuditEvent } from "@/lib/activity-log";

async function requireCategoryManageAccess() {
  const user = await requireAuth();
  if (isAuthError(user)) return user;
  if (!user.isAdmin && !canEditItinerary(user) && !canManageUsers(user)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  return user;
}

function parsePageBehavior(value: unknown): PageBehavior | undefined {
  if (
    value === "list" ||
    value === "schedule" ||
    value === "flights_hub" ||
    value === "travel_insurance" ||
    value === "redirect"
  ) {
    return value;
  }
  return undefined;
}

export async function GET() {
  const user = await requireCategoryManageAccess();
  if (user instanceof NextResponse) return user;

  const [categories, usageCounts] = await Promise.all([
    import("@/lib/app-categories").then((m) => m.getAllAppCategories()),
    getCategoryUsageCounts(),
  ]);

  return NextResponse.json({ categories, usageCounts });
}

export async function POST(request: Request) {
  const user = await requireCategoryManageAccess();
  if (user instanceof NextResponse) return user;

  try {
    const body = (await request.json()) as Partial<CreateCategoryInput>;
    const slugError = body.slug ? validateCategorySlug(body.slug) : "Slug is required";
    if (slugError) {
      return NextResponse.json({ error: slugError }, { status: 400 });
    }

    const row = await createCategory({
      slug: String(body.slug),
      label: String(body.label ?? ""),
      plural: String(body.plural ?? body.label ?? ""),
      shortLabel: String(body.shortLabel ?? body.label ?? ""),
      icon: body.icon ? String(body.icon) : undefined,
      color: body.color ? String(body.color) : undefined,
      sortOrder: typeof body.sortOrder === "number" ? body.sortOrder : undefined,
      forItems: Boolean(body.forItems),
      forDocuments: Boolean(body.forDocuments),
      pageBehavior: parsePageBehavior(body.pageBehavior),
      pageBehaviorConfig:
        body.pageBehaviorConfig && typeof body.pageBehaviorConfig === "object"
          ? (body.pageBehaviorConfig as CreateCategoryInput["pageBehaviorConfig"])
          : undefined,
    });

    revalidatePath("/", "layout");

    await logAuditEvent({
      user,
      action: "create",
      resourceType: "app_category",
      resourceId: row.slug,
      summary: `Created category ${row.label}`,
    });

    return NextResponse.json(row, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not create category";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function PATCH(request: Request) {
  const user = await requireCategoryManageAccess();
  if (user instanceof NextResponse) return user;

  try {
    const body = (await request.json()) as {
      slug?: string;
      label?: string;
      plural?: string;
      shortLabel?: string;
      icon?: string;
      color?: string;
      sortOrder?: number;
      forItems?: boolean;
      forDocuments?: boolean;
      pageBehavior?: string;
      pageBehaviorConfig?: Record<string, unknown>;
    };

    const slug = String(body.slug ?? "").trim();
    if (!slug) {
      return NextResponse.json({ error: "Slug is required" }, { status: 400 });
    }

    const row = await updateCategory(slug, {
      label: body.label !== undefined ? String(body.label) : undefined,
      plural: body.plural !== undefined ? String(body.plural) : undefined,
      shortLabel:
        body.shortLabel !== undefined ? String(body.shortLabel) : undefined,
      icon: body.icon !== undefined ? String(body.icon) : undefined,
      color: body.color !== undefined ? String(body.color) : undefined,
      sortOrder:
        typeof body.sortOrder === "number" ? body.sortOrder : undefined,
      forItems: body.forItems,
      forDocuments: body.forDocuments,
      pageBehavior: parsePageBehavior(body.pageBehavior),
      pageBehaviorConfig:
        body.pageBehaviorConfig && typeof body.pageBehaviorConfig === "object"
          ? body.pageBehaviorConfig
          : undefined,
    });

    revalidatePath("/", "layout");

    await logAuditEvent({
      user,
      action: "update",
      resourceType: "app_category",
      resourceId: row.slug,
      summary: `Updated category ${row.label}`,
    });

    return NextResponse.json(row);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not update category";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function DELETE(request: Request) {
  const user = await requireCategoryManageAccess();
  if (user instanceof NextResponse) return user;

  try {
    const body = (await request.json()) as {
      slug?: string;
      reassignTo?: string;
    };

    const slug = String(body.slug ?? "").trim();
    const reassignTo = String(body.reassignTo ?? "").trim();

    if (!slug) {
      return NextResponse.json({ error: "Slug is required" }, { status: 400 });
    }
    if (!reassignTo) {
      return NextResponse.json(
        { error: "reassignTo is required" },
        { status: 400 },
      );
    }

    await deleteCategory(slug, reassignTo);
    revalidatePath("/", "layout");

    await logAuditEvent({
      user,
      action: "delete",
      resourceType: "app_category",
      resourceId: slug,
      summary: `Deleted category ${slug}, reassigned to ${reassignTo}`,
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not delete category";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
