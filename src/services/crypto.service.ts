import crypto from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12; // 12 bytes standard for GCM
const TAG_LENGTH = 16; // 16 bytes auth tag

export class CryptoService {
  private static getKey(): Buffer {
    const secret = process.env.ENCRYPTION_KEY;
    if (!secret) {
      throw new Error("ENCRYPTION_KEY environment variable is not defined!");
    }
    // Deriving a 32-byte key using SHA-256 to guarantee length requirements
    return crypto.createHash("sha256").update(secret).digest();
  }

  /**
   * Encrypts plain text using AES-256-GCM.
   * Returns a single string formatted as: iv:encryptedData:authTag
   */
  public static encrypt(text: string): string {
    const iv = crypto.randomBytes(IV_LENGTH);
    const key = this.getKey();
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

    let encrypted = cipher.update(text, "utf8", "hex");
    encrypted += cipher.final("hex");

    const authTag = cipher.getAuthTag().toString("hex");

    return `${iv.toString("hex")}:${encrypted}:${authTag}`;
  }

  /**
   * Decrypts AES-256-GCM formatted cipher text string.
   */
  public static decrypt(cipherText: string): string {
    const parts = cipherText.split(":");
    if (parts.length !== 3) {
      throw new Error("Invalid cipher text format. Expected iv:encryptedData:authTag");
    }

    const [ivHex, encryptedHex, tagHex] = parts;
    const key = this.getKey();
    const iv = Buffer.from(ivHex, "hex");
    const tag = Buffer.from(tagHex, "hex");

    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(tag);

    let decrypted = decipher.update(encryptedHex, "hex", "utf8");
    decrypted += decipher.final("utf8");

    return decrypted;
  }
}
