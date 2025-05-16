/**
 * Direct database testing script for the internal DNC functionality
 */

import { PrismaClient } from '@prisma/client';

// Initialize Prisma client with the same connection string
const DATABASE_URL = "postgresql://postgres:oI1FkXxtExP9DYbI@db.xaglksnmuirvtrtdjkdu.supabase.co:6543/postgres?pgbouncer=true";

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: DATABASE_URL
    }
  }
});

// Color codes for terminal output
const colors = {
  reset: "\x1b[0m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  bold: "\x1b[1m"
};

async function testDatabaseConnection() {
  console.log(`${colors.blue}${colors.bold}Testing Database Connection...${colors.reset}`);
  try {
    const result = await prisma.$queryRaw`SELECT current_database(), current_user`;
    console.log(`${colors.green}✓ Database connection successful${colors.reset}`);
    console.log(`  Connected to: ${result[0].current_database}`);
    console.log(`  User: ${result[0].current_user}`);
    return true;
  } catch (error) {
    console.log(`${colors.red}✗ Database connection failed${colors.reset}`);
    console.log(`  Error: ${error.message}`);
    return false;
  }
}

async function testDashboardStats() {
  console.log(`\n${colors.blue}${colors.bold}Testing Dashboard Stats Queries...${colors.reset}`);
  
  try {
    // Check if required tables exist
    const tablesExist = await prisma.$queryRaw`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name IN ('leads', 'dnc_entries')
    `;
    
    const tableNames = tablesExist.map(t => t.table_name);
    console.log(`  Tables available: ${tableNames.join(', ')}`);
    
    const results = {};
    
    if (tableNames.includes('leads')) {
      // Get lead counts
      const totalLeads = await prisma.$queryRaw`SELECT COUNT(*) as count FROM leads`;
      results.totalLeads = totalLeads[0].count;
      
      // Get leads by status
      const leadsByStatus = await prisma.$queryRaw`
        SELECT status, COUNT(*) as count FROM leads GROUP BY status
      `;
      results.leadsByStatus = leadsByStatus;
      
      console.log(`${colors.green}✓ Leads data accessible${colors.reset}`);
      console.log(`  Total leads: ${results.totalLeads}`);
      if (leadsByStatus.length > 0) {
        console.log('  Leads by status:');
        leadsByStatus.forEach(status => {
          console.log(`    ${status.status}: ${status.count}`);
        });
      } else {
        console.log('  No lead status data available');
      }
    } else {
      console.log(`${colors.yellow}! Leads table not found${colors.reset}`);
    }
    
    if (tableNames.includes('dnc_entries')) {
      const dncCount = await prisma.$queryRaw`SELECT COUNT(*) as count FROM dnc_entries`;
      results.dncCount = dncCount[0].count;
      
      console.log(`${colors.green}✓ DNC entries accessible${colors.reset}`);
      console.log(`  Total DNC entries: ${results.dncCount}`);
    } else {
      console.log(`${colors.yellow}! DNC entries table not found${colors.reset}`);
    }
    
    return results;
  } catch (error) {
    console.log(`${colors.red}✗ Dashboard stats queries failed${colors.reset}`);
    console.log(`  Error: ${error.message}`);
    return null;
  }
}

async function testDNCChecker() {
  console.log(`\n${colors.blue}${colors.bold}Testing Internal DNC Checker...${colors.reset}`);
  
  const testPhoneNumber = '+18888888888';
  const testReason = 'Test via direct DB script';
  
  try {
    // First check if table exists
    const tableExists = await prisma.$queryRaw`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'dnc_entries'
      ) as exists
    `;
    
    if (!tableExists[0].exists) {
      console.log(`${colors.yellow}! DNC entries table does not exist${colors.reset}`);
      return false;
    }
    
    // Add a test entry to DNC
    console.log(`  Adding test number ${testPhoneNumber} to DNC list...`);
    const addResult = await prisma.dNCEntry.create({
      data: {
        phone_number: testPhoneNumber,
        reason: testReason,
        source: 'test_script',
        added_by: 'direct_db_test',
        status: 'active'
      }
    });
    
    if (addResult) {
      console.log(`${colors.green}✓ Added number to DNC list${colors.reset}`);
    }
    
    // Check if number is in DNC list
    console.log('  Checking if number is in DNC list...');
    const dncEntry = await prisma.dNCEntry.findFirst({
      where: {
        phone_number: testPhoneNumber
      }
    });
    
    if (dncEntry) {
      console.log(`${colors.green}✓ Number found in DNC list${colors.reset}`);
      console.log(`  Entry details:`);
      console.log(`    Phone: ${dncEntry.phone_number}`);
      console.log(`    Reason: ${dncEntry.reason}`);
      console.log(`    Added by: ${dncEntry.added_by}`);
      console.log(`    Status: ${dncEntry.status}`);
    } else {
      console.log(`${colors.red}✗ Number not found in DNC list${colors.reset}`);
    }
    
    // Cleanup
    console.log('  Cleaning up test entry...');
    await prisma.dNCEntry.delete({
      where: {
        phone_number: testPhoneNumber
      }
    });
    
    return dncEntry !== null;
  } catch (error) {
    console.log(`${colors.red}✗ DNC operations failed${colors.reset}`);
    console.log(`  Error: ${error.message}`);
    return false;
  }
}

async function runTests() {
  console.log(`${colors.blue}${colors.bold}🧪 Running Direct Database Tests 🧪${colors.reset}`);
  console.log(`${colors.blue}===========================================${colors.reset}`);
  
  const connSuccess = await testDatabaseConnection();
  if (!connSuccess) {
    console.log(`${colors.red}Database connection failed. Stopping tests.${colors.reset}`);
    return;
  }
  
  const dashboardResults = await testDashboardStats();
  const dncSuccess = await testDNCChecker();
  
  // Summary
  console.log(`\n${colors.blue}${colors.bold}📊 Test Summary${colors.reset}`);
  console.log(`${colors.blue}===========================================${colors.reset}`);
  console.log(`Database Connection: ${colors.green}PASSED${colors.reset}`);
  console.log(`Dashboard Stats: ${dashboardResults ? colors.green + 'PASSED' : colors.red + 'FAILED'}${colors.reset}`);
  console.log(`Internal DNC Checker: ${dncSuccess ? colors.green + 'PASSED' : colors.red + 'FAILED'}${colors.reset}`);
  
  // Cleanup
  await prisma.$disconnect();
}

// Run the tests
runTests().catch(error => {
  console.error('Test execution failed:', error);
  prisma.$disconnect();
});
