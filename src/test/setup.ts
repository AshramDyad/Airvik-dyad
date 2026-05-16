import "@testing-library/jest-dom/vitest";
import type { ReactNode } from "react";
import { afterAll, afterEach, beforeAll, vi } from "vitest";
import { server } from "./server";

beforeAll(() => {
  server.listen({ onUnhandledRequest: "error" });
});

afterEach(() => {
  server.resetHandlers();
  vi.clearAllMocks();
});

afterAll(() => {
  server.close();
});

vi.mock("react-dom", async (original) => {
  const actual = await original<typeof import("react-dom")>();

  return {
    ...actual,
    createPortal: (node: ReactNode) => node,
  };
});
