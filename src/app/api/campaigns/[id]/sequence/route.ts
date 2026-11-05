import { z } from "zod";
import { api } from "@/lib/auth";
import { db } from "@/lib/db";

const body = z.object({
  steps: z
    .array(
      z.object({
        id: z.string().optional(),
        delayDays: z.coerce.number().int().min(0).max(60),
        variants: z.array(z.object({ id: z.string().optional(), label: z.string(), subject: z.string(), body: z.string(), enabled: z.boolean().default(true) })).min(1),
      }),
    )
    .min(1),
});

/** Replace the sequence while keeping ids of existing steps/variants (analytics stay attached). */
export const PUT = api<{ params: Promise<{ id: string }> }>(async (req, { params }) => {
  const { id } = await params;
  const { steps } = body.parse(await req.json());
  const existing = await db.sequenceStep.findMany({ where: { campaignId: id }, include: { variants: true } });
  const keepSteps = new Set(steps.map((s) => s.id).filter(Boolean));
  await db.$transaction(async (tx) => {
    await tx.sequenceStep.deleteMany({ where: { campaignId: id, id: { notIn: [...keepSteps] as string[] } } });
    for (let i = 0; i < steps.length; i++) {
      const s = steps[i];
      const ex = s.id ? existing.find((e) => e.id === s.id) : undefined;
      const stepId = ex
        ? (await tx.sequenceStep.update({ where: { id: ex.id }, data: { order: i, delayDays: i === 0 ? 0 : s.delayDays } })).id
        : (await tx.sequenceStep.create({ data: { campaignId: id, order: i, delayDays: i === 0 ? 0 : s.delayDays } })).id;
      const keepVariants = new Set(s.variants.map((v) => v.id).filter(Boolean));
      await tx.stepVariant.deleteMany({ where: { stepId, id: { notIn: [...keepVariants] as string[] } } });
      for (const v of s.variants) {
        const exV = v.id && ex?.variants.find((x) => x.id === v.id);
        if (exV) await tx.stepVariant.update({ where: { id: exV.id }, data: { label: v.label, subject: v.subject, body: v.body, enabled: v.enabled } });
        else await tx.stepVariant.create({ data: { stepId, label: v.label, subject: v.subject, body: v.body, enabled: v.enabled } });
      }
    }
  });
  return db.sequenceStep.findMany({ where: { campaignId: id }, orderBy: { order: "asc" }, include: { variants: { orderBy: { label: "asc" } } } });
});
