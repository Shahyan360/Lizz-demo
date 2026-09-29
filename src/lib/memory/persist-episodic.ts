import { randomUUID } from "crypto";
import { z } from "zod";
import { prisma } from "../prisma";
import { VectorService } from "../../services/vector.service";

export const episodicMemoryInputSchema = z.object({
  contactEmail: z.string().min(1),
  contactId: z.string().uuid().nullable(),
  triggerText: z.string().min(1),
  replyText: z.string().min(1),
  threadId: z.string().min(1),
  sourceMessageId: z.string().min(1),
});

export type EpisodicMemoryInput = z.infer<typeof episodicMemoryInputSchema>;

export async function persistApprovedDraftMemory(
  rawInput: EpisodicMemoryInput
): Promise<void> {
  const parsed = episodicMemoryInputSchema.safeParse(rawInput);
  if (!parsed.success) {
    console.warn(`[persist-episodic] invalid input: ${parsed.error.message}`);
    return;
  }
  const input = parsed.data;
  const embeddingId = randomUUID();

  try {
    await prisma.memoryEpisodic.create({
      data: {
        contactId: input.contactId,
        triggerText: input.triggerText,
        replyText: input.replyText,
        embeddingId,
      },
    });

    await VectorService.initCollection();
    await VectorService.upsertMemory(embeddingId, input.triggerText, {
      contactId: input.contactEmail,
      threadId: input.threadId,
      messageId: input.sourceMessageId,
      text: input.replyText,
      type: "episodic",
      timestamp: new Date().toISOString(),
    });

    console.log(
      `[persist-episodic] stored episodic memory ${embeddingId} ` +
        `for thread=${input.threadId}`
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(
      `[persist-episodic] failed to store memory for thread=${input.threadId}: ${message}`
    );
  }
}
