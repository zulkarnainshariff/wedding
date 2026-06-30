"use client";

import { useCallback, useEffect, useState } from "react";
import { Trash2 } from "lucide-react";
import { SectionShell } from "@/components/layout/PageShell";
import { DatabaseOperationsPanel } from "@/components/admin/DatabaseOperationsPanel";
import { NotificationsAdminPanel } from "@/components/admin/NotificationsAdminPanel";

type LogKind = "login" | "audit" | "usage" | "errors";

type LogRow = {
  id: number;
  username?: string | null;
  eventType?: string | null;
  action?: string | null;
  operation?: string | null;
  resourceType?: string | null;
  resourceId?: string | null;
  summary?: string | null;
  errorMessage?: string | null;
  path?: string | null;
  sessionId?: string | null;
  createdAt: string;
};

type ActiveUser = {
  userId: number;
  username: string | null;
  lastSeenAt: string;
  sessionId: string;
};

const KIND_TABS: { id: LogKind; label: string }[] = [
  { id: "login", label: "Login" },
  { id: "audit", label: "Data changes" },
  { id: "usage", label: "Usage" },
  { id: "errors", label: "Errors" },
];

export function SystemDiagnosticsPanel({
  showSuperuserTools = false,
}: {
  showSuperuserTools?: boolean;
}) {
  const [kind, setKind] = useState<LogKind>("login");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [username, setUsername] = useState("");
  const [operation, setOperation] = useState("");
  const [resourceType, setResourceType] = useState("");
  const [rows, setRows] = useState<LogRow[]>([]);
  const [active, setActive] = useState<ActiveUser[]>([]);
  const [selected, setSelected] = useState<number[]>([]);
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setStatus(null);
    const params = new URLSearchParams({ kind });
    if (from) params.set("from", new Date(from).toISOString());
    if (to) params.set("to", new Date(to).toISOString());
    if (username.trim()) params.set("username", username.trim().toLowerCase());
    if (kind === "errors") {
      if (operation.trim()) params.set("operation", operation.trim());
      if (resourceType.trim()) params.set("resourceType", resourceType.trim());
    }

    const [logsRes, activeRes] = await Promise.all([
      fetch(`/api/system/logs?${params.toString()}`),
      fetch("/api/system/logs?activeOnly=true"),
    ]);

    if (logsRes.ok) {
      const payload = await logsRes.json();
      setRows(payload.rows ?? []);
    } else {
      setRows([]);
      setStatus("Could not load logs.");
    }

    if (activeRes.ok) {
      const payload = await activeRes.json();
      setActive(payload.active ?? []);
    }

    setSelected([]);
    setLoading(false);
  }, [from, to, kind, username, operation, resourceType]);

  useEffect(() => {
    void load();
  }, [load]);

  function toggleSelected(id: number) {
    setSelected((current) =>
      current.includes(id)
        ? current.filter((entry) => entry !== id)
        : [...current, id],
    );
  }

  async function deleteSelected() {
    if (selected.length === 0) return;
    if (!confirm(`Delete ${selected.length} selected log entries?`)) return;

    const response = await fetch("/api/system/logs", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind, ids: selected }),
    });

    if (!response.ok) {
      setStatus("Delete failed.");
      return;
    }

    setStatus("Selected logs deleted.");
    await load();
  }

  async function deleteFiltered() {
    if (!from && !to) {
      setStatus("Set a date range before deleting in bulk.");
      return;
    }
    if (!confirm("Delete all logs in the current filter?")) return;

    const response = await fetch("/api/system/logs", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        kind,
        from: from ? new Date(from).toISOString() : undefined,
        to: to ? new Date(to).toISOString() : undefined,
      }),
    });

    if (!response.ok) {
      setStatus("Delete failed.");
      return;
    }

    const payload = await response.json();
    setStatus(`Deleted ${payload.deleted ?? 0} entries.`);
    await load();
  }

  return (
    <div className="space-y-6">
      {showSuperuserTools && <DatabaseOperationsPanel />}

      <SectionShell title="Active now">
        <p className="mb-3 text-sm text-stone-500">
          Users with activity in the last 15 minutes.
        </p>
        {active.length === 0 ? (
          <p className="text-sm text-stone-500">No one appears active right now.</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {active.map((entry) => (
              <li
                key={entry.sessionId}
                className="flex items-center justify-between rounded-lg border border-stone-200 bg-white px-3 py-2"
              >
                <span className="font-medium">{entry.username ?? `User #${entry.userId}`}</span>
                <span className="text-stone-500">
                  Last seen {new Date(entry.lastSeenAt).toLocaleString()}
                </span>
              </li>
            ))}
          </ul>
        )}
      </SectionShell>

      <SectionShell title="Diagnostics logs">
        <p className="mb-4 text-sm text-stone-500">
          {kind === "errors"
            ? "Failed database operations (items, days, tasks, guests). Filter by operation (create, update, delete), resource type, user, or date."
            : "Login events, data changes, and usage sessions. Detailed page views are recorded in development only."}
        </p>
        <div className="mb-4 flex flex-wrap gap-2">
          {KIND_TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setKind(tab.id)}
              className={[
                "rounded-full px-4 py-1.5 text-sm font-medium",
                kind === tab.id
                  ? "bg-brand-deep text-white"
                  : "border border-stone-200 text-stone-600",
              ].join(" ")}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label className="block text-sm">
            <span className="mb-1 block text-stone-500">From</span>
            <input
              type="datetime-local"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="w-full rounded-lg border border-stone-200 px-3 py-2"
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-stone-500">To</span>
            <input
              type="datetime-local"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="w-full rounded-lg border border-stone-200 px-3 py-2"
            />
          </label>
          <label className="block text-sm sm:col-span-2">
            <span className="mb-1 block text-stone-500">Username</span>
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full rounded-lg border border-stone-200 px-3 py-2"
              placeholder="Filter by username"
            />
          </label>
          {kind === "errors" && (
            <>
              <label className="block text-sm">
                <span className="mb-1 block text-stone-500">Operation</span>
                <input
                  value={operation}
                  onChange={(e) => setOperation(e.target.value)}
                  className="w-full rounded-lg border border-stone-200 px-3 py-2"
                  placeholder="e.g. create"
                />
              </label>
              <label className="block text-sm">
                <span className="mb-1 block text-stone-500">Resource type</span>
                <input
                  value={resourceType}
                  onChange={(e) => setResourceType(e.target.value)}
                  className="w-full rounded-lg border border-stone-200 px-3 py-2"
                  placeholder="e.g. guest"
                />
              </label>
            </>
          )}
        </div>

        <div className="mb-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void load()}
            className="rounded-lg bg-brand-deep px-4 py-2 text-sm text-white"
          >
            {loading ? "Loading…" : "Apply filters"}
          </button>
          <button
            type="button"
            onClick={() => void deleteSelected()}
            disabled={selected.length === 0}
            className="inline-flex items-center gap-2 rounded-lg border border-red-200 px-4 py-2 text-sm text-red-700 disabled:opacity-50"
          >
            <Trash2 className="h-4 w-4" />
            Delete selected
          </button>
          <button
            type="button"
            onClick={() => void deleteFiltered()}
            className="rounded-lg border border-stone-200 px-4 py-2 text-sm text-stone-700"
          >
            Delete filtered range
          </button>
        </div>

        {status && <p className="mb-3 text-sm text-stone-600">{status}</p>}

        <div className="overflow-x-auto rounded-xl border border-stone-200 bg-white">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-stone-100 bg-stone-50 text-xs uppercase tracking-wide text-stone-500">
              <tr>
                <th className="px-3 py-2"> </th>
                <th className="px-3 py-2">When</th>
                <th className="px-3 py-2">User</th>
                <th className="px-3 py-2">Event</th>
                <th className="px-3 py-2">Detail</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-b border-stone-50">
                  <td className="px-3 py-2">
                    <input
                      type="checkbox"
                      checked={selected.includes(row.id)}
                      onChange={() => toggleSelected(row.id)}
                    />
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap text-stone-600">
                    {new Date(row.createdAt).toLocaleString()}
                  </td>
                  <td className="px-3 py-2">{row.username ?? "—"}</td>
                  <td className="px-3 py-2">
                    {row.eventType ?? row.action ?? row.operation ?? "—"}
                  </td>
                  <td className="px-3 py-2 text-stone-600">
                    {row.errorMessage ??
                      row.summary ??
                      row.path ??
                      row.resourceType ??
                      row.sessionId ??
                      "—"}
                    {row.resourceId ? ` #${row.resourceId}` : ""}
                  </td>
                </tr>
              ))}
              {rows.length === 0 && !loading && (
                <tr>
                  <td colSpan={5} className="px-3 py-8 text-center text-stone-500">
                    No log entries for this filter.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </SectionShell>

      <NotificationsAdminPanel />

      <AdminAccountsPanel />
    </div>
  );
}

function AdminAccountsPanel() {
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
