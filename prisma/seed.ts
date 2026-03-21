import bcrypt from 'bcrypt';
import { PrismaClient, RoundStatus, UserRole } from '@prisma/client';

const prisma = new PrismaClient();

const rounds = [
  'Market Opening',
  'Industry News',
  'Macro Shock',
  'Corporate Events',
  'Board Voting',
  'Leaked Intelligence',
  'World-Changing Events',
];

const stockUniverse = [
  ['VNTCH', 'Venturer Technologies', 'Technology', 480, 5],
  ['VNDFN', 'VentureDefense Ltd', 'Defense', 310, 6],
  ['GRNRG', 'GreenPower Energy', 'Energy', 220, 7],
  ['MEDHC', 'MedCore Healthcare', 'Healthcare', 150, 5],
  ['AGRFM', 'AgroFarm Industries', 'Agriculture', 95, 6],
  ['STELB', 'StellarBank Financial', 'Banking', 200, 5],
  ['TELEQ', 'TeleQuest Telecom', 'Telecom', 175, 4],
  ['REALX', 'RealtX Properties', 'Real Estate', 260, 5],
  ['AUTRX', 'AutoRex Motors', 'Automobile', 320, 6],
  ['ENTFX', 'EntertainFX Media', 'Entertainment', 130, 7],
  ['COMXZ', 'CommodiXZ Trading', 'Commodity', 85, 8],
  ['FODBZ', 'FoodBuzz FMCG', 'Food', 110, 4],
  ['PNKBT', 'PinkBit Micro Tech', 'Technology', 12, 15],
  ['PNKRG', 'PinkRig Energy', 'Energy', 8, 18],
  ['PNKMD', 'PinkMed Labs', 'Healthcare', 5, 20],
] as const;

const sampleUsers = [
  ['admin', 'venturers-admin', 'Event Admin', UserRole.ADMIN],
  ['spare-admin', 'venturers-admin', 'Spare Admin', UserRole.ADMIN],
  ['spare-trader-1', 'market-ready', 'Spare Trader 1', UserRole.PARTICIPANT],
  ['spare-trader-2', 'market-ready', 'Spare Trader 2', UserRole.PARTICIPANT],
  ['alice', 'market-ready', 'Alice Rao', UserRole.PARTICIPANT],
  ['bruno', 'market-ready', 'Bruno Shah', UserRole.PARTICIPANT],
  ['charu', 'market-ready', 'Charu Iyer', UserRole.PARTICIPANT],
  ['dev', 'market-ready', 'Dev Mehta', UserRole.PARTICIPANT],
] as const;

async function main(): Promise<void> {
  await prisma.trade.deleteMany();
  await prisma.holding.deleteMany();
  await prisma.newsEvent.deleteMany();
  await prisma.adminEvent.deleteMany();
  await prisma.marketState.deleteMany();
  await prisma.round.deleteMany();
  await prisma.stock.deleteMany();
  await prisma.user.deleteMany();

  await prisma.stock.createMany({
    data: stockUniverse.map(([ticker, companyName, sector, basePrice, volatilityPct]) => ({
      ticker,
      companyName,
      sector,
      currentPrice: basePrice.toFixed(2),
      basePrice: basePrice.toFixed(2),
      availableSupply: ticker.startsWith('PNK') ? 8000 : 2500,
      volatilityPct: volatilityPct.toFixed(2),
      isTradeable: false,
    })),
  });

  await prisma.round.createMany({
    data: rounds.map((name, index) => ({
      number: index + 1,
      name,
      status: RoundStatus.PENDING,
    })),
  });

  const hashedUsers = await Promise.all(
    sampleUsers.map(async ([username, password, displayName, role]) => ({
      username,
      passwordHash: await bcrypt.hash(password, 10),
      displayName,
      role,
    })),
  );

  await prisma.user.createMany({
    data: hashedUsers,
  });

  await prisma.marketState.create({
    data: {
      id: 1,
      roundStatus: RoundStatus.PENDING,
      leaderboardVisible: false,
      tradingHalted: false,
      eventVersion: 1,
    },
  });

  console.log('Database seeded.');
  console.log('Admin credentials: admin / venturers-admin');
  console.log('Participant credentials: alice / market-ready');
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
