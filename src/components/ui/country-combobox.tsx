"use client";

import * as React from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { getAllCountries, type Country } from "@/lib/countries";

interface CountryComboboxProps {
  value: string;
  onChange: (value: string, country?: Country) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

export function CountryCombobox({
  value,
  onChange,
  placeholder = "Select country...",
  disabled = false,
  className,
}: CountryComboboxProps) {
  const [open, setOpen] = React.useState(false);

  const countries = React.useMemo(() => {
    return getAllCountries();
  }, []);

  const selectedCountry = React.useMemo(() => {
    return countries.find((country) => country.code === value);
  }, [value, countries]);

  const stopPropagation = React.useCallback((event: React.SyntheticEvent) => {
    event.stopPropagation();
  }, []);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn(
            "h-12 w-full justify-between rounded-xl border border-border/50 bg-card/80 px-4 font-medium",
            !value && "text-muted-foreground",
            className
          )}
        >
          {selectedCountry ? (
            <div className="flex items-center gap-2">
              <span className="text-base">{selectedCountry.flag}</span>
              <span>{selectedCountry.name}</span>
              <span className="text-xs text-muted-foreground">
                ({selectedCountry.dialCode})
              </span>
            </div>
          ) : (
            <span>{placeholder}</span>
          )}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-[var(--radix-popover-trigger-width)] rounded-2xl border border-border/50 bg-card/95 p-0 shadow-lg backdrop-blur"
        onWheel={stopPropagation}
        onTouchMove={stopPropagation}
      >
        <Command>
          <CommandInput placeholder="Search country..." />
          <CommandList>
            <CommandEmpty>No country found.</CommandEmpty>
            <CommandGroup>
              {countries.map((country) => (
                <CommandItem
                  key={country.code}
                  value={country.code}
                  keywords={[country.name, country.code, country.dialCode]}
                  className="text-foreground data-[selected=true]:text-primary"
                  onSelect={() => {
                    onChange(country.code, country);
                    setOpen(false);
                  }}
                >
                  <span
                    className={cn(
                      "mr-2 flex h-5 w-5 items-center justify-center rounded-md border border-border/60",
                      value === country.code
                        ? "border-primary bg-primary text-primary-foreground"
                        : "opacity-60 [&_svg]:invisible"
                    )}
                  >
                    <Check className="h-3.5 w-3.5" />
                  </span>
                  <span className="text-base">{country.flag}</span>
                  <span>{country.name}</span>
                  <span className="ml-auto text-xs text-muted-foreground">
                    {country.dialCode}
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
