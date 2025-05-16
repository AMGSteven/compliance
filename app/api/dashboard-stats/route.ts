import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { startOfDay } from 'date-fns';

const prisma = new PrismaClient();

interface CountResult {
  count: string | number;
}

export async function GET() {
  try {
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
    console.error('Error fetching dashboard stats:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
