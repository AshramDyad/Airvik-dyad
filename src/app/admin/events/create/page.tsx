import { requirePageFeature } from "@/lib/server/page-auth";
import { EventFormLoader } from "@/components/admin/events/event-form-loader";

export default async function CreateEventPage() {
  await requirePageFeature("eventBanner");

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Create Event</h1>
        <p className="text-muted-foreground">
          Add a new event. You can choose to make it the active homepage banner immediately.
        </p>
      </div>
      <EventFormLoader />
    </div>
  );
}
