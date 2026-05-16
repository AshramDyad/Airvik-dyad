"use client";

import * as React from "react";
import { Plus } from "lucide-react";
import { useDataContext } from "@/context/data-context";
import { Button } from "@/components/ui/button";
import { StickyNoteCard } from "./StickyNoteCard";
import { StickyNoteFormDialog } from "./StickyNoteFormDialog";

export function DashboardStickyNotes() {
  const { stickyNotes, refetchStickyNotes } = useDataContext();

  React.useEffect(() => {
    void refetchStickyNotes();
  }, [refetchStickyNotes]);

  return (
    <div className="rounded-2xl border border-border/60 bg-card/80 shadow-sm">
        <div className="flex flex-row items-center justify-between border-b border-border/50 sm:p-6 p-4">
            <h2 className="text-xl font-semibold tracking-tight">Sticky Notes</h2>
            <StickyNoteFormDialog>
                <Button size="sm" className=" focus-visible:ring-0">
                    <Plus className="mr-2 h-4 w-4" />
                    Add Note
                </Button>
            </StickyNoteFormDialog>
        </div>
        <div className="sm:p-6 p-4">
            {stickyNotes.length > 0 ? (
                <div className="flex items-start gap-4 sm:gap-5 overflow-x-auto scrollbar-thin">
                    {stickyNotes.map((note) => (
                        <div key={note.id} className="flex-shrink-0 w-[240px] sm:w-[260px]">
                            <StickyNoteCard note={note} />
                        </div>
                    ))}
                </div>
            ) : (
                <div className="text-center text-muted-foreground py-12">
                    <p>No sticky notes yet. Add one to get started!</p>
                </div>
            )}
        </div>
    </div>
  );
}
