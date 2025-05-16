import { prisma } from '../lib/prisma';
import { InternalDNCChecker } from '../lib/compliance/checkers/internal-dnc-checker';

async function testDashboardStats() {
  console.log('\n=== Testing Dashboard Stats ===');
  try {
    // Test leads count
    const totalLeads = await prisma.$queryRaw`SELECT COUNT(*) as count FROM leads`;
    console.log('Total leads:', totalLeads[0].count);

    // Test leads by status
    const leadsByStatus = await prisma.$queryRaw`
      SELECT status, COUNT(*) as count 
      FROM leads 
      GROUP BY status
    `;
    console.log('Leads by status:', leadsByStatus);

    // Test trusted form certificates
    const certCount = await prisma.$queryRaw`SELECT COUNT(*) as count FROM trusted_form_records`;
    console.log('Total trusted form certificates:', certCount[0].count);

  } catch (error) {
    console.error('Dashboard stats test failed:', error);
  }
}

async function testInternalDNC() {
  console.log('\n=== Testing Internal DNC ===');
  const checker = new InternalDNCChecker();

  try {
    // Test DNC count
    const dncCount = await prisma.dNCEntry.count();
    console.log('Total DNC entries:', dncCount);

    // Test adding a new DNC entry
    const testNumber = '+18888888888';
    const addResult = await checker.addToDNC({
      phone_number: testNumber,
      reason: 'Test addition',
      source: 'test_script',
      added_by: 'test_script',
      metadata: { test: true }
    });
    console.log('Added DNC entry:', addResult);

    // Test checking the number
    const checkResult = await checker.checkNumber(testNumber);
    console.log('Check result for added number:', checkResult);

    // Clean up test entry
    await prisma.dNCEntry.delete({
      where: { phone_number: testNumber }
    });
    console.log('Cleaned up test DNC entry');

  } catch (error) {
    console.error('Internal DNC test failed:', error);
  }
}

async function testLeadOperations() {
  console.log('\n=== Testing Lead Operations ===');
  try {
    // Create a test lead
    const testLead = await prisma.$queryRaw`
      INSERT INTO leads (
        id, first_name, last_name, email, phone, zip_code, 
        trusted_form_cert_url, status, created_at, updated_at
      ) VALUES (
        gen_random_uuid(), 'Test', 'User', 'test@example.com',
        '+18887776666', '12345', 'https://cert.trustedform.com/test',
        'new', NOW(), NOW()
      ) RETURNING *
    `;
    console.log('Created test lead:', testLead[0]);

    // Fetch the lead
    const fetchedLead = await prisma.$queryRaw`
      SELECT * FROM leads WHERE id = ${testLead[0].id}
    `;
    console.log('Retrieved lead:', fetchedLead[0]);

    // Clean up
    await prisma.$queryRaw`
      DELETE FROM leads WHERE id = ${testLead[0].id}
    `;
    console.log('Cleaned up test lead');

  } catch (error) {
    console.error('Lead operations test failed:', error);
  }
}

async function testTrustedFormOperations() {
  console.log('\n=== Testing TrustedForm Operations ===');
  try {
    // Create a test certificate
    const certId = 'test_cert_' + Date.now();
    const testCert = await prisma.$queryRaw`
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
    console.log('Created test certificate:', testCert[0]);

    // Fetch the certificate
    const fetchedCert = await prisma.$queryRaw`
      SELECT * FROM trusted_form_records 
      WHERE certificate_id = ${certId}
    `;
    console.log('Retrieved certificate:', fetchedCert[0]);

    // Clean up
    await prisma.$queryRaw`
      DELETE FROM trusted_form_records 
      WHERE certificate_id = ${certId}
    `;
    console.log('Cleaned up test certificate');

  } catch (error) {
    console.error('TrustedForm operations test failed:', error);
  }
}

async function runAllTests() {
  try {
    console.log('Starting database connection test...');
    await prisma.$connect();
    console.log('Database connected successfully!');

    await testDashboardStats();
    await testInternalDNC();
    await testLeadOperations();
    await testTrustedFormOperations();

  } catch (error) {
    console.error('Test suite failed:', error);
  } finally {
    await prisma.$disconnect();
  }
}

runAllTests();
