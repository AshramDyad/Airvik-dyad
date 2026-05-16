import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const pagePath = join(process.cwd(), "src/app/admin/login/page.tsx");
const loaderPath = join(
  process.cwd(),
  "src/components/auth/admin/login-loader.tsx",
);

describe("admin login code splitting", () => {
  it("loads the admin login form through a dynamic client loader", () => {
    const pageSource = readFileSync(pagePath, "utf8");
    const loaderSource = readFileSync(loaderPath, "utf8");

    expect(pageSource).toContain("AdminLoginLoader");
    expect(pageSource).not.toContain(
      'import { AdminLogin } from "@/components/auth/admin/login"',
    );
    expect(loaderSource).toContain("const DynamicAdminLoginForm = dynamic");
    expect(loaderSource).toContain("@/components/auth/admin/login-form");
    expect(loaderSource).not.toContain("@/components/ui/card");
    expect(loaderSource).not.toContain("<Card");
  });
});
