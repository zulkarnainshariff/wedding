import type { Metadata, Viewport } from "next";
import { cookies } from "next/headers";
import { Cormorant_Garamond, DM_Sans, Nunito } from "next/font/google";
import { ActivityTracker } from "@/components/auth/ActivityTracker";
import { AuthProvider } from "@/components/auth/AuthProvider";
import { ToastProvider } from "@/components/ui/ToastProvider";
import { TripTimeProvider } from "@/components/itinerary/TripTimeContext";
import { OfflineSyncProvider } from "@/components/auth/OfflineSyncProvider";
import { NavigationGuardProvider } from "@/components/layout/NavigationGuard";
import { ServiceWorkerRegistration } from "@/components/ServiceWorkerRegistration";
import { sessionCookieName } from "@/lib/auth";
import { getAppSettings } from "@/lib/app-settings";
import { getAppThemeMeta } from "@/lib/app-theme";
import "./globals.css";

const cormorant = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-serif",
});

const dmSans = DM_Sans({
  subsets: ["latin"],
  variable: "--font-dm-sans",
});

const nunito = Nunito({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-nunito",
});

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: "Natalie & Zulkarnain",
    description: "Wedding invitations and family travel itinerary",
    appleWebApp: {
      title: "N & Z",
    },
  };
}

export async function generateViewport(): Promise<Viewport> {
  const { themeId } = await getAppSettings();
  const theme = getAppThemeMeta(themeId);

  return {
    themeColor: theme.manifestThemeColor,
  };
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const [{ themeId }, cookieStore] = await Promise.all([
    getAppSettings(),
    cookies(),
  ]);
  const hasSession = Boolean(cookieStore.get(sessionCookieName())?.value);

  return (
    <html
      lang="en"
      data-theme={themeId}
      className={`${cormorant.variable} ${dmSans.variable} ${nunito.variable} h-full`}
    >
      <body className="min-h-full bg-background font-sans text-foreground antialiased">
        <AuthProvider hasSession={hasSession}>
          <ToastProvider>
            <TripTimeProvider>
              <OfflineSyncProvider>
                <NavigationGuardProvider>
                  <ActivityTracker />
                  {children}
                  <ServiceWorkerRegistration />
                </NavigationGuardProvider>
              </OfflineSyncProvider>
            </TripTimeProvider>
          </ToastProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
