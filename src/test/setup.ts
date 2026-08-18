import "@testing-library/jest-dom/vitest";
import type { ReactNode } from "react";
import { afterAll, afterEach, beforeAll, vi } from "vitest";

if (typeof globalThis.ResizeObserver === "undefined") {
  class TestResizeObserver implements ResizeObserver {
    constructor(callback: ResizeObserverCallback) {
      void callback;
    }

    observe(target: Element, options?: ResizeObserverOptions): void {
      void target;
      void options;
    }

    unobserve(target: Element): void {
      void target;
    }

    disconnect(): void {}
  }

  globalThis.ResizeObserver = TestResizeObserver;
}

let server: typeof import("./server")["server"] | null = null;

async function ensureServer() {
  if (!server) {
    ({ server } = await import("./server"));
  }
  return server;
}

beforeAll(async () => {
  const activeServer = await ensureServer();
  activeServer.listen({ onUnhandledRequest: "error" });
});

afterEach(async () => {
  const activeServer = await ensureServer();
  activeServer.resetHandlers();
  vi.clearAllMocks();
});

afterAll(async () => {
  const activeServer = await ensureServer();
  activeServer.close();
});

vi.mock("react-dom", async (original) => {
  const actual = await original<typeof import("react-dom")>();

  return {
    ...actual,
    createPortal: (node: ReactNode) => node,
  };
});
