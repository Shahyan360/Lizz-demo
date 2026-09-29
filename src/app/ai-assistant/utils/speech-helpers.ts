export const WAKE_WORD_PHRASES = [
  "hello",
  "hey",
  "hello assistant",
  "hi assistant",
  "hey assistant",
  "okay assistant",
  "ok assistant",
  "hey Lizzz",
  "hi Lizzz",
  "okay Lizzz",
  "ok Lizzz",
  "hello Lizzz",
  "Lizzz",
  "assistant",
];

export function containsWakeWord(transcript: string): boolean {
  const lower = transcript.toLowerCase();
  console.log("[Wake Word Check] Heard:", JSON.stringify(lower));
  return WAKE_WORD_PHRASES.some((phrase) => lower.includes(phrase));
}

export function stripWakeWord(transcript: string): string {
  let text = transcript;
  const sorted = [...WAKE_WORD_PHRASES].sort((a, b) => b.length - a.length);
  for (const phrase of sorted) {
    const idx = text.toLowerCase().indexOf(phrase);
    if (idx !== -1) {
      text = (text.slice(0, idx) + text.slice(idx + phrase.length)).trim();
      text = text.replace(/^[,.]\s*/, "");
      break;
    }
  }
  return text.trim();
}

export function refineSpeechTranscript(raw: string): string {
  let text = raw.trim();

  // 1. Remove introductory filler words / pleasantries
  text = text.replace(/^(hello|hi|hey|okay|ok|um|uh|so|please|tell me|can you|can you please|could you|could you please)\b\s*,?\s*/i, "");

  // 2. Phonetic speech recognition corrections for names & terms
  text = text.replace(/\b(dev dev tab|dev dev|dev tab|deve|dab)\b/gi, "Dave");
  text = text.replace(/\b(dev's|devs)\b/gi, "Dave's");
  text = text.replace(/\bdev\b/gi, "Dave");
  text = text.replace(/\b(tajs|tazs)\b/gi, "tasks");
  text = text.replace(/\b(taj|taz)\b/gi, "task");

  // 3. Clean up false restarts / stutters
  text = text.replace(/\b(what is my|who is my|where is my)\s+(what|who|where)\b/i, "$2");

  // 4. Remove extra spaces
  text = text.replace(/\s+/g, " ").trim();

  if (!text) return raw.trim();

  return text.charAt(0).toUpperCase() + text.slice(1);
}
