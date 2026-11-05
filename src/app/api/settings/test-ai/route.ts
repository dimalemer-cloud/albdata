import { api } from "@/lib/auth";
import { categorizeReply } from "@/lib/ai";

export const POST = api(async () => {
  const r = await categorizeReply("Sounds interesting — can you send me pricing?");
  return { ok: true, result: r };
});
