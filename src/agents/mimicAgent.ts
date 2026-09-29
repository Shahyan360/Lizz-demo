import { findCommunicationProfile } from "../lib/repositories/profile.repository";
import { jsonStringArray } from "../lib/json-array";

export interface WritingDirectives {
  directives: string[];
  forbiddenList: string[];
  greetingStyle: string;
  signoffStyle: string;
}

export class MimicAgent {
  /**
   * Constructs personalized tone directives from stored communication profile metrics.
   */
  public static async analyze(): Promise<WritingDirectives> {
    const profile = await findCommunicationProfile();

    if (!profile) {
      return {
        directives: [
          "Maintain a crisp, professional, and clear executive tone.",
          "Keep sentences relatively brief and punchy.",
          "Use direct, clear prose; avoid unnecessary jargon.",
        ],
        forbiddenList: ["delighted", "hope this finds you well", "warmest regards"],
        greetingStyle: "Hi [Name],",
        signoffStyle: "Best,\n[My Name]",
      };
    }

    const directives: string[] = [];

    if (profile.formalityScale > 0.7) {
      directives.push("Maintain a highly formal, traditional executive voice.");
    } else if (profile.formalityScale < 0.3) {
      directives.push("Adopt a casual, approachable, and warm conversational tone.");
    } else {
      directives.push("Balance professional clarity with a warm, personable touch.");
    }

    if (profile.avgSentenceLen <= 10) {
      directives.push("Write in short, punchy sentences.");
    } else if (profile.avgSentenceLen >= 20) {
      directives.push("Express nuanced ideas with fuller, descriptive phrasing.");
    }

    const favored = jsonStringArray(profile.vocabularyPref);
    if (favored.length > 0) {
      directives.push(`Favor terms such as: ${favored.join(", ")}.`);
    }

    return {
      directives,
      forbiddenList: jsonStringArray(profile.forbiddenWords),
      greetingStyle: profile.greetingStyle,
      signoffStyle: profile.signoffStyle,
    };
  }
}
