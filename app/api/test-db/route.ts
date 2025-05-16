import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET() {
  try {
    // Log environment
    console.log('Environment:', process.env.NODE_ENV);
    
    // Log database connection info (safely)
    const dbUrl = process.env.DATABASE_URL || 'not set';
    console.log('Database connection info:', {
      host: dbUrl.split('@')[1]?.split(':')[0] || 'unknown',
      dbName: dbUrl.split('/').pop() || 'unknown'
    });

    // Test connection
    await prisma.$queryRaw`SELECT 1`;
    
    // Test tables
    const tableTests = await Promise.allSettled([
      prisma.leads.count(),
      prisma.dNCEntry.count()
    ]);

    return NextResponse.json({
      success: true,
      connection: 'successful',
      tables: {
        leads: tableTests[0].status === 'fulfilled' ? 'accessible' : 'error',
        dncEntry: tableTests[1].status === 'fulfilled' ? 'accessible' : 'error'
      }
    });
  } catch (error: any) {
    console.error('Database test failed:', {
      error: error.message,
      name: error.name,
      code: error.code,
      meta: error.meta
    });
    
    return NextResponse.json({
      success: false,
      error: error.message,
      details: {
        name: error.name,
        code: error.code,
        meta: error.meta
      }
    }, { status: 500 });
  }
}
