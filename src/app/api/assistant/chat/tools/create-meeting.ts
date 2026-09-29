import { NextResponse } from "next/server";
import { createMeeting } from "../../../../../lib/tools/meeting.tool";

export async function handleCreateMeeting(args: {
  title: string;
  startTime: string;
  endTime?: string;
  description?: string;
  location?: string;
  attendees?: string[];
}) {
  const start = new Date(args.startTime);
  if (!args.title?.trim() || Number.isNaN(start.getTime())) {
    return NextResponse.json({ reply: "I need a meeting title and a valid start time." });
  }
  const end = args.endTime ? new Date(args.endTime) : null;
  const meeting = await createMeeting({
    title: args.title.trim(),
    startTime: start,
    endTime: end && !Number.isNaN(end.getTime()) ? end : null,
    description: args.description?.trim() || null,
    location: args.location?.trim() || null,
    attendees: args.attendees ?? [],
  });
  return NextResponse.json({
    reply: `Meeting created: ${meeting.title} on ${meeting.startTime.toISOString()}.`,
    speakReply: `I created the meeting ${meeting.title}.`,
  });
}
