import { describe, expect, it, vi } from "vitest";

import { upsertRoomNumberLink } from "./room-number-links";

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

describe("room number link persistence", () => {
  it("upserts room number links without selecting the saved row back", async () => {
    const { client, query } = createClient({ data: null, error: null });

    await expect(
      upsertRoomNumberLink(client as never, {
        source: "vikbooking",
        externalNumber: " 101 ",
        roomId: "00000000-0000-0000-0000-000000000001",
      }),
    ).resolves.toBeUndefined();

    expect(client.from).toHaveBeenCalledWith("vikbooking_room_number_links");
    expect(query.upsert).toHaveBeenCalledWith(
      {
        source: "vikbooking",
        external_number: "101",
        external_number_normalized: "101",
        room_id: "00000000-0000-0000-0000-000000000001",
      },
      { onConflict: "source,external_number_normalized" },
    );
    expect(query.select).not.toHaveBeenCalled();
    expect(query.single).not.toHaveBeenCalled();
  });
});
