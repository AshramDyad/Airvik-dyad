"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  allPermissions,
  type Role,
  type Permission,
  type PermissionResource,
} from "@/data/types";
import { useDataContext } from "@/context/data-context";
import { canManageRole } from "@/lib/roles";
import { useAuth } from "@/hooks/use-auth";

const roleSchema = z.object({
  name: z.string().min(1, "Role name is required."),
  permissions: z.array(z.string()).min(1, "At least one permission is required."),
});

interface RoleFormDialogProps {
  role?: Role;
  children: React.ReactNode;
  actorRole?: Role | null;
  allowManageRoles?: boolean;
}

const permissionGroups = (allPermissions as readonly Permission[]).reduce((acc, permission) => {
  const [action, resource] = permission.split(":") as [string, PermissionResource];
  if (!acc[resource]) {
    acc[resource] = [];
  }
  acc[resource].push({ action, permission });
  return acc;
}, {} as Record<PermissionResource, { action: string; permission: Permission }[]>);

const resourceLabels: Partial<Record<PermissionResource, string>> = {
  review: "Guest Reviews",
  donation: "Donations",
  payment: "Payments",
};

export function RoleFormDialog({
  role,
  children,
  actorRole: actorRoleProp,
  allowManageRoles = true,
}: RoleFormDialogProps) {
  const [open, setOpen] = React.useState(false);
  const { addRole, updateRole } = useDataContext();
  const { userRole } = useAuth();
  const actorRole = actorRoleProp ?? userRole;
  const isEditing = !!role;

  const form = useForm<z.infer<typeof roleSchema>>({
    resolver: zodResolver(roleSchema),
    defaultValues: {
      name: role?.name || "",
      permissions: role?.permissions || [],
    },
  });

  React.useEffect(() => {
    if (open) {
      form.reset({
        name: role?.name ?? "",
        permissions: role?.permissions ?? [],
      });
    }
  }, [open, role, form]);

  function onSubmit(values: z.infer<typeof roleSchema>) {
    if (!allowManageRoles || !actorRole) {
      toast.error("You don't have permission to manage roles.");
      return;
    }

    const roleData = {
        name: values.name,
        permissions: values.permissions as Permission[],
        hierarchyLevel: role?.hierarchyLevel ?? 0,
    }

    const targetRole: Role = role ?? {
      id: "new-role",
      name: roleData.name,
      permissions: roleData.permissions,
      hierarchyLevel: roleData.hierarchyLevel,
    };

    if (!canManageRole(actorRole, targetRole)) {
      toast.error("You can only manage roles below your level.");
      return;
    }

    if (isEditing && role) {
      updateRole(role.id, roleData);
    } else {
      addRole(roleData);
    }
    
    toast.success(
      `Role ${isEditing ? "updated" : "created"} successfully!`
    );
    form.reset();
    setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? "Edit Role" : "Add New Role"}
          </DialogTitle>
          <DialogDescription>
            Define the role name and select its permissions.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Role Name</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., Front Desk Manager" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="permissions"
              render={() => (
                <FormItem>
                    <FormLabel>Permissions</FormLabel>
                    <ScrollArea className="h-72 w-full rounded-2xl border border-border/50 bg-card/80 shadow-sm">
                        <div className="space-y-5 p-5">
                        {Object.entries(permissionGroups).map(([resource, actions]) => (
                            <div key={resource} className="space-y-3">
                                <h4 className="font-serif text-sm font-semibold uppercase text-muted-foreground">
                                  {resourceLabels[resource as PermissionResource] ?? resource.replace("_", " ")}
                                </h4>
                                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                                {actions.map(({ action, permission }) => (
                                    <FormField
                                    key={permission}
                                    control={form.control}
                                    name="permissions"
                                    render={({ field }) => {
                                        return (
                                        <FormItem
                                            key={permission}
                                            className="flex flex-row items-center gap-3 space-y-0 rounded-xl border border-border/40 bg-card/95 px-3 py-2 shadow-sm"
                                        >
                                            <FormControl>
                                            <Checkbox
                                                checked={field.value?.includes(permission)}
                                                onCheckedChange={(checked) => {
                                                return checked
                                                    ? field.onChange([...field.value, permission])
                                                    : field.onChange(
                                                        field.value?.filter(
                                                        (value) => value !== permission
                                                        )
                                                    )
                                                }}
                                            />
                                            </FormControl>
                                            <FormLabel className="text-sm font-medium capitalize">
                                                {action}
                                            </FormLabel>
                                        </FormItem>
                                        )
                                    }}
                                    />
                                ))}
                                </div>
                            </div>
                        ))}
                        </div>
                    </ScrollArea>
                    <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter className="border-t border-border/40 pt-4 sm:justify-end">
              <Button type="submit">
                {isEditing ? "Save Changes" : "Create Role"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
