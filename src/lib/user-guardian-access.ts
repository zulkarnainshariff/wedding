import { travellerMatchesUsername } from "@/lib/item-travellers";
import type { SessionUser } from "@/lib/permissions";

export function userIsGuardianOfTravellers(
  user: SessionUser,
  travellers: string[],
): boolean {
  const wards = user.guardianForUsernames ?? [];
  if (wards.length === 0 || travellers.length === 0) return false;

  return travellers.some((traveller) =>
    wards.some((wardUsername) =>
      travellerMatchesUsername(traveller, wardUsername),
    ),
  );
}
