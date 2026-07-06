"use client";

import { useCallback, useEffect, useState } from "react";
import { Database, Download, Upload } from "lucide-react";
import { SectionShell } from "@/components/layout/PageShell";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { useToast } from "@/components/ui/ToastProvider";

type SeedFileInfo = {
  filename: string;
  location: "project" | "seeds" | "dumps";
  byteSize: number;
  modifiedAt: string;
};

type SeedFilesPayload = {
  files: SeedFileInfo[];
  deployConfigured: boolean;
  deployTarget: string | null;
  isProduction: boolean;
};

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function DatabaseOperationsPanel() {
  const toast = useToast();
  const [meta, setMeta] = useState<SeedFilesPayload | null>(null);
  const [selectedSeed, setSelectedSeed] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [downloadStatus, setDownloadStatus] = useState<string | null>(null);
  const [dumpDialogOpen, setDumpDialogOpen] = useState(false);
  const [restoreDialogOpen, setRestoreDialogOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const loadMeta = useCallback(async () => {
    const response = await fetch("/api/system/seed-files");
    if (!response.ok) {
      setStatus("Could not load database tools.");
      return;
    }
    const payload = (await response.json()) as SeedFilesPayload;
    setMeta(payload);
    setSelectedSeed(payload.files[0]?.filename ?? "");
  }, []);

  useEffect(() => {
    void loadMeta();
  }, [loadMeta]);

  async function runDumpDownload() {
    setDownloading(true);
    setDownloadStatus(null);
    try {
      const response = await fetch("/api/system/dump-download");
      const contentType = response.headers.get("Content-Type") ?? "";

      if (!response.ok || contentType.includes("application/json")) {
        const payload = (await response.json().catch(() => ({}))) as {
          error?: string;
        };
        const message =
          payload.error ??
          (response.status === 403
            ? "You do not have permission to download database dumps."
            : response.status === 401
              ? "Please sign in again."
              : `Database download failed (${response.status}).`);
        setDownloadStatus(message);
        toast.error(message);
        return;
      }

      const blob = await response.blob();
      if (blob.size === 0) {
        const message = "Download returned an empty file.";
        setDownloadStatus(message);
        toast.error(message);
        return;
      }

      const disposition = response.headers.get("Content-Disposition") ?? "";
      const match = disposition.match(/filename="([^"]+)"/);
      const filename = match?.[1] ?? todayDumpName;

      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = filename;
      anchor.style.display = "none";
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);

      const successMessage = `Downloaded ${filename} (${formatBytes(blob.size)}).`;
      setDownloadStatus(successMessage);
      toast.success(successMessage);
      await loadMeta();
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Database download failed — check your connection and try again.";
      setDownloadStatus(message);
      toast.error(message);
    } finally {
      setDownloading(false);
    }
  }

  async function runDumpDeploy() {
    setBusy(true);
    setStatus(null);
    try {
      const response = await fetch("/api/system/dump-deploy", { method: "POST" });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        setStatus(payload.error ?? "Dump and upload failed.");
        return;
      }
      setStatus(
        `Uploaded ${payload.filename} to ${payload.target} (${payload.lineCount} lines, ${formatBytes(payload.byteSize)}). Local copy: ${payload.localPath}`,
      );
      setDumpDialogOpen(false);
      await loadMeta();
    } finally {
      setBusy(false);
    }
  }

  async function runRestoreSeed() {
    if (!selectedSeed) {
      setStatus("Select a seed file first.");
      return;
    }

    setBusy(true);
    setStatus(null);
    try {
      const response = await fetch("/api/system/restore-seed", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filename: selectedSeed }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        setStatus(payload.error ?? "Database restore failed.");
        return;
      }
      setStatus(
        `Database wiped and restored from ${payload.filename} (${payload.tablesTruncated} tables reset, ${payload.sequencesReset ?? "?"} sequences realigned).${payload.auditWarning ? ` Warning: ${payload.auditWarning}` : ""}${payload.postRestoreNotice ? ` ${payload.postRestoreNotice}` : ""}`,
      );
      setRestoreDialogOpen(false);
    } finally {
      setBusy(false);
    }
  }

  const todayDumpName = `wedding-${new Date().toISOString().slice(0, 10)}.sql`;

  return (
    <>
      <SectionShell title="Download database dump">
        <p className="mb-4 text-sm text-stone-500">
          Export all application tables as a SQL file in your browser. Use this
          to copy production data to your local machine, then restore it from
          Admin → Diagnostics → Restore from seed file (or{" "}
          <code className="text-xs">npm run db:dump-seed</code> locally).
        </p>
        <button
          type="button"
          onClick={() => void runDumpDownload()}
          disabled={busy || downloading}
          className="inline-flex items-center gap-2 rounded-lg border border-stone-300 bg-white px-4 py-2 text-sm font-medium text-stone-800 hover:bg-stone-50 disabled:opacity-50"
        >
          <Download className="h-4 w-4" />
          {downloading ? "Preparing download…" : `Download ${todayDumpName}`}
        </button>
        {downloadStatus && (
          <p className="mt-3 text-sm text-stone-600">{downloadStatus}</p>
        )}
      </SectionShell>

      <SectionShell title="Deploy database dump">
        <p className="mb-4 text-sm text-stone-500">
          Dump all application data to a dated SQL file and upload it to the
          production server via SCP. Credentials are read from the server
          environment (<code className="text-xs">SERVER</code>,{" "}
          <code className="text-xs">DEPLOY_TARGET_DIR</code>,{" "}
          <code className="text-xs">DEPLOY_USERNAME</code>,{" "}
          <code className="text-xs">DEPLOY_PASSWORD</code>).
        </p>

        {meta && !meta.deployConfigured && (
          <p className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            Deploy credentials are not configured on this server.
          </p>
        )}

        {meta?.deployTarget && (
          <p className="mb-4 text-sm text-stone-600">
            Target: <span className="font-medium">{meta.deployTarget}</span>
          </p>
        )}

        <button
          type="button"
          onClick={() => setDumpDialogOpen(true)}
          disabled={!meta?.deployConfigured || busy}
          className="inline-flex items-center gap-2 rounded-lg bg-brand-deep px-4 py-2 text-sm text-white disabled:opacity-50"
        >
          <Upload className="h-4 w-4" />
          Dump &amp; upload {todayDumpName}
        </button>
      </SectionShell>

      <SectionShell title="Restore from seed file">
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
          <p className="font-semibold">Production-only destructive action</p>
          <p className="mt-1">
            This permanently deletes all current database data and reloads from
            the selected SQL seed file. Only use on the production server when
            you intend to reset the entire wedding dataset.
          </p>
        </div>

        <label className="mb-4 block text-sm">
          <span className="mb-1 block text-stone-500">Seed file</span>
          <select
            value={selectedSeed}
            onChange={(e) => setSelectedSeed(e.target.value)}
            className="w-full max-w-xl rounded-lg border border-stone-200 px-3 py-2"
          >
            <option value="">Select a .sql file…</option>
            {meta?.files.map((file) => (
              <option key={file.filename} value={file.filename}>
                {file.filename} ({file.location},{" "}
                {new Date(file.modifiedAt).toLocaleString()},{" "}
                {formatBytes(file.byteSize)})
              </option>
            ))}
          </select>
        </label>

        <p className="mb-4 text-xs text-stone-500">
          Seed files are discovered from the project root, <code>seeds/</code>,{" "}
          <code>/app/seeds</code> (bind-mounted from <code>DEPLOY_TARGET_DIR</code>
          ), and <code>/app/data/dumps</code> in Docker. The newest file is
          selected automatically. Generate a seed with{" "}
          <code>npm run db:dump-seed</code> (writes <code>wedding_seed.sql</code>
          ).
        </p>

        <button
          type="button"
          onClick={() => setRestoreDialogOpen(true)}
          disabled={!selectedSeed || busy}
          className="inline-flex items-center gap-2 rounded-lg border border-red-300 bg-white px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"
        >
          <Database className="h-4 w-4" />
          Wipe database &amp; restore seed
        </button>
      </SectionShell>

      {status && <p className="text-sm text-stone-600">{status}</p>}

      <ConfirmDialog
        open={dumpDialogOpen}
        title="Dump and upload database?"
        message={`This will dump all application tables to ${todayDumpName}, save a local copy, and upload the file to ${meta?.deployTarget ?? "the configured server"} via SCP.\n\nContinue?`}
        confirmLabel={busy ? "Working…" : "Dump & upload"}
        busy={busy}
        onClose={() => {
          if (!busy) setDumpDialogOpen(false);
        }}
        onConfirm={() => void runDumpDeploy()}
      />

      <ConfirmDialog
        open={restoreDialogOpen}
        title="Wipe database and restore seed?"
        message={`PRODUCTION WARNING\n\nYou are about to permanently delete ALL data in this database and replace it with "${selectedSeed}".\n\nThis must only be run on the production server when you intentionally want to reset all wedding data. This cannot be undone.`}
        confirmLabel={busy ? "Restoring…" : "Wipe & restore"}
        confirmPhrase="WIPE"
        destructive
        busy={busy}
        onClose={() => {
          if (!busy) setRestoreDialogOpen(false);
        }}
        onConfirm={() => void runRestoreSeed()}
      />
    </>
  );
}
