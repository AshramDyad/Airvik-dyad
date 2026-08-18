import { describe, expect, it } from "vitest";
import {
  filterInternalLinkOptions,
  removeCurrentInternalLink,
  type InternalLinkOption,
} from "@/lib/seo/internal-links";

const options: InternalLinkOption[] = [
  { label: "Rishikesh guide", href: "/about-rishikesh", type: "page" },
  { label: "Ashram stay guide", href: "/blog/ashram-stay-guide", type: "post" },
];

describe("internal link options", () => {
  it("filters by label or URL", () => {
    expect(filterInternalLinkOptions(options, "ashram")).toEqual([options[1]]);
    expect(filterInternalLinkOptions(options, "rishikesh")).toEqual([options[0]]);
  });

  it("removes the current article to prevent self-links", () => {
    expect(removeCurrentInternalLink(options, "/blog/ashram-stay-guide")).toEqual([
      options[0],
    ]);
  });
});
