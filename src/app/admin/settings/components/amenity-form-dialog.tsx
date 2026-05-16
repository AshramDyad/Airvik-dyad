"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { toast } from "sonner";
import { ChevronsUpDown } from "lucide-react";

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
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
} from "@/components/ui/command";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { Amenity } from "@/data/types";
import { useDataContext } from "@/context/data-context";
import { iconList, type IconName } from "@/lib/icons";
import { Icon } from "@/components/shared/icon";

const amenitySchema = z.object({
  name: z.string().min(1, "Amenity name is required."),
  icon: z.string({ required_error: "Please select an icon." }),
});

interface AmenityFormDialogProps {
  amenity?: Amenity;
  children: React.ReactNode;
}

export function AmenityFormDialog({
  amenity,
  children,
}: AmenityFormDialogProps) {
  const [open, setOpen] = React.useState(false);
  const [popoverOpen, setPopoverOpen] = React.useState(false);
  const { addAmenity, updateAmenity } = useDataContext();
  const isEditing = !!amenity;

  const form = useForm<z.infer<typeof amenitySchema>>({
    resolver: zodResolver(amenitySchema),
    defaultValues: {
      name: amenity?.name || "",
      icon: amenity?.icon || "",
    },
  });

  async function onSubmit(values: z.infer<typeof amenitySchema>) {
    try {
      if (isEditing && amenity) {
        await updateAmenity(amenity.id, values, amenity);
      } else {
        await addAmenity(values);
      }
      
      toast.success(
        `Amenity ${isEditing ? "updated" : "created"} successfully!`
      );
      form.reset();
      setOpen(false);
    } catch (error) {
      toast.error("Failed to save amenity", {
        description: (error as Error).message,
      });
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? "Edit Amenity" : "Add New Amenity"}
          </DialogTitle>
          <DialogDescription>
            Define the amenity name and select an icon.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Amenity Name</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., Free Wi-Fi" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="icon"
              render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormLabel>Icon</FormLabel>
                  <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
                    <PopoverTrigger asChild>
                      <FormControl>
                        <Button
                          variant="outline"
                          role="combobox"
                          className="h-11 w-full justify-between rounded-xl border border-border/40 bg-card/80 font-medium shadow-sm"
                        >
                          {field.value ? (
                            <div className="flex items-center gap-2">
                              <Icon name={field.value as IconName} className="h-4 w-4" />
                              {field.value}
                            </div>
                          ) : "Select icon"}
                          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                      </FormControl>
                    </PopoverTrigger>
                    <PopoverContent className="w-[260px] rounded-2xl border border-border/50 bg-card/95 p-0 shadow-lg backdrop-blur">
                      <Command>
                        <CommandInput placeholder="Search icon..." />
                        <CommandEmpty>No icon found.</CommandEmpty>
                        <CommandGroup>
                          <ScrollArea className="h-48">
                            {iconList.map((icon) => (
                              <CommandItem
                                value={icon}
                                key={icon}
                                onSelect={() => {
                                  form.setValue("icon", icon);
                                  setPopoverOpen(false);
                                }}
                              >
                                <Icon name={icon} className="mr-2 h-4 w-4" />
                                {icon}
                              </CommandItem>
                            ))}
                          </ScrollArea>
                        </CommandGroup>
                      </Command>
                    </PopoverContent>
                  </Popover>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter className="border-t border-border/40 pt-4 sm:justify-end">
              <Button type="submit">
                {isEditing ? "Save Changes" : "Create Amenity"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
