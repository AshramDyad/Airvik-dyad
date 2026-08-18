import { describe, expect, it } from "vitest";
import { buildMasterDrafts, parseSeoDraftMarkdown } from "@/lib/seo/seo-draft-import";

const queryForIndex = (index: number): string => {
  if (index % 4 === 0) return `yoga retreat query ${index}`;
  if (index % 4 === 1) return `dharamshala near triveni ${index}`;
  if (index % 4 === 2) return `cheap ashram price ${index}`;
  return `rishikesh ashram stay ${index}`;
};

const buildMarkdownFixture = (): string =>
  Array.from({ length: 50 }, (_, index) => {
    const number = index + 1;
    return `## ${number}. ${queryForIndex(number)}

**Priority:** P${(number % 3) + 1}
**Impressions:** ${number * 10}
**Clicks:** ${number}
**Avg position:** ${(number / 2).toFixed(2)}
**Action:** New guide
**Target:** /target-${number}
**SEO title:** Example title ${number}
**Meta:** Example meta ${number}

This is useful source content for query ${number}.

**Suggested internal links:** https://www.swaminarayan.yoga/book

---`;
  }).join("\n\n");

describe("SEO draft import", () => {
  it("parses all source fields from fifty entries", () => {
    const entries = parseSeoDraftMarkdown(buildMarkdownFixture());

    expect(entries).toHaveLength(50);
    expect(entries[0]).toMatchObject({
      query: "dharamshala near triveni 1",
      priority: "P2",
      impressions: 10,
      clicks: 1,
      average_position: 0.5,
      action: "New guide",
      source_target_path: "/target-1",
    });
  });

  it("groups all fifty queries into four master drafts without losing source data", () => {
    const entries = parseSeoDraftMarkdown(buildMarkdownFixture());
    const drafts = buildMasterDrafts(entries);

    expect(drafts).toHaveLength(4);
    expect(drafts.map((draft) => draft.slug)).toEqual([
      "rishikesh-ashram-stay-guide",
      "rishikesh-dharamshala-location-guide",
      "budget-ashram-stay-rishikesh",
      "yoga-wellness-spiritual-rishikesh",
    ]);
    expect(drafts.reduce((total, draft) => total + draft.source_query_data.length, 0)).toBe(50);
    expect(drafts.flatMap((draft) => draft.target_keywords)).toContain("yoga retreat query 48");
  });

  it("keeps localized source queries as editorial metadata", () => {
    const markdown = `## 1. ऋषिकेश आश्रम लिस्ट

**Priority:** P2
**Impressions:** 20
**Clicks:** 2
**Avg position:** 12.1
**Action:** Localized page
**Target:** /hi/rishikesh-ashram-list
**SEO title:** Hindi title
**Meta:** Hindi meta

Hindi source query content.`;
    const [entry] = parseSeoDraftMarkdown(markdown);

    expect(entry.query).toBe("ऋषिकेश आश्रम लिस्ट");
    expect(entry.source_target_path).toBe("/hi/rishikesh-ashram-list");
  });

  it("rejects an incomplete source entry", () => {
    expect(() =>
      parseSeoDraftMarkdown(`## 1. incomplete query\n\n**Priority:** P1\n**Impressions:** 10\n`),
    ).toThrow("Incomplete SEO entry");
  });
});
