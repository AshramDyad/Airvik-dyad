import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

type AuthRouteCase = {
  pagePath: string;
  directImport: string;
  loaderName: string;
  loaderPath: string;
  dynamicConst: string;
  dynamicTarget: string;
};

const rootDir = process.cwd();
const authSkeletonPath = join(
  rootDir,
  "src/components/auth/auth-form-skeleton.tsx",
);

const routeCases: AuthRouteCase[] = [
  {
    pagePath: "src/app/(auth)/login/page.tsx",
    directImport: 'import { UserLogin } from "@/components/auth/user/login"',
    loaderName: "UserLoginLoader",
    loaderPath: "src/components/auth/user/login-loader.tsx",
    dynamicConst: "const DynamicUserLogin = dynamic",
    dynamicTarget: "@/components/auth/user/login-form",
  },
  {
    pagePath: "src/app/(auth)/register/page.tsx",
    directImport:
      'import { UserRegister } from "@/components/auth/user/register"',
    loaderName: "UserRegisterLoader",
    loaderPath: "src/components/auth/user/register-loader.tsx",
    dynamicConst: "const DynamicUserRegister = dynamic",
    dynamicTarget: "@/components/auth/register-form",
  },
  {
    pagePath: "src/app/(auth)/forgot-password/page.tsx",
    directImport:
      'import { UserForgotPassword } from "@/components/auth/user/forgot-password"',
    loaderName: "UserForgotPasswordLoader",
    loaderPath: "src/components/auth/user/forgot-password-loader.tsx",
    dynamicConst: "const DynamicUserForgotPassword = dynamic",
    dynamicTarget: "@/components/auth/user/forgot-password-form",
  },
  {
    pagePath: "src/app/(auth)/resetpassword/page.tsx",
    directImport:
      'import { UserResetPassword } from "@/components/auth/user/reset-password"',
    loaderName: "UserResetPasswordLoader",
    loaderPath: "src/components/auth/user/reset-password-loader.tsx",
    dynamicConst: "const DynamicUserResetPassword = dynamic",
    dynamicTarget: "@/components/auth/reset-password-form",
  },
  {
    pagePath: "src/app/admin/forget-password/page.tsx",
    directImport:
      'import { AdminForgotPassword } from "@/components/auth/admin/forgot-password"',
    loaderName: "AdminForgotPasswordLoader",
    loaderPath: "src/components/auth/admin/forgot-password-loader.tsx",
    dynamicConst: "const DynamicAdminForgotPassword = dynamic",
    dynamicTarget: "@/components/auth/admin/forgot-password-form",
  },
];

describe("auth route code splitting", () => {
  it.each(routeCases)(
    "loads $loaderName through a dynamic route loader",
    ({ pagePath, directImport, loaderName, loaderPath, dynamicConst, dynamicTarget }) => {
      const pageSource = readFileSync(join(rootDir, pagePath), "utf8");
      const loaderSource = readFileSync(join(rootDir, loaderPath), "utf8");

      expect(pageSource).toContain(loaderName);
      expect(pageSource).not.toContain(directImport);
      expect(loaderSource).toContain(dynamicConst);
      expect(loaderSource).toContain(dynamicTarget);
    },
  );

  it("keeps the shared auth loader skeleton free of shared card utilities", () => {
    const skeletonSource = readFileSync(authSkeletonPath, "utf8");

    expect(skeletonSource).not.toContain("@/components/ui/card");
    expect(skeletonSource).not.toContain("<Card");
    expect(skeletonSource).toContain("AuthFormSkeleton");
  });
});
