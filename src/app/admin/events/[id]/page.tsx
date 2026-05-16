import { notFound } from "next/navigation";
import { requirePageFeature } from "@/lib/server/page-auth";
import { getEventById } from "@/lib/server/events";
import { EventFormLoader } from "@/components/admin/events/event-form-loader";

interface Props {
  params: Promise<{
    id: string;
  }>;
}

export default async function EditEventPage({ params }: Props) {
  await requirePageFeature("eventBanner");
  const { id } = await params;

  const event = await getEventById(id);
  if (!event) {
    notFound();
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Edit Event</h1>
        <p className="text-muted-foreground">
          Update event details and schedule.
        </p>
      </div>
      <EventFormLoader initialData={event} />
    </div>
  );
}
