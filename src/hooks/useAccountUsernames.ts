"use client";

import { useEffect, useState } from "react";

export function useAccountUsernames(extra: string[] = []) {
  const [loadedUsernames, setLoadedUsernames] = useState<string[]>([]);

  useEffect(() => {
    void fetch("/api/users/brief")
      .then((response) => (response.ok ? response.json() : []))
      .then((rows: { username: string }[]) => {
        setLoadedUsernames(rows.map((row) => row.username));
      })
      .catch(() => undefined);
  }, []);

  return [
    ...new Set(
      [...extra, ...loadedUsernames].map((username) => username.toLowerCase()),
    ),
  ].sort((a, b) => a.localeCompare(b));
}
