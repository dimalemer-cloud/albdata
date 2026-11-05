import { z } from "zod";
import { api } from "@/lib/auth";
import { rewriteCopy } from "@/lib/ai";

export const POST = api(async (req) => {
  const b = z.object({ subject: z.string(), body: z.string(), instruction: z.string().min(2) }).parse(await req.json());
  return rewriteCopy(`Subject: ${b.subject}\n\n${b.body}`, b.instruction);
});
