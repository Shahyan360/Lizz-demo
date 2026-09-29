"use server";

import type { CommunicationProfile } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { prisma } from "../../lib/prisma";
import { toneProfileSchema } from "../../lib/schemas/actions";

function splitCsv(value: FormDataEntryValue | null): string[] {
  if (typeof value !== "string") {
    return [];
  }
  return value
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

export async function getToneProfile(): Promise<CommunicationProfile | null> {
  return prisma.communicationProfile.findFirst();
}

export async function updateToneProfile(formData: FormData): Promise<void> {
  const data = toneProfileSchema.parse({
    greetingStyle: formData.get("greetingStyle"),
    signoffStyle: formData.get("signoffStyle"),
    avgSentenceLen: formData.get("avgSentenceLen"),
    formalityScale: formData.get("formalityScale"),
    vocabularyPref: splitCsv(formData.get("vocabularyPref")),
    forbiddenWords: splitCsv(formData.get("forbiddenWords")),
  });

  const existing = await prisma.communicationProfile.findFirst();

  if (existing) {
    await prisma.communicationProfile.update({
      where: { id: existing.id },
      data,
    });
  } else {
    await prisma.communicationProfile.create({
      data,
    });
  }

  revalidatePath("/profile");
  revalidatePath("/");
}
