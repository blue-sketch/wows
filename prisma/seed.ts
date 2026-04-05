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
  // Automobile
  ['TSLA', 'Tesla', 'Automobile', 20500, 7],
  ['VW', 'Volkswagen Group', 'Automobile', 11500, 5],
  ['BMW', 'BMW', 'Automobile', 9000, 5],
  ['MBG', 'Mercedes-Benz Group', 'Automobile', 7000, 5],
  ['TATAM', 'Tata Motors', 'Automobile', 950, 6],
  ['OLECT', 'Olectra Greentech', 'Automobile', 1900, 8],
  ['HYNDAI', 'Hyundai Motor Company', 'Automobile', 4500, 5],

  // Technology
  ['TCS', 'TCS', 'Technology', 4200, 4],
  ['INFY', 'Infosys', 'Technology', 1700, 4],
  ['WIPRO', 'Wipro', 'Technology', 550, 5],
  ['HCLT', 'HCLTech', 'Technology', 1500, 4],
  ['AAPL', 'PineApple', 'Technology', 3000, 5], // Renamed ticker for PineApple
  ['META', 'Meta', 'Technology', 10000, 6],
  ['NVDA', 'NVIDIA', 'Technology', 75000, 8],

  // Banking
  ['HDFCB', 'HDFC Bank', 'Banking', 751, 3],
  ['ICICI', 'ICICI Bank', 'Banking', 1216, 4],
  ['SBI', 'State Bank of India', 'Banking', 1018, 4],
  ['AXIS', 'Axis Bank', 'Banking', 1198, 4],
  ['KOTAK', 'Kotak Mahindra Bank', 'Banking', 358, 4],
  ['BOB', 'Bank of Baroda', 'Banking', 250, 5],
  ['PNB', 'Punjab National Bank', 'Banking', 104, 5],

  // Entertainment
  ['PVR', 'PVR INOX Ltd', 'Entertainment', 942, 6],
  ['SUNTV', 'Sun TV Network', 'Entertainment', 595, 6],
  ['ZEE', 'Zee Entertainment', 'Entertainment', 74, 8],
  ['NFLX', 'Netflix, Inc.', 'Entertainment', 8188, 6],
  ['DIS', 'The Walt Disney Co.', 'Entertainment', 8018, 5],
  ['WBD', 'Warner Bros. Discovery', 'Entertainment', 2267, 7],
  ['SONY', 'Sony Group Corp', 'Entertainment', 1720, 5],

  // Telecom
  ['JIO', 'Reliance Jio', 'Telecom', 1350, 4],
  ['BHARTI', 'Bharti Airtel', 'Telecom', 1792, 4],
  ['IDEA', 'Vodafone Idea', 'Telecom', 8.55, 10],
  ['ATT', 'AT&T', 'Telecom', 2351, 3],
  ['VZ', 'Verizon', 'Telecom', 4100, 3],
  ['TMUS', 'T-Mobile', 'Telecom', 16716, 4],
  ['NTT', 'NTT Docomo', 'Telecom', 2051, 3],

  // Defence
  ['HAL', 'Hindustan Aeronautics', 'Defence', 3687, 6],
  ['BEL', 'Bharat Electronics', 'Defence', 421, 6],
  ['MAZD', 'Mazagon Dock Shipbuilders', 'Defence', 2245, 7],
  ['LMT', 'Lockheed Martin', 'Defence', 51691, 4],
  ['BA', 'Boeing', 'Defence', 17282, 5],
  ['NOC', 'Northrop Grumman', 'Defence', 58307, 4],
  ['BAES', 'BAE Systems', 'Defence', 2385, 4],

  // Real Estate
  ['DLF', 'DLF Ltd', 'Real Estate', 522, 6],
  ['GODREJ', 'Godrej Properties', 'Real Estate', 1508, 6],
  ['LODHA', 'Macrotech Developers', 'Real Estate', 697, 6],
  ['OBEROI', 'Oberoi Realty', 'Real Estate', 1415, 6],
  ['AMT', 'American Tower', 'Real Estate', 14421, 4],
  ['PLD', 'Prologis, Inc.', 'Real Estate', 11103, 4],
  ['CBRE', 'CBRE Group', 'Real Estate', 11338, 5],

  // Travel
  ['INDIGO', 'InterGlobe Aviation', 'Travel', 4170, 6],
  ['TAJ', 'Indian Hotels Co.', 'Travel', 584, 5],
  ['IRCTC', 'IRCTC', 'Travel', 513, 5],
  ['EIH', 'EIH Limited', 'Travel', 289, 5],
  ['LEMON', 'Lemon Tree Hotels', 'Travel', 108, 6],
  ['THOMAS', 'Thomas Cook India', 'Travel', 95, 6],
  ['MMYT', 'MakeMyTrip', 'Travel', 3307, 6],

  // Food & Beverages
  ['NESTLE', 'Nestle India', 'Food and Beverages', 1191, 3],
  ['BRIT', 'Britannia Industries', 'Food and Beverages', 5442, 3],
  ['TATAC', 'Tata Consumer Products', 'Food and Beverages', 1044, 4],
  ['VBL', 'Varun Beverages', 'Food and Beverages', 404, 5],
  ['KO', 'Coca-Cola Co.', 'Food and Beverages', 5810, 3],
  ['PEP', 'PepsiCo, Inc.', 'Food and Beverages', 14359, 3],

  // Penny Stocks (Prefixed with PNK for your supply logic)
  ['PNKHATH', 'Hathway Cable & Datacom', 'Penny Stocks', 8.58, 15],
  ['PNKYES', 'Yes Bank', 'Penny Stocks', 17.87, 12],
  ['PNKSUZ', 'Suzlon Energy', 'Penny Stocks', 40.78, 15],
  ['PNKTRI', 'Trident Ltd', 'Penny Stocks', 24.12, 12],
  ['PNKREL', 'Reliance Power', 'Penny Stocks', 22.64, 18],
  ['PNKJP', 'Jaiprakash Power', 'Penny Stocks', 15.01, 18],
] as const;

