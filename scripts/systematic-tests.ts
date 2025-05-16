import { prisma } from '../lib/prisma';
import { InternalDNCChecker } from '../lib/compliance/checkers/internal-dnc-checker';
import chalk from 'chalk';

/**
 * Systematic tests for the compliance application
 * - Tests dashboard data fetching
 * - Tests internal DNC checker functionality
 * - Tests database connectivity for both features
 */

async function runTests() {
  console.log(chalk.blue.bold('🧪 Running Systematic Database Tests 🧪'));
  console.log(chalk.blue('=========================================='));
  
  const results = {
    dashboardStats: {
      success: false,
      data: null,
      error: null
    },
    internalDNC: {
      success: false,
      data: null,
      error: null
    }
  };
  
  // Test 1: Database Connection
  try {
    console.log(chalk.yellow('Testing database connection...'));
    const connection = await prisma.$queryRaw<any[]>`SELECT current_database(), current_user`;
    console.log(chalk.green('✓ Database connection successful'));
    console.log(`  Database: ${connection[0].current_database}`);
    console.log(`  User: ${connection[0].current_user}`);
  } catch (error: any) {
    console.log(chalk.red('✗ Database connection failed'));
    console.log(`  Error: ${error.message}`);
    return;
  }

  // Test 2: Dashboard Stats
  console.log('\n' + chalk.yellow('Testing dashboard statistics API...'));
  try {
    // Check if required tables exist
    const tablesExist = await prisma.$queryRaw<{ table_name: string }[]>`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name IN ('leads', 'dnc_entries')
    `;
    
    const tableNames = tablesExist.map(t => t.table_name);
    const hasLeadsTable = tableNames.includes('leads');
    const hasDncTable = tableNames.includes('dnc_entries');
    
    console.log(`  Tables check: Leads (${hasLeadsTable ? '✓' : '✗'}), DNC Entries (${hasDncTable ? '✓' : '✗'})`);
    
    if (hasLeadsTable) {
      // Query leads count
      const totalLeads = await prisma.$queryRaw<{ count: number }[]>`
        SELECT COUNT(*) as count FROM leads
      `;
      
      // Query leads by status
      const leadsByStatus = await prisma.$queryRaw<{ status: string, count: number }[]>`
        SELECT status, COUNT(*) as count FROM leads GROUP BY status
      `;
      
      results.dashboardStats.data = {
        totalLeads: totalLeads[0].count,
        leadsByStatus: leadsByStatus
      };
      
      console.log(chalk.green('✓ Dashboard stats fetched successfully'));
      console.log(`  Total leads: ${totalLeads[0].count}`);
      console.log('  Leads by status:');
      leadsByStatus.forEach(status => {
        console.log(`    ${status.status}: ${status.count}`);
      });
      
      results.dashboardStats.success = true;
    } else {
      console.log(chalk.yellow('! Leads table does not exist, skipping stats'));
    }
    
    if (hasDncTable) {
      // Query DNC entries count
      const dncCount = await prisma.$queryRaw<{ count: number }[]>`
        SELECT COUNT(*) as count FROM dnc_entries
      `;
      
      console.log(`  Total DNC entries: ${dncCount[0].count}`);
      
      if (!results.dashboardStats.data) {
        results.dashboardStats.data = {};
      }
      results.dashboardStats.data.dncCount = dncCount[0].count;
    } else {
      console.log(chalk.yellow('! DNC entries table does not exist, skipping count'));
    }
  } catch (error: any) {
    console.log(chalk.red('✗ Dashboard stats retrieval failed'));
    console.log(`  Error: ${error.message}`);
    results.dashboardStats.error = error.message;
  }

  // Test 3: Internal DNC Checker
  console.log('\n' + chalk.yellow('Testing Internal DNC Checker...'));
  try {
    const dncChecker = new InternalDNCChecker();
    
    // Test DNC addition and checking
    const testPhoneNumber = '+18888888888';
    const testReason = 'Test addition via systematic test';
    
    console.log(`  Adding test number ${testPhoneNumber} to DNC list...`);
    await dncChecker.addToDNC({
      phone_number: testPhoneNumber,
      reason: testReason,
      source: 'test_script',
      added_by: 'systematic_test'
    });
    
    console.log('  Checking if number is on DNC list...');
    const checkResult = await dncChecker.checkNumber(testPhoneNumber);
    
    if (!checkResult.isCompliant) {
      console.log(chalk.green('✓ DNC check working correctly - number found on DNC list'));
      console.log(`  Non-compliance reason: ${checkResult.reasons.join(', ')}`);
      results.internalDNC.success = true;
      results.internalDNC.data = checkResult;
    } else {
      console.log(chalk.red('✗ DNC check failed - number should be on DNC list but was not found'));
      results.internalDNC.success = false;
    }
    
    // Clean up
    console.log('  Cleaning up test data...');
    await prisma.$queryRaw`DELETE FROM dnc_entries WHERE phone_number = ${testPhoneNumber} AND reason = ${testReason}`;
  } catch (error: any) {
    console.log(chalk.red('✗ Internal DNC Checker test failed'));
    console.log(`  Error: ${error.message}`);
    results.internalDNC.error = error.message;
  }
  
  // Summary
  console.log('\n' + chalk.blue.bold('📊 Test Summary'));
  console.log(chalk.blue('=========================================='));
  console.log(`Dashboard Stats: ${results.dashboardStats.success ? chalk.green('PASSED') : chalk.red('FAILED')}`);
  console.log(`Internal DNC Checker: ${results.internalDNC.success ? chalk.green('PASSED') : chalk.red('FAILED')}`);
  
  if (results.dashboardStats.error) {
    console.log(chalk.red(`Dashboard Stats Error: ${results.dashboardStats.error}`));
  }
  
  if (results.internalDNC.error) {
    console.log(chalk.red(`Internal DNC Checker Error: ${results.internalDNC.error}`));
  }
  
  console.log('\n');
  
  // Cleanup and close connection
  await prisma.$disconnect();
}

// Run tests
runTests()
  .catch(error => {
    console.error('Test execution failed:', error);
    prisma.$disconnect();
    process.exit(1);
  });
