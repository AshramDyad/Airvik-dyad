import type { Guest } from "@/data/types";

export type GuestsPageResponse = {
  data: Guest[];
  nextOffset: number | null;
  count: number | null;
};
