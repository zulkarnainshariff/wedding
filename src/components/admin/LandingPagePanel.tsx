"use client";

import Link from "next/link";
import { ExternalLink } from "lucide-react";
import type {
  PublicInvitationEvent,
  PublicScheduleItem,
} from "@/lib/invitation-types";
import { InvitationCards } from "@/components/landing/InvitationCards";

export function LandingPagePanel({
  events,
}: {
  events: Array<PublicInvitationEvent & { schedule: PublicScheduleItem[] }>;
}) {
  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="font-serif text-lg text-brand-deep">Landing page</h3>
          <p className="mt-1 max-w-2xl text-sm text-stone-500">
            Preview the public home page guests see before signing in. Guestbook
            and gallery links appear in the top bar on the live page. Edit
            invitation cards under Invitations and public pages under Public
            features.
          </p>
        </div>
        <Link
          href="/"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex shrink-0 items-center gap-2 rounded-xl border border-stone-200 bg-white px-4 py-2.5 text-sm font-medium text-brand-deep hover:bg-stone-50"
        >
          <ExternalLink className="h-4 w-4" aria-hidden />
          Open public page
        </Link>
      </div>

      <div className="overflow-hidden rounded-2xl border border-stone-200 bg-background">
        <InvitationCards events={events} centered={false} />
      </div>
    </div>
  );
}
