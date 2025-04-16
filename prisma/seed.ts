import { PrismaClient, CreditStatus, TransactionType } from '@prisma/client';
import { randomUUID } from 'crypto';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // Create test customer
  const customer = await prisma.customer.upsert({
    where: { email: 'test@example.com' },
    update: {},
    create: {
      id: randomUUID(),
      email: 'test@example.com',
      firstName: 'Test',
      lastName: 'User',
      shopifyCustomerId: '1234567890',
    },
  });

  console.log('Created test customer:', customer.id);

  // Create test credit
  const credit = await prisma.credit.upsert({
    where: { code: 'CC-TEST1234-XYZ1' },
    update: {},
    create: {
      id: randomUUID(),
      code: 'CC-TEST1234-XYZ1',
      amount: 100,
      originalAmount: 100,
      currency: 'USD',
      status: CreditStatus.ACTIVE,
      expirationDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000), // 90 days from now
      customerId: customer.id,
    },
  });

  console.log('Created test credit:', credit.id);

  // Create test transaction
  const transaction = await prisma.transaction.upsert({
    where: { id: 'test-transaction-1' },
    update: {},
    create: {
      id: 'test-transaction-1',
      creditId: credit.id,
      customerId: customer.id,
      type: TransactionType.ISSUE,
      amount: 100,
      staffId: 'admin',
      locationId: 'main-store',
      note: 'Initial credit issuance for testing',
    },
  });

  console.log('Created test transaction:', transaction.id);

  console.log('Database seeding completed successfully!');
}

main()
  .catch((e) => {
    console.error('Error during database seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  }); 