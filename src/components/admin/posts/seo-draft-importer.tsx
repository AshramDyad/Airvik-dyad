"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { parseSeoDraftMarkdown, buildMasterDrafts, type SeoDraftImportPayload } from "@/lib/seo/seo-draft-import";

export function SeoDraftImporter() {
  const [drafts, setDrafts] = useState<SeoDraftImportPayload[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [isImporting, setIsImporting] = useState(false);

  const handleFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setMessage(null);
    try {
      const parsed = parseSeoDraftMarkdown(await file.text());
      if (parsed.length !== 50) {
        setDrafts([]);
        setMessage(`Expected 50 entries, but found ${parsed.length}.`);
        return;
      }
      setDrafts(buildMasterDrafts(parsed));
      setMessage("Ready to import four rewritten master drafts.");
    } catch (error) {
      setDrafts([]);
      setMessage(error instanceof Error ? error.message : "The Markdown file is incomplete.");
    }
  };

  const importDrafts = async () => {
    if (drafts.length !== 4) return;
    setIsImporting(true);
    setMessage(null);
    try {
      const response = await fetch("/api/admin/posts/import-seo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(drafts),
      });
      const data: { error?: string; imported?: Array<{ slug: string; action: string }> } = await response.json();
      if (!response.ok) throw new Error(data.error || "Import failed");
      const summary = data.imported?.map((item) => `${item.slug}: ${item.action}`).join(", ");
      setMessage(`Import complete — ${summary || "no changes"}.`);
      setDrafts([]);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Import failed");
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-3">
      <Input
        type="file"
        accept=".md,text/markdown"
        onChange={handleFile}
        aria-label="Choose SEO content Markdown file"
        className="max-w-xs"
      />
      <Button type="button" variant="secondary" disabled={drafts.length !== 4 || isImporting} onClick={importDrafts}>
        {isImporting ? "Importing..." : `Import ${drafts.length === 4 ? "4" : "SEO"} drafts`}
      </Button>
      {message ? <span className="text-sm text-muted-foreground" role="status">{message}</span> : null}
    </div>
  );
}
