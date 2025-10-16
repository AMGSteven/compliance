/**
 * Comprehensive Test Script for Historical Bid Tracking
 * 
 * This script tests that bid amounts are properly stored with leads
 * and that changing routing bids doesn't affect historical data.
 */

import { createClient } from '@supabase/supabase-js';
import fetch from 'node-fetch';

// Test configuration
const TEST_CONFIG = {
  BASE_URL: 'http://localhost:3000', // Adjust if running on different port
  API_KEY: 'test_key_123',
  LIST_ID: '1b759535-c36a-4b05-9b72-9e123456789a', // Use existing list ID
  SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
};

// Initialize Supabase client for direct database queries
const supabase = createClient(TEST_CONFIG.SUPABASE_URL, TEST_CONFIG.SUPABASE_ANON_KEY);

// Test data for different scenarios
const TEST_SCENARIOS = [
  {
    name: 'Standard Lead with $15.00 bid',
    bidAmount: 15.00,
    payload: {
      ApiToken: TEST_CONFIG.API_KEY,
      ListId: TEST_CONFIG.LIST_ID,
      FirstName: 'John',
      LastName: 'Doe',
      Email: 'john.doe@test.com',
      Phone: '5551234567',
      ZipCode: '90210',
      State: 'CA',
      TrustedForm: 'https://cert.trustedform.com/test123'
    }
  },
  {
    name: 'Health Insurance Lead with $25.00 bid',
    bidAmount: 25.00,
    payload: {
      ApiToken: TEST_CONFIG.API_KEY,
      ListId: TEST_CONFIG.LIST_ID,
      FirstName: 'Jane',
      LastName: 'Smith',
      Email: 'jane.smith@test.com',
      Phone: '5559876543',
      Vertical: 'health-insurance',
      ContactData: {
        ZipCode: '10001',
        Address: '123 Main St',
        City: 'New York',
        State: 'NY'
      },
      Person: {
        DateOfBirth: '1990-01-01',
        Gender: 'Female',
        MaritalStatus: 'Single'
      },
      RequestedInsurance: {
        CoverageType: 'Individual'
      },
      CurrentInsurance: {
        InsuranceCompany: 'None'
      }
    }
  }
];

class HistoricalBidTracker {
  constructor() {
    this.testResults = [];
    this.createdLeads = [];
  }

