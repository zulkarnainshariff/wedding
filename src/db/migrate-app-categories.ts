import "dotenv/config";
import postgres from "postgres";

const sql = postgres(process.env.DATABASE_URL!);

const SEEDS = [
  {
    slug: "general",
    label: "General",
    plural: "General",
    short_label: "General",
    icon: "layout-grid",
    color: "stone",
    sort_order: 0,
    for_items: false,
    for_documents: true,
    page_behavior: "list",
    page_behavior_config: {},
  },
  {
    slug: "activity",
    label: "Daily Schedule",
    plural: "Daily Schedule",
    short_label: "Schedule",
    icon: "calendar",
    color: "indigo",
    sort_order: 10,
    for_items: true,
    for_documents: true,
    page_behavior: "schedule",
    page_behavior_config: {},
  },
  {
    slug: "flight",
    label: "Flights",
    plural: "Flights",
    short_label: "Flights",
    icon: "plane",
    color: "sky",
    sort_order: 20,
    for_items: true,
    for_documents: true,
    page_behavior: "flights_hub",
    page_behavior_config: {},
  },
  {
    slug: "pet_relocation",
    label: "Pet Relocation",
    plural: "Pet Relocation",
    short_label: "Pets",
    icon: "cat",
    color: "rose",
    sort_order: 25,
    for_items: true,
    for_documents: true,
    page_behavior: "redirect",
    page_behavior_config: { targetSlug: "flight", tab: "pet_relocation" },
  },
  {
    slug: "accommodation",
    label: "Accommodation",
    plural: "Accommodation",
    short_label: "Stay",
    icon: "home",
    color: "emerald",
    sort_order: 30,
    for_items: true,
    for_documents: true,
    page_behavior: "list",
    page_behavior_config: {},
  },
  {
    slug: "car_rental",
    label: "Car Rental",
    plural: "Car Rentals",
    short_label: "Cars",
    icon: "car",
    color: "amber",
    sort_order: 40,
    for_items: true,
    for_documents: true,
    page_behavior: "list",
    page_behavior_config: {},
  },
  {
    slug: "travel_insurance",
    label: "Travel Insurance",
    plural: "Travel Insurance",
    short_label: "Insurance",
    icon: "shield",
    color: "violet",
    sort_order: 50,
    for_items: true,
    for_documents: true,
    page_behavior: "travel_insurance",
    page_behavior_config: {},
  },
] as const;

async function main() {
  await sql`
    CREATE TABLE IF NOT EXISTS app_categories (
      slug text PRIMARY KEY,
      label text NOT NULL,
      plural text NOT NULL,
      short_label text NOT NULL,
      icon text NOT NULL DEFAULT 'layout-grid',
      color text NOT NULL DEFAULT 'stone',
      sort_order integer NOT NULL DEFAULT 0,
      for_items boolean NOT NULL DEFAULT false,
      for_documents boolean NOT NULL DEFAULT false,
      page_behavior text NOT NULL DEFAULT 'list',
      page_behavior_config jsonb NOT NULL DEFAULT '{}'::jsonb,
      created_at timestamptz NOT NULL DEFAULT now()
    )
  `;

  for (const seed of SEEDS) {
    await sql`
      INSERT INTO app_categories (
        slug, label, plural, short_label, icon, color, sort_order,
        for_items, for_documents, page_behavior, page_behavior_config
      ) VALUES (
        ${seed.slug},
        ${seed.label},
        ${seed.plural},
        ${seed.short_label},
        ${seed.icon},
        ${seed.color},
        ${seed.sort_order},
        ${seed.for_items},
        ${seed.for_documents},
        ${seed.page_behavior},
        ${sql.json(seed.page_behavior_config)}
      )
      ON CONFLICT (slug) DO NOTHING
    `;
  }

  console.log("App categories migration complete.");
  await sql.end();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
