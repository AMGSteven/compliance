import { NextRequest } from 'next/server';
import { z } from 'zod';
import { TrustedFormService } from '@/lib/services/trusted-form';

const verifySchema = z.object({
  certificateId: z.string(),
  phoneNumber: z.string().optional(),
  email: z.string().optional(),
  reference: z.string().optional(),
  vendor: z.string().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validatedData = verifySchema.parse(body);

    const { certificateId, ...data } = validatedData;
    const record = await TrustedFormService.verifyCertificate(certificateId, data);

    return Response.json({
      success: true,
      record,
    });
  } catch (error) {
    console.error('Error verifying TrustedForm certificate:', error);
    return Response.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 400 });
  }
}
