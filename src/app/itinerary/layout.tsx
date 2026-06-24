import { Suspense } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { ItemDetailModal } from "@/components/itinerary/ItemDetailModal";
import { ItineraryUIProvider } from "@/components/itinerary/ItineraryUIContext";

export default function ItineraryLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AppShell>
      <Suspense fallback={null}>
        <ItineraryUIProvider>
          {children}
          <ItemDetailModal />
        </ItineraryUIProvider>
      </Suspense>
    </AppShell>
  );
}
