import { describe, expect, it } from "vitest";

import { GET as reviewsGET } from "../reviews/route";
import { GET } from "./route";

describe("public testimonials API", () => {
  it("reuses the audited public reviews handler", () => {
    expect(GET).toBe(reviewsGET);
  });
});
