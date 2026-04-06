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
  ['TSLA', 'Tesla', 'Automobile', 20500, 0.5],
  ['VW', 'Volkswagen Group', 'Automobile', 11500, 0.3],
  ['BMW', 'BMW', 'Automobile', 9000, 0.3],
  ['MBG', 'Mercedes-Benz Group', 'Automobile', 7000, 0.3],
  ['TATAM', 'Tata Motors', 'Automobile', 950, 0.8],
  ['OLECT', 'Olectra Greentech', 'Automobile', 1900, 1.0],
  ['HYNDAI', 'Hyundai Motor Company', 'Automobile', 4500, 0.3],

  // Technology
  ['TCS', 'TCS', 'Technology', 4200, 0.5],
  ['INFY', 'Infosys', 'Technology', 1700, 0.6],
  ['WIPRO', 'Wipro', 'Technology', 550, 0.8],
  ['HCLT', 'HCLTech', 'Technology', 1500, 0.6],
  ['AAPL', 'PineApple', 'Technology', 3000, 0.4], 
  ['META', 'Meta', 'Technology', 10000, 0.5],
  ['NVDA', 'NVIDIA', 'Technology', 75000, 0.8],

  // Banking
  ['HDFCB', 'HDFC Bank', 'Banking', 751, 0.4],
  ['ICICI', 'ICICI Bank', 'Banking', 1216, 0.5],
  ['SBI', 'State Bank of India', 'Banking', 1018, 0.6],
  ['AXIS', 'Axis Bank', 'Banking', 1198, 0.5],
  ['KOTAK', 'Kotak Mahindra Bank', 'Banking', 358, 0.4],
  ['BOB', 'Bank of Baroda', 'Banking', 250, 0.8],
  ['PNB', 'Punjab National Bank', 'Banking', 104, 1.0],

  // Entertainment
  ['PVR', 'PVR INOX Ltd', 'Entertainment', 942, 0.7],
  ['SUNTV', 'Sun TV Network', 'Entertainment', 595, 0.8],
  ['ZEE', 'Zee Entertainment', 'Entertainment', 74, 1.2],
  ['NFLX', 'Netflix, Inc.', 'Entertainment', 8188, 0.5],
  ['DIS', 'The Walt Disney Co.', 'Entertainment', 8018, 0.4],
  ['WBD', 'Warner Bros. Discovery', 'Entertainment', 2267, 0.6],
  ['SONY', 'Sony Group Corp', 'Entertainment', 1720, 0.4],

  // Telecom
  ['JIO', 'Reliance Jio', 'Telecom', 1350, 0.5],
  ['BHARTI', 'Bharti Airtel', 'Telecom', 1792, 0.5],
  ['IDEA', 'Vodafone Idea', 'Telecom', 8.55, 2.5], 
  ['ATT', 'AT&T', 'Telecom', 2351, 0.4],
  ['VZ', 'Verizon', 'Telecom', 4100, 0.4],
  ['TMUS', 'T-Mobile', 'Telecom', 16716, 0.4],
  ['NTT', 'NTT Docomo', 'Telecom', 2051, 0.4],

  // Defence
  ['HAL', 'Hindustan Aeronautics', 'Defence', 3687, 0.6],
  ['BEL', 'Bharat Electronics', 'Defence', 421, 0.8],
  ['MAZD', 'Mazagon Dock Shipbuilders', 'Defence', 2245, 1.0],
  ['LMT', 'Lockheed Martin', 'Defence', 51691, 0.3],
  ['BA', 'Boeing', 'Defence', 17282, 0.4],
  ['NOC', 'Northrop Grumman', 'Defence', 58307, 0.3],
  ['BAES', 'BAE Systems', 'Defence', 2385, 0.4],

  // Real Estate
  ['DLF', 'DLF Ltd', 'Real Estate', 522, 0.8],
  ['GODREJ', 'Godrej Properties', 'Real Estate', 1508, 0.7],
  ['LODHA', 'Macrotech Developers', 'Real Estate', 697, 0.8],
  ['OBEROI', 'Oberoi Realty', 'Real Estate', 1415, 0.7],
  ['AMT', 'American Tower', 'Real Estate', 14421, 0.4],
  ['PLD', 'Prologis, Inc.', 'Real Estate', 11103, 0.4],
  ['CBRE', 'CBRE Group', 'Real Estate', 11338, 0.5],

  // Travel
  ['INDIGO', 'InterGlobe Aviation', 'Travel', 4170, 0.6],
  ['TAJ', 'Indian Hotels Co.', 'Travel', 584, 0.8],
  ['IRCTC', 'IRCTC', 'Travel', 513, 0.7],
  ['EIH', 'EIH Limited', 'Travel', 289, 0.9],
  ['LEMON', 'Lemon Tree Hotels', 'Travel', 108, 1.2],
  ['THOMAS', 'Thomas Cook India', 'Travel', 95, 1.5],
  ['MMYT', 'MakeMyTrip', 'Travel', 3307, 0.8],

  // Food & Beverages
  ['NESTLE', 'Nestle India', 'Food and Beverages', 1191, 0.3],
  ['BRIT', 'Britannia Industries', 'Food and Beverages', 5442, 0.3],
  ['TATAC', 'Tata Consumer Products', 'Food and Beverages', 1044, 0.4],
  ['VBL', 'Varun Beverages', 'Food and Beverages', 404, 0.6],
  ['KO', 'Coca-Cola Co.', 'Food and Beverages', 5810, 0.2],
  ['PEP', 'PepsiCo, Inc.', 'Food and Beverages', 14359, 0.2],

  // Penny Stocks (Capped to prevent extreme spikes)
  ['PNKHATH', 'Hathway Cable & Datacom', 'Penny Stocks', 8.58, 2.5],
  ['PNKYES', 'Yes Bank', 'Penny Stocks', 17.87, 2.0],
  ['PNKSUZ', 'Suzlon Energy', 'Penny Stocks', 40.78, 2.5],
  ['PNKTRI', 'Trident Ltd', 'Penny Stocks', 24.12, 2.0],
  ['PNKREL', 'Reliance Power', 'Penny Stocks', 22.64, 3.0],
  ['PNKJP', 'Jaiprakash Power', 'Penny Stocks', 15.01, 3.0],
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
