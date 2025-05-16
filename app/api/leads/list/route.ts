import { NextResponse } from 'next/server';
import { prisma } from '../../../../lib/prisma';

export async function GET() {
  try {
    const leads = await prisma.leads.findMany({
      orderBy: {
        created_at: 'desc'
      },
      take: 5
    });

    return NextResponse.json(leads);
  } catch (error) {
    console.error('Error fetching leads:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to fetch leads'
    }, { status: 500 });
  }
}
