"use client";

import { PermissionGate } from "@/components/admin/permission-gate";
import { SettingsTabs } from "./settings-tabs";

export function SettingsClient() {
  return (
    <PermissionGate feature="settings">
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold tracking-tight font-serif">Settings</h2>
          <p className="text-muted-foreground">
            Manage your property settings, team members, and billing information.
          </p>
        </div>
        <SettingsTabs />
      </div>
    </PermissionGate>
  );
}
