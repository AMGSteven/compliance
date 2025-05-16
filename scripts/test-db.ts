import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({
  log: ['query', 'info', 'warn', 'error'],
});

async function testConnection() {
  try {
    console.log('Database URL:', process.env.DATABASE_URL);
    console.log('Attempting to connect to database...');
    
    // Try a simple query
    const result = await prisma.$queryRaw`SELECT current_timestamp, current_database(), current_user`;
    console.log('Connection successful!');
    console.log('Query result:', result);

    // Try to access the DNC table
    console.log('\nTesting DNC table access...');
    const dncCount = await prisma.dNCEntry.count();
    console.log('DNC entries count:', dncCount);

  } catch (error: any) {
    console.error('Database connection failed:', {
      message: error.message,
      code: error.code,
      meta: error.meta
    });
  } finally {
    await prisma.$disconnect();
  }
}

testConnection();
