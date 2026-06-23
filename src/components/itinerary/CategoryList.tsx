import { ItemCard } from "./ItemCard";
import { CATEGORY_META, type Category } from "@/lib/types";
import type { ItineraryItem } from "@/lib/schema";

export function CategoryList({
  category,
  items,
}: {
  category: Category;
  items: ItineraryItem[];
}) {
  const meta = CATEGORY_META[category];

  return (
    <div>
      <header className="mb-8">
        <p className="text-xs font-semibold tracking-[0.2em] text-[#d4a853] uppercase">
          Category
        </p>
        <h1 className="mt-1 font-serif text-3xl text-[#1e3a5f]">{meta.plural}</h1>
        <p className="mt-2 max-w-2xl text-stone-500">
          {items.length} booking{items.length === 1 ? "" : "s"} · tap any item for
          full details
        </p>
      </header>

      {items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-stone-300 bg-white/60 p-10 text-center text-stone-500">
          No {meta.label.toLowerCase()} items yet.
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-1">
          {items.map((item) => (
            <ItemCard key={item.id} item={item} />
          ))}
        </div>
      )}
    </div>
  );
}
