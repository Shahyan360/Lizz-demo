import type { CommunicationProfile } from "@prisma/client";
import { prisma } from "../prisma";

export function findCommunicationProfile(): Promise<CommunicationProfile | null> {
  return prisma.communicationProfile.findFirst();
}
