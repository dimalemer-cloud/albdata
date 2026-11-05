import { z } from "zod";
import { api } from "@/lib/auth";
import { generateSequence } from "@/lib/ai";

export const POST = api(async (req) => {
  const b = z.object({ offer: z.string().min(5), audience: z.string().min(3), tone: z.string().optional(), steps: z.number().int().min(1).max(6).optional() }).parse(await req.json());
  return generateSequence(b);
});
