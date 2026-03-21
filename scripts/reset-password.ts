import bcrypt from 'bcrypt';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const username = process.argv[2];
const nextPassword = process.argv[3];

if (!username || !nextPassword) {
  console.error('Usage: tsx scripts/reset-password.ts <username> <new-password>');
  process.exit(1);
}

async function main(): Promise<void> {
  const passwordHash = await bcrypt.hash(nextPassword, 10);
  await prisma.user.update({
    where: { username },
    data: { passwordHash },
  });

  console.log(`Password updated for ${username}.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
