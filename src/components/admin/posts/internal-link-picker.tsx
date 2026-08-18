"use client";

import { useMemo, useState } from "react";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import type { InternalLinkOption } from "@/lib/seo/internal-links";
import { filterInternalLinkOptions } from "@/lib/seo/internal-links";

interface InternalLinkPickerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  options: InternalLinkOption[];
  onSelect: (option: InternalLinkOption) => void;
}

export function InternalLinkPicker({
  open,
  onOpenChange,
  options,
  onSelect,
}: InternalLinkPickerProps) {
  const [search, setSearch] = useState("");
  const filteredOptions = useMemo(
    () => filterInternalLinkOptions(options, search),
    [options, search],
  );

  return (
    <CommandDialog
      open={open}
      onOpenChange={(nextOpen) => {
        setSearch("");
        onOpenChange(nextOpen);
      }}
    >
      <CommandInput
        value={search}
        onValueChange={setSearch}
        placeholder="Search pages and published posts..."
        aria-label="Search internal links"
      />
      <CommandList>
        <CommandEmpty>No matching internal pages found.</CommandEmpty>
        <CommandGroup heading="Internal pages and posts">
          {filteredOptions.map((option) => (
            <CommandItem
              key={`${option.type}-${option.href}`}
              value={`${option.label} ${option.href}`}
              onSelect={() => {
                onSelect(option);
                onOpenChange(false);
              }}
            >
              <span>{option.label}</span>
              <span className="ml-auto text-xs text-muted-foreground">
                {option.href}
              </span>
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
