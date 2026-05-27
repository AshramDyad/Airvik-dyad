"use client";

import * as React from "react";
import { useDataContext } from "@/context/data-context";
import {
  DEFAULT_CURRENCY,
  formatCurrency as formatCurrencyUtil,
  formatWholeCurrency,
} from "@/lib/currency";

export function useCurrencyFormatter(options?: Intl.NumberFormatOptions) {
  const { property } = useDataContext();

  return React.useCallback(
    (amount: number, overrideOptions?: Intl.NumberFormatOptions) =>
      formatCurrencyUtil(
        amount,
        property?.currency ?? DEFAULT_CURRENCY,
        { ...options, ...overrideOptions }
      ),
    [property?.currency, options]
  );
}

export function useCurrencyCode() {
  const { property } = useDataContext();
  return property?.currency ?? DEFAULT_CURRENCY;
}

export function useWholeCurrencyFormatter() {
  const { property } = useDataContext();

  return React.useCallback(
    (amount: number) =>
      formatWholeCurrency(amount, property?.currency ?? DEFAULT_CURRENCY),
    [property?.currency]
  );
}
