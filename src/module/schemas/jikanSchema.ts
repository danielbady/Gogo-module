import { z } from "zod";

export const jikanSchema = z.object({
  data: z.array(
    z.object({
      mal_id: z.number(),
      title: z.string(),
    }),
  ),
});
