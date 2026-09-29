/**
 * Cleans text for Text-to-Speech (TTS) rendering by stripping markdown formatting,
 * standalone emails, markdown links, emojis, and non-speech symbols.
 */
export function formatSpeakReply(text: string): string {
  if (!text) return "";

  let clean = text
    // 1. Remove email addresses in parentheses e.g. (dave@myautogate.com)
    .replace(/\s*\([^)]+@[^)]+\)/g, "")
    // 2. Remove standalone email addresses
    .replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g, "")
    // 3. Remove all markdown headers and hash symbols (e.g. ## Title, # Heading)
    .replace(/#{1,6}\s*/g, "")
    // 4. Remove bold/italics syntax (**bold**, *italic*, __bold__, _italic_)
    .replace(/\*{1,2}([^*]+)\*{1,2}/g, "$1")
    .replace(/_{1,2}([^_]+)_{1,2}/g, "$1")
    // 5. Remove inline code backticks (`code`)
    .replace(/`([^`]+)`/g, "$1")
    // 6. Strip bullet points or numbered list markers at start of lines
    .replace(/^\s*(\d+\.|\*|-|•|\+)\s+/gm, "")
    // 7. Remove markdown links [Text](url) -> keep Text
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    // 8. Remove common emojis and special non-speech characters
    .replace(/[\u{1F300}-\u{1F6FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F900}-\u{1F9FF}\u{1F600}-\u{1F64F}]/gu, "")
    // 9. Convert newlines into period-space for natural TTS pauses
    .replace(/\n+/g, ". ")
    // 10. Clean up multiple spaces, consecutive periods, or trailing spaces
    .replace(/\s+/g, " ")
    .replace(/\.\s*\./g, ".")
    .replace(/\s*,\s*\./g, ".")
    .replace(/\.\s*,/g, ".")
    .trim();

  if (clean && !/[.!?]$/.test(clean)) {
    clean += ".";
  }

  return clean;
}

/**
 * Extracts the [SPEAK: ...] spoken summary block the AI appends to list responses.
 * Returns { reply, speakSummary } where:
 *   - reply: the original text with the [SPEAK: ...] block removed (clean for display)
 *   - speakSummary: the extracted spoken summary text, or null if not present
 */
export function extractSpeakSummary(text: string): { reply: string; speakSummary: string | null } {
  // Match [SPEAK: ...] at end of response (possibly multiline content inside)
  const speakMatch = text.match(/\[SPEAK:\s*([\s\S]*?)\]\s*$/i);
  if (!speakMatch) {
    return { reply: text, speakSummary: null };
  }
  const speakSummary = speakMatch[1].trim();
  // Remove the [SPEAK: ...] block from the display reply
  const reply = text.slice(0, speakMatch.index).trimEnd();
  return { reply, speakSummary };
}
