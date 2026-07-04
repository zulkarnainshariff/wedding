"use client";

import { useEffect, useState } from "react";
import { SectionShell } from "@/components/layout/PageShell";

export function AdminAccountsPanel() {
  const [admins, setAdmins] = useState<
    { id: number; username: string; roleLevel: number }[]
  >([]);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<string | null>(null);

  async function refresh() {
    const response = await fetch("/api/system/admins");
    if (response.ok) {
      setAdmins(await response.json());
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  async function grantAdmin() {
    setStatus(null);
    const response = await fetch("/api/system/admins", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password: password || undefined }),
    });
    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      setStatus(payload.error ?? "Could not grant admin access.");
      return;
    }
    setUsername("");
    setPassword("");
    setStatus("Admin access updated.");
    await refresh();
  }

  async function revokeAdmin(id: number) {
    if (!confirm("Remove admin access for this user?")) return;
    const response = await fetch(`/api/system/admins/${id}`, { method: "DELETE" });
    if (!response.ok) {
      setStatus("Could not remove admin access.");
      return;
    }
    setStatus("Admin access removed.");
    await refresh();
  }

  return (
    <SectionShell title="Admin accounts">
      <p className="mb-4 text-sm text-stone-500">
        Level 1 admins can manage itinerary content and regular users. Only platform
        operators can change this list.
      </p>
      <div className="mb-4 grid gap-3 sm:grid-cols-2">
        <input
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="Username"
          className="rounded-lg border border-stone-200 px-3 py-2 text-sm"
        />
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="New password (optional when promoting)"
          className="rounded-lg border border-stone-200 px-3 py-2 text-sm"
        />
      </div>
      <button
        type="button"
        onClick={() => void grantAdmin()}
        className="mb-4 rounded-lg bg-brand-deep px-4 py-2 text-sm text-white"
      >
        Grant admin access
      </button>
      {status && <p className="mb-3 text-sm text-stone-600">{status}</p>}
      <ul className="space-y-2">
        {admins.map((admin) => (
          <li
            key={admin.id}
            className="flex items-center justify-between rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm"
          >
            <span className="font-medium">{admin.username}</span>
            <button
              type="button"
              onClick={() => void revokeAdmin(admin.id)}
              className="text-red-600 hover:underline"
            >
              Remove admin
            </button>
          </li>
        ))}
      </ul>
    </SectionShell>
  );
}
