import { NextResponse } from 'next/server';
import { TrustedFormService } from '@/lib/services/trusted-form';

export async function GET() {
  try {
    const result = await TrustedFormService.getCertificateRecords({});
    return NextResponse.json(result);
  } catch (error) {
    console.error('Error fetching TrustedForm records:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
