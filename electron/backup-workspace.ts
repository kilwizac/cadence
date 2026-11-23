import { z } from "zod";
import { migrate } from "../src/renderer/model";

const text = z.string();
const texts = z.array(text);
const id = text.min(1);
const attachment = z.looseObject({ storedName: id, originalName: text, size: z.number().int().nonnegative() });
const step = z.looseObject({
  id, text, type: z.enum(["action", "decision", "handoff", "wait"]).nullish(), role: text.nullish(),
  system: text.nullish(), durationMinutes: z.number().nullish(),
  branches: z.array(z.looseObject({ id, label: text, targetStepId: id })).nullish(),
});
const process = z.looseObject({
  id, name: text, owner: text.nullish(), ownerId: text.nullish(), description: text,
  status: z.enum(["unmapped", "mapped", "documented", "optimized"]), steps: z.array(step),
  sopIds: texts, createdAt: text,
  raci: z.looseObject({ responsible: texts, accountable: texts, consulted: texts, informed: texts }).nullish(),
});
const sop = z.looseObject({
  id, title: text, status: z.enum(["draft", "review", "approved"]), kind: z.enum(["written", "file"]),
  content: text, attachment: attachment.optional(), updatedAt: text,
  revision: z.number().int().nonnegative().nullish(),
  training: z.record(text, z.looseObject({ revision: z.number().int().positive(), trainedAt: text })).nullish(),
  reviewEveryMonths: z.number().positive().nullish(), lastReviewedAt: text.nullish(),
});
const note = z.looseObject({
  id, kind: z.enum(["improvement", "revisit", "issue", "question"]), text,
  processId: text.optional(), resolved: z.boolean(), createdAt: text,
});
const area = z.looseObject({
  id, name: text, description: text, hue: z.number(), x: z.number(), y: z.number(),
  kind: z.enum(["shipping", "inventory", "purchasing", "sales", "engineering", "production", "quality", "maintenance", "office"]).nullish(),
  processes: z.array(process), sops: z.array(sop), notes: z.array(note), createdAt: text,
});
const workspace = z.looseObject({
  version: z.union([z.literal(1), z.literal(2)]),
  name: text, areas: z.array(area), flows: z.array(z.looseObject({ id, from: id, to: id, label: text })),
  companyProfile: z.looseObject({ industry: text.nullish(), description: text.nullish(), confirmed: z.boolean().nullish() }).nullish(),
  people: z.array(z.looseObject({ id, name: text, role: text, areaIds: texts, email: text.optional() })).nullish(),
});

export function readBackupWorkspace(json: string) {
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch {
    throw new Error("The backup contains invalid workspace JSON.");
  }
  const result = workspace.safeParse(raw);
  if (!result.success) throw new Error("The backup doesn't contain a supported Cadence workspace.");
  return migrate(result.data);
}
