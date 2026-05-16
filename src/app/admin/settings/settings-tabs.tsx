"use client";

import dynamic from "next/dynamic";

import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useAuthContext } from "@/context/auth-context";

function SettingsPanelSkeleton() {
  return <div className="min-h-48 rounded-lg border bg-muted/20" />;
}

const PropertySettingsForm = dynamic(
  () =>
    import("./components/property-settings-form").then(
      (module) => module.PropertySettingsForm,
    ),
  { loading: () => <SettingsPanelSkeleton /> },
);

const PropertyClosuresSection = dynamic(
  () =>
    import("./components/property-closures-section").then(
      (module) => module.PropertyClosuresSection,
    ),
  { loading: () => <SettingsPanelSkeleton /> },
);

const AmenitiesManagement = dynamic(
  () =>
    import("./components/amenities-management").then(
      (module) => module.AmenitiesManagement,
    ),
  { loading: () => <SettingsPanelSkeleton /> },
);

const RolesPermissions = dynamic(
  () =>
    import("./components/roles-permissions").then(
      (module) => module.RolesPermissions,
    ),
  { loading: () => <SettingsPanelSkeleton /> },
);

const UsersManagement = dynamic(
  () =>
    import("./components/users-management").then(
      (module) => module.UsersManagement,
    ),
  { loading: () => <SettingsPanelSkeleton /> },
);

const CsvImportPanel = dynamic(
  () =>
    import("./components/data-tools/csv-import-panel").then(
      (module) => module.CsvImportPanel,
    ),
  { loading: () => <SettingsPanelSkeleton /> },
);

export function SettingsTabs() {
  const { hasPermission } = useAuthContext();

  return (
    <Tabs defaultValue="property" className="w-full">
      <TabsList className="grid w-full grid-cols-6">
        <TabsTrigger value="property">Property</TabsTrigger>
        <TabsTrigger value="amenities">Amenities</TabsTrigger>
        <TabsTrigger value="roles">Roles & Permissions</TabsTrigger>
        <TabsTrigger value="users" disabled={!hasPermission("read:user")}>
          Users
        </TabsTrigger>
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
  );
}
