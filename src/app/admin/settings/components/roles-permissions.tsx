"use client";

import * as React from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useDataContext } from "@/context/data-context";
import { RolesDataTable } from "./roles-data-table";
import { columns } from "./roles-columns";

export function RolesPermissions() {
  const { roles, refetchRoles } = useDataContext();

  React.useEffect(() => {
    void refetchRoles();
  }, [refetchRoles]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Roles & Permissions</CardTitle>
        <CardDescription>
          Define roles and assign specific permissions to them.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <RolesDataTable columns={columns} data={roles} />
      </CardContent>
    </Card>
  );
}
