"use client";

import { useMemo } from "react";
import { travellerOptionsFromAccounts } from "@/lib/item-travellers";
import { useAccountUsernames } from "./useAccountUsernames";

export function useTravellerOptions(existing: string[] = []) {
  const accountUsernames = useAccountUsernames();
  return useMemo(
    () => travellerOptionsFromAccounts(accountUsernames, existing),
    [accountUsernames, existing],
  );
}
