import { z } from "zod";
import { api } from "@/lib/auth";
import { sendThreadReply } from "@/lib/engine/send";

export const POST = api<{ params: Promise<{ id: string }> }>(async (req, { params }) => {
  const { id } = await params;
  const { body } = z.object({ body: z.string().min(1) }).parse(await req.json());
  return sendThreadReply(id, body);
});
