import { NextResponse } from 'next/server';
import { prisma } from '../../../lib/prisma';

export async function GET() {
  try {
    console.log('DB Test: Attempting to connect to database...');
    
    // Test database connection
    const connectionTest = await prisma.$queryRaw`SELECT 1 as test`;
    console.log('DB Test: Connection successful:', connectionTest);
    
    // Try to get a small sample of data to verify table access
    let tableTests = {
      leads: null,
      dncEntries: null
    };
    
    try {
      const leadsTest = await prisma.lead.findMany({
        take: 1
      });
      tableTests.leads = {
        success: true,
        count: leadsTest.length,
        sample: leadsTest.length > 0 ? { id: leadsTest[0].id } : null
      };
    } catch (leadsError) {
      console.error('DB Test: Leads table access error:', leadsError);
      tableTests.leads = {
        success: false,
        error: leadsError.message,
        code: leadsError.code
      };
    }
    
    try {
      const dncTest = await prisma.dNCEntry.findMany({
        take: 1
      });
      tableTests.dncEntries = {
        success: true,
        count: dncTest.length,
        sample: dncTest.length > 0 ? { id: dncTest[0].id } : null
      };
    } catch (dncError) {
      console.error('DB Test: DNC table access error:', dncError);
      tableTests.dncEntries = {
        success: false,
        error: dncError.message,
        code: dncError.code
      };
    }
    
    // Get database connection info (without sensitive details)
    const dbUrl = process.env.DATABASE_URL || 'not set';
    const connectionInfo = {
      host: dbUrl.split('@')[1]?.split(':')[0] || 'unknown',
      dbName: dbUrl.split('/').pop() || 'unknown',
      urlLength: dbUrl.length
    };
    
    return NextResponse.json({
      success: true,
      connectionTest: !!connectionTest,
      connectionInfo,
      tableTests,
      environment: {
        NODE_ENV: process.env.NODE_ENV,
        VERCEL_ENV: process.env.VERCEL_ENV
      }
    });
  } catch (error) {
    console.error('DB Test: Connection error:', error);
    return NextResponse.json({
      success: false,
      error: error.message,
      code: error.code,
      meta: error.meta
    }, { status: 500 });
  }
}
