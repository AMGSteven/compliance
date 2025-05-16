import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { startOfDay } from 'date-fns';

const prisma = new PrismaClient();

interface CountResult {
  count: string | number;
}

export async function GET() {
  try {
    // Log the database URL (without sensitive info)
    const dbUrl = process.env.DATABASE_URL || 'not set';
    console.log('Database connection info:', {
      host: dbUrl.split('@')[1]?.split(':')[0] || 'unknown',
      dbName: dbUrl.split('/').pop() || 'unknown'
    });

    // Test database connection
    try {
      await prisma.$queryRaw`SELECT 1`;
      console.log('Database connection test successful');
    } catch (connError: any) {
      console.error('Database connection test failed:', {
        error: connError.message,
        code: connError.code,
        meta: connError.meta
      });
      return NextResponse.json(
        { 
          success: false, 
          error: 'Database connection failed',
          details: {
            message: connError.message,
            code: connError.code
          }
        },
        { status: 500 }
      );
    }
    // Get total leads count
    const totalLeads = await prisma.$queryRaw<CountResult[]>`
      SELECT COUNT(*) as count FROM "leads"
    `;

    // Get total DNC entries
    const totalDNC = await prisma.dNCEntry.count({
      where: {
        status: 'active'
      }
    });

    // Get leads added today
    const today = startOfDay(new Date());
    const leadsToday = await prisma.$queryRaw<CountResult[]>`
      SELECT COUNT(*) as count 
      FROM "leads" 
      WHERE created_at >= ${today}
    `;

    // Get DNC entries added today
    const dncToday = await prisma.dNCEntry.count({
      where: {
        date_added: {
          gte: today
        },
        status: 'active'
      }
    });

    return NextResponse.json({
      totalContacts: Number(totalLeads[0].count),
      activeOptOuts: totalDNC,
      optInsToday: Number(leadsToday[0].count),
      optOutsToday: dncToday
    });
  } catch (error: any) {
    console.error('Error fetching dashboard stats:', {
      error: error.message,
      stack: error.stack,
      name: error.name,
      code: error.code
    });
    return NextResponse.json(
      { 
        success: false, 
        error: error.message,
        details: {
          name: error.name,
          code: error.code
        }
      },
      { status: 500 }
    );
  }
}
