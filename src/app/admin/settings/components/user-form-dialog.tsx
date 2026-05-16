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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import type { User } from "@/data/types";
import { useDataContext } from "@/context/data-context";
import { supabase } from "@/integrations/supabase/client";
import { useAuthContext } from "@/context/auth-context";
import { canManageRole, filterManageableRoles, findRoleById } from "@/lib/roles";

const userSchema = z.object({
  name: z.string().min(1, "Name is required."),
  email: z.string().email("Please enter a valid email address."),
  password: z.string().min(8, "Password must be at least 8 characters."),
  roleId: z.string({ required_error: "Please select a role." }),
});

const editUserSchema = userSchema.omit({ password: true }).extend({
    password: z.string().optional(),
});

type UserFormValues = z.infer<typeof editUserSchema>;

interface UserFormDialogProps {
  user?: User;
  children: React.ReactNode;
}

export function UserFormDialog({
  user,
  children,
}: UserFormDialogProps) {
  const [open, setOpen] = React.useState(false);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const { roles, updateUser, refetchUsers } = useDataContext();
  const { userRole } = useAuthContext();
  const isEditing = !!user;

  const manageableRoles = React.useMemo(
    () => filterManageableRoles(userRole ?? null, roles),
    [roles, userRole]
  );

  const form = useForm<UserFormValues>({
    resolver: zodResolver(isEditing ? editUserSchema : userSchema),
    defaultValues: {
      name: user?.name || "",
      email: user?.email || "",
      password: "",
      roleId: user?.roleId || "",
    },
  });

  async function onSubmit(values: UserFormValues) {
    setIsSubmitting(true);
    try {
      const selectedRole = findRoleById(roles, values.roleId);
      if (!canManageRole(userRole ?? null, selectedRole ?? null)) {
        toast.error("You are not allowed to assign this role.");
        return;
      }

      if (isEditing && user) {
        await updateUser(user.id, { name: values.name, roleId: values.roleId }, user);
        toast.success("User updated successfully!");
        await refetchUsers();
        setOpen(false);
      } else {
        const { error } = await supabase.functions.invoke("create-user", {
          body: {
            email: values.email,
            password: values.password,
            name: values.name,
            roleId: values.roleId,
            role_name: selectedRole?.name,
          },
        });

        if (error) {
          toast.error("Failed to create user", { description: error.message });
        } else {
          toast.success("User created successfully!");
          await refetchUsers();
          form.reset();
          setOpen(false);
        }
      }
    } catch (error: unknown) {
      const description = error instanceof Error ? error.message : "Please try again.";
      toast.error("An unexpected error occurred", { description });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? "Edit User" : "Add New User"}
          </DialogTitle>
          <DialogDescription>
            Fill in the details for the user.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Full Name</FormLabel>
                  <FormControl>
                    <Input placeholder="John Doe" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl>
                    <Input placeholder="john.doe@example.com" {...field} type="email" disabled={isEditing} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            {!isEditing && (
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Password</FormLabel>
                    <FormControl>
                      <Input placeholder="••••••••" {...field} type="password" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}
            <FormField
              control={form.control}
              name="roleId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Role</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                    disabled={manageableRoles.length === 0}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a role" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {manageableRoles.map((role) => (
                        <SelectItem key={role.id} value={role.id}>
                          {role.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {manageableRoles.length === 0 && (
                    <p className="text-sm text-muted-foreground">No roles available to assign.</p>
                  )}
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter className="border-t border-border/40 pt-4 sm:justify-end">
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Saving..." : (isEditing ? "Save Changes" : "Create User")}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
