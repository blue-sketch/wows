# Venturers Market Platform

Same-origin stock market simulation platform for the Venturers EDC event. The backend serves the React client, owns session auth and Socket.IO, and keeps market control state durable in PostgreSQL through Prisma.

## Stack

- Node.js + Express + Socket.IO
- Prisma + PostgreSQL
- React + Vite
- `express-session` + `connect-pg-simple`

## Quick Start

1. Install dependencies: `npm install`
2. Create `.env` from `.env.example`
3. Generate Prisma client: `npm run prisma:generate`
4. Run migrations locally: `npm run prisma:migrate`
5. Seed demo data: `npm run prisma:seed`
6. Start development: `npm run dev`

## Production Build

- Build client and server: `npm run build`
- Run committed migrations: `npm run prisma:deploy`
- Start the server: `npm start`

## Seeded Accounts

- Admin: `admin / venturers-admin`
- Participant: `alice / market-ready`

## Recovery Scripts

- Reset password: `npx tsx scripts/reset-password.ts <username> <new-password>`
- Reverse trade: `npx tsx scripts/reverse-trade.ts <trade-id>`