const sampleUsers = [
  // 2 Admin Accounts
  ['admin', 'venturers-admin', 'Lead Admin', UserRole.ADMIN],
  ['co-admin', 'venturers-admin', 'Co-Admin', UserRole.ADMIN],

  // 20 Participant Accounts (Team 1 to 20 with unique passwords)
  ['team1', 'trade-391', 'Team 1', UserRole.PARTICIPANT],
  ['team2', 'trade-842', 'Team 2', UserRole.PARTICIPANT],
  ['team3', 'trade-219', 'Team 3', UserRole.PARTICIPANT],
  ['team4', 'trade-774', 'Team 4', UserRole.PARTICIPANT],
  ['team5', 'trade-508', 'Team 5', UserRole.PARTICIPANT],
  ['team6', 'trade-963', 'Team 6', UserRole.PARTICIPANT],
  ['team7', 'trade-145', 'Team 7', UserRole.PARTICIPANT],
  ['team8', 'trade-682', 'Team 8', UserRole.PARTICIPANT],
  ['team9', 'trade-337', 'Team 9', UserRole.PARTICIPANT],
  ['team10', 'trade-591', 'Team 10', UserRole.PARTICIPANT],
  ['team11', 'trade-804', 'Team 11', UserRole.PARTICIPANT],
  ['team12', 'trade-256', 'Team 12', UserRole.PARTICIPANT],
  ['team13', 'trade-710', 'Team 13', UserRole.PARTICIPANT],
  ['team14', 'trade-489', 'Team 14', UserRole.PARTICIPANT],
  ['team15', 'trade-924', 'Team 15', UserRole.PARTICIPANT],
  ['team16', 'trade-173', 'Team 16', UserRole.PARTICIPANT],
  ['team17', 'trade-648', 'Team 17', UserRole.PARTICIPANT],
  ['team18', 'trade-305', 'Team 18', UserRole.PARTICIPANT],
  ['team19', 'trade-529', 'Team 19', UserRole.PARTICIPANT],
  ['team20', 'trade-881', 'Team 20', UserRole.PARTICIPANT],
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
  console.log('Participant credentials: Check the sampleUsers array for team passwords!');
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
