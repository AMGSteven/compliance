import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET() {
  try {
    const recentDNC = await prisma.dNCEntry.findMany({
      where: {
        status: 'active'
      },
      orderBy: {
        date_added: 'desc'
      },
      take: 5
    });

    return NextResponse.json(recentDNC);
  } catch (error: any) {
    console.error('Error fetching recent DNC entries:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
