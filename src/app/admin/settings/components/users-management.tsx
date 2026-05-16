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
import { UsersDataTable } from "./users-data-table";
import { columns } from "./users-columns";

export function UsersManagement() {
  const { users, refetchRoles, refetchUsers } = useDataContext();

  React.useEffect(() => {
    void refetchRoles();
    void refetchUsers();
  }, [refetchRoles, refetchUsers]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Users</CardTitle>
        <CardDescription>
          Manage your team members and their roles.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <UsersDataTable columns={columns} data={users} />
      </CardContent>
    </Card>
  );
}