  async log(message, type = 'INFO') {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] ${type}: ${message}`;
    console.log(logMessage);
  }

  async setupTest() {
    await this.log('🚀 Starting Historical Bid Tracking Tests');
    await this.log('📊 Checking database schema...');
    
    // Check if bid_amount column exists
    const { data: columns, error } = await supabase
      .from('information_schema.columns')
      .select('column_name')
      .eq('table_name', 'leads')
      .eq('column_name', 'bid_amount');
    
    if (error || !columns || columns.length === 0) {
      await this.log('❌ CRITICAL: bid_amount column not found in leads table', 'ERROR');
      await this.log('Run the migration: psql $DATABASE_URL -f migrations/add_bid_amount_to_leads.sql', 'ERROR');
      return false;
    }
    
    await this.log('✅ bid_amount column exists in leads table');
    return true;
  }

  async setListBid(bidAmount) {
    await this.log(`🔧 Setting list routing bid to $${bidAmount.toFixed(2)}`);
    
    // Update the routing bid in list_routings table
    const { error } = await supabase
      .from('list_routings')
      .update({ bid: bidAmount })
      .eq('list_id', TEST_CONFIG.LIST_ID);
    
    if (error) {
      await this.log(`❌ Failed to update routing bid: ${error.message}`, 'ERROR');
      return false;
    }
    
    await this.log(`✅ Routing bid updated to $${bidAmount.toFixed(2)}`);
    return true;
  }

  async submitLead(scenario) {
    await this.log(`📤 Submitting lead: ${scenario.name}`);
    
    // Set the routing bid before submitting the lead
    await this.setListBid(scenario.bidAmount);
    
    try {
      const response = await fetch(`${TEST_CONFIG.BASE_URL}/api/leads`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(scenario.payload)
      });
      
      const result = await response.json();
      
      if (!response.ok) {
        await this.log(`❌ Lead submission failed: ${result.error || 'Unknown error'}`, 'ERROR');
        return null;
      }
      
      await this.log(`✅ Lead submitted successfully with bid $${result.bid || 'N/A'}`);
      return result;
    } catch (error) {
      await this.log(`❌ Lead submission error: ${error.message}`, 'ERROR');
      return null;
    }
  }

  async verifyStoredBid(leadData, expectedBid) {
    await this.log(`🔍 Verifying stored bid amount for lead...`);
    
    // Query the database to get the stored bid_amount
    const { data: leads, error } = await supabase
      .from('leads')
      .select('id, bid_amount, created_at, first_name, last_name')
      .eq('phone', leadData.phone || leadData.Phone)
      .order('created_at', { ascending: false })
      .limit(1);
    
    if (error || !leads || leads.length === 0) {
      await this.log(`❌ Could not find lead in database: ${error?.message || 'No leads found'}`, 'ERROR');
      return false;
    }
    
    const lead = leads[0];
    this.createdLeads.push(lead.id);
    
    const storedBid = parseFloat(lead.bid_amount || 0);
    const expectedBidFloat = parseFloat(expectedBid);
    
    if (Math.abs(storedBid - expectedBidFloat) < 0.01) {
      await this.log(`✅ Bid amount correctly stored: $${storedBid.toFixed(2)} (expected: $${expectedBidFloat.toFixed(2)})`);
      return true;
    } else {
      await this.log(`❌ Bid amount mismatch: stored $${storedBid.toFixed(2)}, expected $${expectedBidFloat.toFixed(2)}`, 'ERROR');
      return false;
    }
  }

  async testBidHistoryPreservation() {
    await this.log('🧪 Testing that routing bid changes don\'t affect historical leads...');
    
    // Change the routing bid to a different amount
    const newBid = 99.99;
    await this.setListBid(newBid);
    
    // Verify all previously created leads still have their original bid amounts
    for (const leadId of this.createdLeads) {
      const { data: lead, error } = await supabase
        .from('leads')
        .select('bid_amount, first_name, last_name')
        .eq('id', leadId)
        .single();
      
      if (error) {
        await this.log(`❌ Failed to retrieve lead ${leadId}: ${error.message}`, 'ERROR');
        continue;
      }
      
      const storedBid = parseFloat(lead.bid_amount || 0);
      
      // The stored bid should NOT be the new routing bid
      if (Math.abs(storedBid - newBid) < 0.01) {
        await this.log(`❌ Historical bid was overwritten! Lead ${lead.first_name} ${lead.last_name} now has $${storedBid.toFixed(2)}`, 'ERROR');
        return false;
      } else {
        await this.log(`✅ Historical bid preserved for ${lead.first_name} ${lead.last_name}: $${storedBid.toFixed(2)}`);
      }
    }
    
    return true;
  }

  async runTests() {
    const schemaOk = await this.setupTest();
    if (!schemaOk) {
      return false;
    }
    
    let allTestsPassed = true;
    
    // Test each scenario
    for (const scenario of TEST_SCENARIOS) {
      await this.log(`\n=== Testing: ${scenario.name} ===`);
      
      const result = await this.submitLead(scenario);
      if (!result) {
        allTestsPassed = false;
        continue;
      }
      
      const bidVerified = await this.verifyStoredBid(scenario.payload, scenario.bidAmount);
      if (!bidVerified) {
        allTestsPassed = false;
      }
      
      await this.log(`--- End: ${scenario.name} ---\n`);
    }
    
    // Test historical preservation
    await this.log('\n=== Testing Historical Bid Preservation ===');
    const historyPreserved = await this.testBidHistoryPreservation();
    if (!historyPreserved) {
      allTestsPassed = false;
    }
    
    return allTestsPassed;
  }

  async cleanup() {
    await this.log('🧹 Cleaning up test data...');
    
    // Remove test leads
    if (this.createdLeads.length > 0) {
      const { error } = await supabase
        .from('leads')
        .delete()
        .in('id', this.createdLeads);
      
      if (error) {
        await this.log(`❌ Failed to cleanup test leads: ${error.message}`, 'ERROR');
      } else {
        await this.log(`✅ Cleaned up ${this.createdLeads.length} test leads`);
      }
    }
  }

  async generateReport(passed) {
    await this.log('\n' + '='.repeat(60));
    await this.log('📋 HISTORICAL BID TRACKING TEST REPORT');
    await this.log('='.repeat(60));
    
    if (passed) {
      await this.log('🎉 ALL TESTS PASSED!', 'SUCCESS');
      await this.log('✅ Bid amounts are correctly stored with leads');
      await this.log('✅ Historical bid data is preserved when routing changes');
      await this.log('✅ Revenue calculations will now use accurate historical bids');
    } else {
      await this.log('❌ SOME TESTS FAILED!', 'ERROR');
      await this.log('⚠️  Review the errors above and fix issues before proceeding');
    }
    
    await this.log('='.repeat(60));
  }
}

// Main execution
async function main() {
  const tracker = new HistoricalBidTracker();
  
  try {
    const allTestsPassed = await tracker.runTests();
    await tracker.generateReport(allTestsPassed);
    
    // Always cleanup, even if tests failed
    await tracker.cleanup();
    
    process.exit(allTestsPassed ? 0 : 1);
  } catch (error) {
    await tracker.log(`💥 Fatal error: ${error.message}`, 'ERROR');
    await tracker.cleanup();
    process.exit(1);
  }
}

// Run the tests
main().catch(console.error);
