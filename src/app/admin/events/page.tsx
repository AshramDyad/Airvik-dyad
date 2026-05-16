import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { requirePageFeature } from "@/lib/server/page-auth";
import { getAllEvents } from "@/lib/server/events";
import { EventsTableLoader } from "@/components/admin/events/events-table-loader";

export default async function EventsPage() {
  await requirePageFeature("eventBanner");
  const events = await getAllEvents();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
            <h1 className="text-2xl font-semibold tracking-tight">Events & Banners</h1>
            <p className="text-muted-foreground">
                Manage upcoming events and homepage banners.
            </p>
        </div>
        <Button asChild>
          <a href="/admin/events/create">
            <Plus className="mr-2 h-4 w-4" />
            Add Event
          </a>
        </Button>
      </div>

      <EventsTableLoader events={events} />
    </div>
  );
}
