import { AppShell } from "@/components/layout/AppShell";

export default function ItineraryLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AppShell>{children}</AppShell>;
}
