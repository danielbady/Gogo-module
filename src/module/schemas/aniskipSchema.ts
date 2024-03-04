import { z } from "zod";

export const aniskipSchema = z.object({
  results: z.array(
    z.object({
      interval: z.object({
        startTime: z.number(),
        endTime: z.number(),
      }),
      skipType: z.enum(["op", "ed", "recap"]),
      skipId: z.string(),
      episodeLength: z.number(),
    }),
  ),
});
