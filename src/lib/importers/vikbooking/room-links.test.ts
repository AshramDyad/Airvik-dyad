import { describe, expect, it, vi } from "vitest";

import { upsertExternalRoomLink } from "./room-links";

function createClient(response: unknown) {
  const query = {
    upsert: vi.fn(async () => response),
    select: vi.fn(() => query),
    single: vi.fn(async () => response),
  };
  const client = {
    from: vi.fn(() => query),
  };
  return { client, query };
}

describe("external room link persistence", () => {
  it("upserts room links without selecting the saved row back", async () => {
    const { client, query } = createClient({ data: null, error: null });

    await expect(
      upsertExternalRoomLink(client as never, {
        source: "vikbooking",
        externalLabel: "Suite A",
        roomId: "00000000-0000-0000-0000-000000000001",
      }),
    ).resolves.toBeUndefined();

    expect(client.from).toHaveBeenCalledWith("external_room_links");
    expect(query.upsert).toHaveBeenCalledWith(
      {
        source: "vikbooking",
        external_label: "Suite A",
        room_id: "00000000-0000-0000-0000-000000000001",
      },
      { onConflict: "source,external_label" },
    );
    expect(query.select).not.toHaveBeenCalled();
    expect(query.single).not.toHaveBeenCalled();
  });
});
