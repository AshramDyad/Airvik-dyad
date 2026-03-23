"use client";

import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuthContext } from "@/context/auth-context";
import { RolesPermissions } from "./components/roles-permissions";
import { UsersManagement } from "./components/users-management";
import { PropertySettingsForm } from "./components/property-settings-form";
import { AmenitiesManagement } from "./components/amenities-management";
import { CsvImportPanel } from "./components/data-tools/csv-import-panel";
import { PropertyClosuresSection } from "./components/property-closures-section";
import { PermissionGate } from "@/components/admin/permission-gate";

export default function SettingsPage() {
  const { hasPermission } = useAuthContext();

  return (
    <PermissionGate feature="settings">
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold tracking-tight font-serif">Settings</h2>
          <p className="text-muted-foreground">
            Manage your property settings, team members, and billing information.
          </p>
        </div>
        <Tabs defaultValue="property" className="w-full">
          <TabsList className="grid w-full grid-cols-6">
            <TabsTrigger value="property">Property</TabsTrigger>
            <TabsTrigger value="amenities">Amenities</TabsTrigger>
            <TabsTrigger value="roles">Roles & Permissions</TabsTrigger>
            <TabsTrigger value="users" disabled={!hasPermission("read:user")}>Users</TabsTrigger>
            <TabsTrigger value="billing">Billing</TabsTrigger>
            <TabsTrigger value="data-tools">Data tools</TabsTrigger>
          </TabsList>
          <TabsContent value="property">
            <PropertySettingsForm />
            <PropertyClosuresSection />
          </TabsContent>
          <TabsContent value="amenities">
            <AmenitiesManagement />
          </TabsContent>
          <TabsContent value="roles">
            <RolesPermissions />
          </TabsContent>
          <TabsContent value="users">
            <UsersManagement />
          </TabsContent>
          <TabsContent value="billing">
            <Card>
              <CardHeader>
                <CardTitle className="font-serif">Billing</CardTitle>
                <CardDescription>
                  Manage your subscription and payment methods.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p>Billing management is not yet implemented.</p>
              </CardContent>
            </Card>
          </TabsContent>
          <TabsContent value="data-tools">
            <CsvImportPanel />
          </TabsContent>
        </Tabs>
      </div>
    </PermissionGate>
  );
}
