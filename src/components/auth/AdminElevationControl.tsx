"use client";

import { useState } from "react";
import { Shield, ShieldOff } from "lucide-react";
import { useRouter } from "next/navigation";
import { AdminElevateDialog } from "@/components/auth/AdminElevateDialog";
import { useAuth } from "@/components/auth/AuthProvider";

export function AdminElevationControl({ compact = false }: { compact?: boolean }) {
  const router = useRouter();
  const { user, elevatedAdmin, elevateAdmin, dropAdminElevation } = useAuth();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dropping, setDropping] = useState(false);

  if (!user || (user.isAdmin && !elevatedAdmin)) return null;

  async function handleDrop() {
    setDropping(true);
    await dropAdminElevation();
    setDropping(false);
    router.refresh();
  }

  if (elevatedAdmin) {
    return (
      <div className={compact ? "flex justify-center" : "flex items-center gap-2"}>
        {!compact && (
          <span className="rounded-full bg-brand-deep/10 px-2 py-0.5 text-[10px] font-semibold tracking-wide text-brand-deep uppercase">
            Admin
          </span>
        )}
        <button
          type="button"
          onClick={() => void handleDrop()}
          disabled={dropping}
          className="rounded-lg p-1.5 text-brand-deep hover:bg-brand-deep/10 disabled:opacity-60"
          title="Drop admin access"
          aria-label="Drop admin access"
        >
          <ShieldOff className="h-4 w-4" />
        </button>
      </div>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setDialogOpen(true)}
        className="rounded-lg p-1.5 text-stone-400 hover:bg-stone-100 hover:text-brand-deep"
        title="Gain admin access"
        aria-label="Gain admin access"
      >
        <Shield className="h-4 w-4" />
      </button>
      <AdminElevateDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onConfirm={async (password) => {
          const result = await elevateAdmin(password);
          if (result.ok) router.refresh();
          return result;
        }}
      />
    </>
  );
}
