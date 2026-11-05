import { z } from "zod";
import { api } from "@/lib/auth";
import { verifyEmail } from "@/lib/verify";

export const POST = api(async (req) => {
  const { email } = z.object({ email: z.string().min(3) }).parse(await req.json());
  return verifyEmail(email);
});
