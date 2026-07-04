"use client";

import { AdminAccountsPanel } from "@/components/admin/AdminAccountsPanel";
import { NotificationsAdminPanel } from "@/components/admin/NotificationsAdminPanel";

export function SystemAdministrationPanel() {
  return (
    <div className="space-y-6">
      <NotificationsAdminPanel />
      <AdminAccountsPanel />
    </div>
  );
}
