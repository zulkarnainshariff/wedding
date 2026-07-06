"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  BUILTIN_CATEGORY_SEEDS,
  type CategoryMeta,
} from "@/lib/category-seeds";
import type { AppCategoryRow } from "@/lib/schema";

type CategoriesContextValue = {
  loading: boolean;
  categories: AppCategoryRow[];
  itemCategories: AppCategoryRow[];
  documentCategories: AppCategoryRow[];
  getMeta: (slug: string) => CategoryMeta;
  isItemCategory: (slug: string) => boolean;
  isDocumentCategory: (slug: string) => boolean;
  refresh: () => Promise<void>;
};

const CategoriesContext = createContext<CategoriesContextValue | null>(null);

function seedToRow(
  seed: (typeof BUILTIN_CATEGORY_SEEDS)[number],
): AppCategoryRow {
  return {
    slug: seed.slug,
    label: seed.label,
    plural: seed.plural,
    shortLabel: seed.shortLabel,
    icon: seed.icon,
    color: seed.color,
    sortOrder: seed.sortOrder,
    forItems: seed.forItems,
    forDocuments: seed.forDocuments,
    pageBehavior: seed.pageBehavior,
    pageBehaviorConfig: seed.pageBehaviorConfig,
    createdAt: new Date(),
  };
}

function metaFromSlug(
  slug: string,
  row: AppCategoryRow | undefined,
): CategoryMeta {
  if (row) {
    return {
      label: row.label,
      plural: row.plural,
      shortLabel: row.shortLabel,
      icon: row.icon,
      color: row.color,
    };
  }
  const seed = BUILTIN_CATEGORY_SEEDS.find((entry) => entry.slug === slug);
  if (seed) {
    return {
      label: seed.label,
      plural: seed.plural,
      shortLabel: seed.shortLabel,
      icon: seed.icon,
      color: seed.color,
    };
  }
  const label = slug.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
  return {
    label,
    plural: label,
    shortLabel: label,
    icon: "layout-grid",
    color: "stone",
  };
}

const FALLBACK_CATEGORIES = BUILTIN_CATEGORY_SEEDS.map(seedToRow);

export function CategoriesProvider({ children }: { children: ReactNode }) {
  const [categories, setCategories] =
    useState<AppCategoryRow[]>(FALLBACK_CATEGORIES);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const response = await fetch("/api/categories");
      if (!response.ok) return;
      const payload = (await response.json()) as AppCategoryRow[];
      if (Array.isArray(payload) && payload.length > 0) {
        setCategories(payload);
      }
    } catch {
      // keep fallback seeds
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const itemCategories = useMemo(
    () =>
      [...categories]
        .filter((entry) => entry.forItems)
        .sort(
          (a, b) => a.sortOrder - b.sortOrder || a.slug.localeCompare(b.slug),
        ),
    [categories],
  );

  const documentCategories = useMemo(
    () =>
      [...categories]
        .filter((entry) => entry.forDocuments)
        .sort(
          (a, b) => a.sortOrder - b.sortOrder || a.slug.localeCompare(b.slug),
        ),
    [categories],
  );

  const metaBySlug = useMemo(
    () => new Map(categories.map((entry) => [entry.slug, entry])),
    [categories],
  );

  const getMeta = useCallback(
    (slug: string): CategoryMeta =>
      metaFromSlug(slug, metaBySlug.get(slug)),
    [metaBySlug],
  );

  const value = useMemo<CategoriesContextValue>(
    () => ({
      loading,
      categories,
      itemCategories,
      documentCategories,
      getMeta,
      isItemCategory: (slug) =>
        itemCategories.some((entry) => entry.slug === slug),
      isDocumentCategory: (slug) =>
        documentCategories.some((entry) => entry.slug === slug),
      refresh,
    }),
    [
      loading,
      categories,
      itemCategories,
      documentCategories,
      getMeta,
      refresh,
    ],
  );

  return (
    <CategoriesContext.Provider value={value}>
      {children}
    </CategoriesContext.Provider>
  );
}

export function useCategories(): CategoriesContextValue {
  const context = useContext(CategoriesContext);
  if (!context) {
    throw new Error("useCategories must be used within CategoriesProvider");
  }
  return context;
}

export function useCategoriesOptional(): CategoriesContextValue | null {
  return useContext(CategoriesContext);
}
