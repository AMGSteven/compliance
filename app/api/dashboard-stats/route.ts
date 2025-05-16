import { NextResponse } from 'next/server';
import { prisma } from '../../../lib/prisma';
import { startOfDay } from 'date-fns';

interface CountResult {
  count: string | number;
}

export async function GET() {
  try {
    // Test database connection first
    try {
      const testResult = await prisma.$queryRaw`SELECT 1 as test`;
      console.log('Database connection test:', testResult);
    } catch (dbError: any) {
      console.error('Database connection failed:', {
        message: dbError.message,
        code: dbError.code,
        meta: dbError.meta
      });
      return NextResponse.json({
        error: 'Database connection failed',
        details: {
          message: dbError.message,
          code: dbError.code
        }
      }, { status: 500 });
    }
    // Log environment and database info
    console.log('Environment:', {
      NODE_ENV: process.env.NODE_ENV,
      VERCEL_ENV: process.env.VERCEL_ENV
    });

    // Log the database URL (without sensitive info)
    const dbUrl = process.env.DATABASE_URL || 'not set';
    console.log('Database connection info:', {
      host: dbUrl.split('@')[1]?.split(':')[0] || 'unknown',
      dbName: dbUrl.split('/').pop() || 'unknown',
      urlLength: dbUrl.length
    });

    // Test database connection
    try {
      console.log('Testing database connection...');
      const result = await prisma.$queryRaw`SELECT 1 as test`;
      console.log('Database connection test result:', result);
    } catch (connError: any) {
      console.error('Database connection test failed:', {
        error: connError.message,
        code: connError.code,
        meta: connError.meta,
        stack: connError.stack
      });
      return NextResponse.json(
        { 
          success: false, 
          error: 'Database connection failed',
          details: {
            message: connError.message,
            code: connError.code,
            meta: connError.meta
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
