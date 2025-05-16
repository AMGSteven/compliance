import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import { TrustedFormService } from '@/lib/services/trusted-form';

const prisma = new PrismaClient();

// Schema for POST request
const createTrustedFormSchema = z.object({
  certificate_id: z.string(),
  phone_number: z.string(),
  email: z.string().optional(),
  expires_at: z.string().transform(str => new Date(str)),
  page_url: z.string().url(),
  reference: z.string().optional(),
  vendor: z.string().optional(),
  metadata: z.record(z.any()).optional(),
});

// Schema for GET query parameters
const getTrustedFormSchema = z.object({
  phone_number: z.string().optional(),
  email: z.string().optional(),
  page: z.string().transform(Number).default('1'),
  limit: z.string().transform(Number).default('10'),
});

// POST /api/trusted-form - Store a new TrustedForm record
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const validatedData = createTrustedFormSchema.parse(body);

    const record = await prisma.trustedFormRecord.create({
      data: {
        ...validatedData,
        metadata: validatedData.metadata || {},
      },
    });

    return NextResponse.json(record, { status: 201 });
  } catch (error) {
    console.error('Error creating TrustedForm record:', error);
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid request data', details: error.errors }, { status: 400 });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// GET /api/trusted-form - Get TrustedForm records with pagination and filtering
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');

    const result = await TrustedFormService.listRetainedCertificates(page, limit);
    return NextResponse.json(result);
  } catch (error) {
    console.error('Error getting TrustedForm records:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
