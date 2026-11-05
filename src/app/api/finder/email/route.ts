import { z } from "zod";
import { api } from "@/lib/auth";
import { findEmail } from "@/lib/finder/emailFinder";

export const POST = api(async (req) => {
  const b = z.object({ firstName: z.string().min(1), lastName: z.string().default(""), domain: z.string().min(3) }).parse(await req.json());
  return findEmail(b.firstName, b.lastName, b.domain);
});
