import { prisma } from "../src/lib/prisma";
import { ensureDefaultTeamMembers } from "../src/lib/repositories/team-members";

async function main() {
  await ensureDefaultTeamMembers();
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (err) => {
    console.error(err);
    await prisma.$disconnect();
    process.exit(1);
  });
