export type SupportedCurrency = {
  value: string;
  label: string;
  locale: string;
  symbol: string;
};

export const SUPPORTED_CURRENCIES: SupportedCurrency[] = [
  {
    value: "INR",
    label: "Indian Rupee (₹)",
    locale: "en-IN",
    symbol: "₹",
  },
  {
    value: "USD",
    label: "US Dollar ($)",
    locale: "en-US",
    symbol: "$",
  },
  {
    value: "EUR",
    label: "Euro (€)",
    locale: "de-DE",
    symbol: "€",
  },
  {
    value: "GBP",
    label: "British Pound (£)",
    locale: "en-GB",
    symbol: "£",
  },
];

export const DEFAULT_CURRENCY = "INR";

const currencyLocaleMap = SUPPORTED_CURRENCIES.reduce<Record<string, string>>(
  (acc, currency) => {
    acc[currency.value] = currency.locale;
    return acc;
  },
  {}
);

export function formatCurrency(
  amount: number,
  currency: string = DEFAULT_CURRENCY,
  options: Intl.NumberFormatOptions = {}
) {
  const locale = currencyLocaleMap[currency] ?? "en-IN";
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: currency || DEFAULT_CURRENCY,
    ...options,
  }).format(Number.isFinite(amount) ? amount : 0);
}

export function formatWholeCurrency(
  amount: number,
  currency: string = DEFAULT_CURRENCY
) {
  const locale = currencyLocaleMap[currency] ?? "en-IN";
  const roundedAmount = normalizeWholeCurrencyAmount(amount);

  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: currency || DEFAULT_CURRENCY,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(roundedAmount);
}

function normalizeWholeCurrencyAmount(amount: number): number {
  if (!Number.isFinite(amount)) {
    return 0;
  }

  const rounded = Math.round(amount);
  return Object.is(rounded, -0) ? 0 : rounded;
}

export const currencyOptions = SUPPORTED_CURRENCIES.map((currency) => ({
  value: currency.value,
  label: currency.label,
}));
