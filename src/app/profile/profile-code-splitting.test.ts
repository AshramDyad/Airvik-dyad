import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const profileDir = join(process.cwd(), "src/app/profile");

describe("profile route code splitting", () => {
  it("keeps the route page as a server shell around the profile client", () => {
    const pageSource = readFileSync(join(profileDir, "page.tsx"), "utf8");
    const loaderSource = readFileSync(
      join(profileDir, "profile-client-loader.tsx"),
      "utf8",
    );
    const clientSource = readFileSync(join(profileDir, "profile-client.tsx"), "utf8");

    expect(pageSource).toContain("ProfileClientLoader");
    expect(pageSource).not.toContain('"use client"');
    expect(pageSource).not.toContain("useAuthContext");
    expect(pageSource).not.toContain("useRouter");
    expect(loaderSource).toContain("const DynamicProfileClient = dynamic");
    expect(loaderSource).toContain("./profile-client");
    expect(clientSource).toContain("useAuthContext");
  });
});
