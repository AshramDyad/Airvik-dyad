import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const formPath = join(process.cwd(), "src/components/admin/posts/post-form.tsx");

describe("post form code splitting", () => {
  it("keeps the rich text editor behind a dynamic import", () => {
    const formSource = readFileSync(formPath, "utf8");

    expect(formSource).toContain("dynamic(");
    expect(formSource).not.toContain(
      'import { RichTextEditor } from "@/components/admin/posts/rich-text-editor"',
    );
  });
});
