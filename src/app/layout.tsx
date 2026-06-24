import type { Metadata } from "next";
import { Cormorant_Garamond, DM_Sans } from "next/font/google";
import { AuthProvider } from "@/components/auth/AuthProvider";
import { TripTimeProvider } from "@/components/itinerary/TripTimeContext";
import { OfflineSyncProvider } from "@/components/auth/OfflineSyncProvider";
import { NavigationGuardProvider } from "@/components/layout/NavigationGuard";
import { ServiceWorkerRegistration } from "@/components/ServiceWorkerRegistration";
import "./globals.css";

const cormorant = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-serif",
});

const dmSans = DM_Sans({
  subsets: ["latin"],
  variable: "--font-sans",
});

export const metadata: Metadata = {
  title: "Natalie & Zulkarnain",
  description: "Wedding invitations and family travel itinerary",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${cormorant.variable} ${dmSans.variable} h-full`}>
      <body className="min-h-full bg-[#f5f1eb] font-sans text-stone-800 antialiased">
        <AuthProvider>
          <TripTimeProvider>
            <OfflineSyncProvider>
              <NavigationGuardProvider>
                {children}
                <ServiceWorkerRegistration />
              </NavigationGuardProvider>
            </OfflineSyncProvider>
          </TripTimeProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
