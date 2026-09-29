import type { Meeting, MeetingStatus, Prisma } from "@prisma/client";
import { prisma } from "../prisma";

export type MeetingWithContact = Meeting & {
  contact: { email: string; name: string | null } | null;
};

export function listMeetings(): Promise<MeetingWithContact[]> {
  return prisma.meeting.findMany({
    orderBy: { startTime: "asc" },
    include: { contact: { select: { email: true, name: true } } },
  });
}

export interface CreateMeetingInput {
  title: string;
  startTime: Date;
  description?: string | null;
  location?: string | null;
  endTime?: Date | null;
  attendees?: string[];
  status?: MeetingStatus;
  contactId?: string | null;
  threadId?: string | null;
}

export function createMeeting(input: CreateMeetingInput): Promise<Meeting> {
  const attendees: Prisma.InputJsonValue = input.attendees ?? [];
  return prisma.meeting.create({
    data: {
      title: input.title,
      startTime: input.startTime,
      description: input.description ?? null,
      location: input.location ?? null,
      endTime: input.endTime ?? null,
      attendees,
      status: input.status ?? "SCHEDULED",
      contactId: input.contactId ?? null,
      threadId: input.threadId ?? null,
    },
  });
}

export interface UpdateMeetingInput {
  title?: string;
  description?: string | null;
  location?: string | null;
  startTime?: Date;
  endTime?: Date | null;
  status?: MeetingStatus;
}

export function updateMeeting(
  id: string,
  data: UpdateMeetingInput
): Promise<Meeting> {
  return prisma.meeting.update({
    where: { id },
    data: {
      ...(data.title !== undefined ? { title: data.title } : {}),
      ...(data.description !== undefined ? { description: data.description } : {}),
      ...(data.location !== undefined ? { location: data.location } : {}),
      ...(data.startTime !== undefined ? { startTime: data.startTime } : {}),
      ...(data.endTime !== undefined ? { endTime: data.endTime } : {}),
      ...(data.status !== undefined ? { status: data.status } : {}),
    },
  });
}

export function deleteMeeting(id: string): Promise<Meeting> {
  return prisma.meeting.delete({ where: { id } });
}
