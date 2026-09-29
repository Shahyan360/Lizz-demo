import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { hashPassword, MIN_PASSWORD_LENGTH } from "../src/lib/auth/password";

const prisma = new PrismaClient();

async function main() {
  const [argEmail, argPassword, argName] = process.argv.slice(2);
  const email = (process.env.ADMIN_EMAIL ?? argEmail ?? "").trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD ?? argPassword ?? "";
  const name = (process.env.ADMIN_NAME ?? argName ?? "").trim() || null;

  if (!email || !password) {
    console.error(
      "Missing credentials.\n" +
        "Usage: ADMIN_EMAIL=you@co.com ADMIN_PASSWORD=secret npm run seed:admin\n" +
        "   or: npm run seed:admin -- you@co.com secret \"Your Name\""
    );
    process.exit(1);
  }
  if (password.length < MIN_PASSWORD_LENGTH) {
    console.error(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
    process.exit(1);
  }

  const hashed = await hashPassword(password);

  const user = await prisma.user.upsert({
    where: { email },
    update: { password: hashed, role: "ADMIN", isActive: true, name },
    create: { email, password: hashed, role: "ADMIN", isActive: true, name },
  });

  console.log(`✓ Admin ready: ${user.email} (id ${user.id})`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
