#!/usr/bin/env node

// Script to restore list routing configurations from backup data
const BASE_URL = 'http://localhost:3001';
const API_KEY = 'test_key_123';

// Original list routing configurations from backup
const originalRoutings = [
  {
    list_id: 'OPG4',
    campaign_id: 'fun',
    cadence_id: 'cadence_1',
    description: 'some junk',
    bid: 0.75,
    active: true,
    dialer_type: 1
  },
  {
    list_id: 'a3838fdd-33a2-4750-9f5c-92aabfcdfe7e',
    campaign_id: 'default-campaign',
    cadence_id: 'cadence_2',
    description: 'Juiced default-campaign',
    bid: 1.25,
    active: true,
    dialer_type: 1
  },
  {
    list_id: 'juiced-auto',
    campaign_id: 'auto_insurance',
    cadence_id: 'cadence_3',
    description: 'Juiced auto insurance',
    bid: 1.25,
    active: true,
    dialer_type: 1
  },
  {
    list_id: '1b759232-2264-421a-9171-3dabf316dc03',
    campaign_id: 'health-insurance-campaign',
    cadence_id: 'cadence_4',
    description: 'Onpoint health-insurance-campaign',
    bid: 0.85,
    active: true,
    dialer_type: 1
  },
  {
    list_id: '1b759232-2264-421a-9171-3dabf316dc03',
    campaign_id: 'default-campaign',
    cadence_id: 'cadence_5',
    description: 'Onpoint default-campaign',
    bid: 0.85,
    active: true,
    dialer_type: 1
  },
  {
    list_id: 'health-insurance-data-us',
    campaign_id: 'health',
    cadence_id: 'cadence_1',
    description: 'health',
    bid: 1.25,
    active: true,
    dialer_type: 1
  },
  {
    list_id: '1b759232-2264-421a-9171-3dabf316dc03',
    campaign_id: 'h2-bdskf-ftdl-adra-bjdrk-tlr7h2q6fkh20',
    cadence_id: 'cadence_7',
    description: 'Onpoint h2-bdskf-ftdl-adra-bjdrk-tlr7h2q6fkh20',
    bid: 0.85,
    active: true,
    dialer_type: 1
  },
  {
    list_id: 'OPG4',
    campaign_id: 'life_insurance',
    cadence_id: 'cadence_3',
    description: 'Onpoint life_insurance',
    bid: 0.85,
    active: true,
    dialer_type: 1
  },
  {
    list_id: 'OPG3',
    campaign_id: 'medicare',
    cadence_id: 'cadence_4',
    description: 'Onpoint medicare',
    bid: 0.85,
    active: true,
    dialer_type: 1
  },
  {
    list_id: 'a3838fdd-33a2-4750-9f5c-92aabfcdfe7e',
    campaign_id: 'originalCampaignId/EnrollmentValidation',
    cadence_id: 'cadence_5',
    description: 'Juiced originalCampaignId/EnrollmentValidation',
    bid: 1.25,
    active: true,
    dialer_type: 1
  }
];

// Function to create a list routing via API
async function createRouting(routing) {
  try {
    const response = await fetch(`${BASE_URL}/api/list-routings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': API_KEY
      },
      body: JSON.stringify(routing)
    });

    const result = await response.json();
    
    if (result.success) {
      console.log(`✅ Created routing: ${routing.list_id} -> ${routing.campaign_id} (${routing.description}) - $${routing.bid}`);
      return true;
    } else {
      console.error(`❌ Failed to create routing ${routing.list_id}: ${result.error}`);
      return false;
    }
  } catch (error) {
    console.error(`❌ Error creating routing ${routing.list_id}:`, error.message);
    return false;
  }
}

// Function to check current routings
async function checkCurrentRoutings() {
  try {
    const response = await fetch(`${BASE_URL}/api/list-routings`, {
      headers: { 'x-api-key': API_KEY }
    });
    
    const result = await response.json();
    
    if (result.success) {
      console.log(`📊 Current routings in database: ${result.data.length}`);
      return result.data.length;
    } else {
      console.error('❌ Failed to fetch current routings:', result.error);
      return -1;
    }
  } catch (error) {
    console.error('❌ Error checking routings:', error.message);
    return -1;
  }
}

// Main restoration function
async function restoreRoutings() {
  console.log('🔄 Starting list routing restoration...');
  console.log(`📋 Found ${originalRoutings.length} routings to restore`);
  
  // Check current state
  const currentCount = await checkCurrentRoutings();
  if (currentCount === -1) {
    console.error('❌ Cannot connect to API. Make sure the server is running on localhost:3001');
    process.exit(1);
  }
  
  let successCount = 0;
  let failCount = 0;
  
  // Restore each routing
  for (const routing of originalRoutings) {
    const success = await createRouting(routing);
    if (success) {
      successCount++;
    } else {
      failCount++;
    }
    
    // Small delay to avoid overwhelming the API
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  console.log('\n🎉 Restoration complete!');
  console.log(`✅ Successfully created: ${successCount} routings`);
  console.log(`❌ Failed to create: ${failCount} routings`);
  
  // Check final state
  const finalCount = await checkCurrentRoutings();
  console.log(`📊 Total routings now in database: ${finalCount}`);
  
  if (successCount > 0) {
    console.log('\n🌐 You can now access your restored list routings at:');
    console.log(`   ${BASE_URL}/dashboard/list-routings`);
  }
}

// Run the restoration
restoreRoutings().catch(error => {
  console.error('💥 Fatal error during restoration:', error);
  process.exit(1);
});
