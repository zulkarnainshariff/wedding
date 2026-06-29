import { PublicLanding } from "@/components/landing/PublicLanding";
import { getInvitationEventsWithSchedules } from "@/lib/public-queries";

export const revalidate = 60;

export default async function HomePage() {
  const events = await getInvitationEventsWithSchedules();
  return <PublicLanding events={events} />;
}
