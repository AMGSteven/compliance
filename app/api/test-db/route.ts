import { NextResponse } from 'next/server';
import { prisma } from '../../../lib/prisma';
import { InternalDNCChecker } from '../../../lib/compliance/checkers/internal-dnc-checker';

export async function GET() {
  const results: any = {
    connection: null,
    dashboardStats: null,
    dncOperations: null,
    leadOperations: null,
    trustedFormOperations: null,
    errors: []
  };

  try {
    console.log('Testing database connection...');
    console.log('Database URL:', process.env.DATABASE_URL);

    // Test basic connection
    const connectionTest = await prisma.$queryRaw<{ current_timestamp: Date, current_database: string, current_user: string }[]>`
      SELECT current_timestamp, current_database(), current_user
    `;
    results.connection = { success: true, data: connectionTest[0] };

    // Test dashboard stats
    try {
      // Check if tables exist first
      const tableCheck = await prisma.$queryRaw<{ table_name: string }[]>`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name IN ('leads', 'trusted_form_records')
      `;
      const existingTables = new Set(tableCheck.map(t => t.table_name));

      const [totalLeads, leadsByStatus]: [{ count: number }[], { status: string, count: number }[]] = existingTables.has('leads') ? await Promise.all([
        prisma.$queryRaw<{ count: number }[]>`SELECT COUNT(*) as count FROM leads`,
        prisma.$queryRaw<{ status: string, count: number }[]>`SELECT status, COUNT(*) as count FROM leads GROUP BY status`
      ]) : [[{ count: 0 }], []];

      const certCount: { count: number }[] = existingTables.has('trusted_form_records') ? 
        await prisma.$queryRaw<{ count: number }[]>`SELECT COUNT(*) as count FROM trusted_form_records` :
        [{ count: 0 }];
      results.dashboardStats = {
        success: true,
        totalLeads: totalLeads[0].count,
        leadsByStatus,
        certCount: certCount[0].count
      };
    } catch (error: any) {
      results.errors.push({ component: 'dashboardStats', error: error.message });
      results.dashboardStats = { success: false, error: error.message };
    }

    // Test DNC operations
    try {
      const checker = new InternalDNCChecker();
      const testNumber = '+18888888888';
      
      // Add to DNC
      await checker.addToDNC({
        phone_number: testNumber,
        reason: 'Test addition',
        source: 'test_api',
        added_by: 'test_script'
      });

      // Check number
      const checkResult = await checker.checkNumber(testNumber);

      // Clean up
      await prisma.$queryRaw`DELETE FROM dnc_entries WHERE phone_number = ${testNumber}`;

      results.dncOperations = {
        success: true,
        checkResult
      };
    } catch (error: any) {
      results.errors.push({ component: 'dncOperations', error: error.message });
      results.dncOperations = { success: false, error: error.message };
    }

    // Test lead operations
    try {
      // Create test lead
      // Check if leads table exists
      const hasLeadsTable = (await prisma.$queryRaw<{ exists: boolean }[]>`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = 'leads'
        )`)[0].exists;

      if (!hasLeadsTable) {
        throw new Error('Leads table does not exist');
      }

      const testLead = await prisma.$queryRaw<{ id: string, first_name: string, last_name: string, email: string, phone: string, zip_code: string, trusted_form_cert_url: string, status: string }[]>`
        INSERT INTO leads (
          id, first_name, last_name, email, phone, zip_code, 
          trusted_form_cert_url, status, created_at, updated_at
        ) VALUES (
          gen_random_uuid(), 'Test', 'User', 'test@example.com',
          '+18887776666', '12345', 'https://cert.trustedform.com/test',
          'new', NOW(), NOW()
        ) RETURNING *
      `;

      // Clean up
      await prisma.$queryRaw`DELETE FROM leads WHERE id = uuid_in(md5(${testLead[0].id})::cstring)`;

      results.leadOperations = {
        success: true,
        testLead: testLead[0]
      };
    } catch (error: any) {
      results.errors.push({ component: 'leadOperations', error: error.message });
      results.leadOperations = { success: false, error: error.message };
    }

    // Test TrustedForm operations
    try {
      const certId = 'test_cert_' + Date.now();
      // Check if trusted_form_records table exists
      const hasTrustedFormTable = (await prisma.$queryRaw<{ exists: boolean }[]>`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = 'trusted_form_records'
        )`)[0].exists;

      if (!hasTrustedFormTable) {
        throw new Error('TrustedForm records table does not exist');
      }

      const testCert = await prisma.$queryRaw<{ id: string, certificate_id: string, phone_number: string, email: string, page_url: string, expires_at: Date, metadata: any, status: string }[]>`
        INSERT INTO trusted_form_records (
          id, certificate_id, phone_number, email, page_url,
          expires_at, metadata, created_at, status
        ) VALUES (
          gen_random_uuid(), ${certId}, '+18887776666',
          'test@example.com', 'https://example.com',
          ${new Date(Date.now() + 86400000)}, '{"test": true}',
          NOW(), 'active'
        ) RETURNING *
      `;

      // Clean up
      await prisma.$queryRaw`DELETE FROM trusted_form_records WHERE certificate_id = ${certId}`;

      results.trustedFormOperations = {
        success: true,
        testCert: testCert[0]
      };
    } catch (error: any) {
      results.errors.push({ component: 'trustedFormOperations', error: error.message });
      results.trustedFormOperations = { success: false, error: error.message };
    }

    return NextResponse.json(results);
  } catch (error: any) {
    console.error('Test suite failed:', error);
    return NextResponse.json({
      error: 'Test suite failed',
      details: { message: error.message },
      results
    }, { status: 500 });
  }
}
