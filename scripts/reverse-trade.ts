import { AdminEventType, PrismaClient, TradeSide } from '@prisma/client';
import { Decimal } from 'decimal.js';

const prisma = new PrismaClient();

const tradeId = Number(process.argv[2]);

if (!Number.isInteger(tradeId) || tradeId <= 0) {
  console.error('Usage: tsx scripts/reverse-trade.ts <trade-id>');
  process.exit(1);
}

async function main(): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const trade = await tx.trade.findUnique({
      where: { id: tradeId },
    });

    if (!trade) {
      throw new Error(`Trade ${tradeId} not found.`);
    }

    const user = await tx.user.findUniqueOrThrow({ where: { id: trade.userId } });
    const stock = await tx.stock.findUniqueOrThrow({ where: { id: trade.stockId } });
    const holding = await tx.holding.findUnique({
      where: { userId_stockId: { userId: trade.userId, stockId: trade.stockId } },
    });

    const tradeValue = new Decimal(trade.price.toString()).mul(trade.quantity);

    if (trade.side === TradeSide.BUY) {
      if (!holding || holding.quantity < trade.quantity) {
        throw new Error('Cannot reverse buy trade because holdings are insufficient.');
      }

      const remaining = holding.quantity - trade.quantity;
      if (remaining === 0) {
        await tx.holding.delete({
          where: { userId_stockId: { userId: trade.userId, stockId: trade.stockId } },
        });
      } else {
        await tx.holding.update({
          where: { userId_stockId: { userId: trade.userId, stockId: trade.stockId } },
          data: { quantity: remaining },
        });
      }

      await tx.user.update({
        where: { id: trade.userId },
        data: {
          cashBalance: new Decimal(user.cashBalance.toString()).add(tradeValue).toFixed(2),
        },
      });

      await tx.stock.update({
        where: { id: trade.stockId },
        data: { availableSupply: stock.availableSupply + trade.quantity },
      });
    } else {
      const nextQuantity = (holding?.quantity ?? 0) + trade.quantity;
      await tx.holding.upsert({
        where: { userId_stockId: { userId: trade.userId, stockId: trade.stockId } },
        create: {
          userId: trade.userId,
          stockId: trade.stockId,
          quantity: nextQuantity,
          avgBuyPrice: trade.price.toString(),
        },
        update: {
          quantity: nextQuantity,
        },
      });

      await tx.user.update({
        where: { id: trade.userId },
        data: {
          cashBalance: new Decimal(user.cashBalance.toString()).sub(tradeValue).toFixed(2),
        },
      });

      await tx.stock.update({
        where: { id: trade.stockId },
        data: { availableSupply: stock.availableSupply - trade.quantity },
      });
    }

    await tx.adminEvent.create({
      data: {
        type: AdminEventType.TRADE_REVERSED,
        payload: { tradeId },
      },
    });

    await tx.trade.delete({ where: { id: tradeId } });
  });

  console.log(`Trade ${tradeId} reversed.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
