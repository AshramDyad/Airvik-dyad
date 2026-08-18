export interface InternalLinkOption {
  label: string;
  href: string;
  type: "page" | "post";
}

export const STATIC_INTERNAL_LINKS: InternalLinkOption[] = [
  { label: "Home", href: "/", type: "page" },
  { label: "Book a Stay", href: "/book", type: "page" },
  { label: "Amenities", href: "/amenities", type: "page" },
  { label: "About Us", href: "/about-us", type: "page" },
  { label: "About Rishikesh", href: "/about-rishikesh", type: "page" },
  { label: "Events", href: "/events", type: "page" },
  { label: "Blog", href: "/blog", type: "page" },
  { label: "Donate", href: "/donate", type: "page" },
];

export function filterInternalLinkOptions(
  options: InternalLinkOption[],
  search: string,
): InternalLinkOption[] {
  const normalizedSearch = search.trim().toLowerCase();
  if (!normalizedSearch) {
    return options;
  }

  return options.filter((option) =>
    `${option.label} ${option.href}`.toLowerCase().includes(normalizedSearch),
  );
}

export const removeCurrentInternalLink = (
  options: InternalLinkOption[],
  currentHref: string,
): InternalLinkOption[] => options.filter((option) => option.href !== currentHref);
