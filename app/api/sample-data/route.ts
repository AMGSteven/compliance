import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

// This endpoint will create sample leads and list routings for testing the revenue tracking system
export async function GET(request: NextRequest) {
  try {
    console.log('Creating sample data for revenue tracking...');
    const supabase = createServerClient();
    
    // Sample list routings data
    const listRoutings = [
      {
        list_id: 'juiced-health',
        campaign_id: 'health_insurance',
        cadence_id: 'cadence1',
        description: 'Juiced Media Health Insurance',
        active: true,
        bid: 1.00
      },
      {
        list_id: 'juiced-auto',
        campaign_id: 'auto_insurance',
        cadence_id: 'cadence2',
        description: 'Juiced Media Auto Insurance',
        active: true,
        bid: 1.00
      },
      {
        list_id: 'OPG4',
        campaign_id: 'life_insurance',
        cadence_id: 'cadence3',
        description: 'Onpoint Life Insurance',
        active: true,
        bid: 0.50
      },
      {
        list_id: 'OPG3',
        campaign_id: 'medicare',
        cadence_id: 'cadence4',
        description: 'Onpoint Medicare',
        active: true,
        bid: 0.50
      }
    ];
    
    // Insert list routings
    const { data: routingsData, error: routingsError } = await supabase
      .from('list_routings')
      .insert(listRoutings);
    
    if (routingsError) {
      console.error('Error creating list routings:', routingsError);
    } else {
      console.log('Successfully created list routings');
    }
    
    // Sample leads data
    const leads = [];
    
    // Generate Juiced Media Health Insurance leads
    for (let i = 1; i <= 50; i++) {
      leads.push({
        first_name: `Test${i}`,
        last_name: `User${i}`,
        email: `test${i}@example.com`,
        phone: `+1${Math.floor(1000000000 + Math.random() * 9000000000)}`,
        status: 'success',
        list_id: 'juiced-health',
        campaign_id: 'health_insurance',
        traffic_source: 'Juiced',
        created_at: new Date(Date.now() - Math.floor(Math.random() * 30) * 24 * 60 * 60 * 1000).toISOString(),
        trusted_form_cert_url: `https://cert.trustedform.com/example${i}`,
        zip_code: '90210'
      });
    }
    
    // Generate Juiced Media Auto Insurance leads
    for (let i = 51; i <= 75; i++) {
      leads.push({
        first_name: `Test${i}`,
        last_name: `User${i}`,
        email: `test${i}@example.com`,
        phone: `+1${Math.floor(1000000000 + Math.random() * 9000000000)}`,
        status: 'success',
        list_id: 'juiced-auto',
        campaign_id: 'auto_insurance',
        traffic_source: 'Juiced',
        created_at: new Date(Date.now() - Math.floor(Math.random() * 30) * 24 * 60 * 60 * 1000).toISOString(),
        trusted_form_cert_url: `https://cert.trustedform.com/example${i}`,
        zip_code: '90210'
      });
    }
    
    // Generate Onpoint Life Insurance leads
    for (let i = 76; i <= 125; i++) {
      leads.push({
        first_name: `Test${i}`,
        last_name: `User${i}`,
        email: `test${i}@example.com`,
        phone: `+1${Math.floor(1000000000 + Math.random() * 9000000000)}`,
        status: 'success',
        list_id: 'OPG4',
        campaign_id: 'life_insurance',
        traffic_source: 'Onpoint',
        created_at: new Date(Date.now() - Math.floor(Math.random() * 30) * 24 * 60 * 60 * 1000).toISOString(),
        trusted_form_cert_url: `https://cert.trustedform.com/example${i}`,
        zip_code: '90210'
      });
    }
    
    // Generate Onpoint Medicare leads
    for (let i = 126; i <= 150; i++) {
      leads.push({
        first_name: `Test${i}`,
        last_name: `User${i}`,
        email: `test${i}@example.com`,
        phone: `+1${Math.floor(1000000000 + Math.random() * 9000000000)}`,
        status: 'success',
        list_id: 'OPG3',
        campaign_id: 'medicare',
        traffic_source: 'Onpoint',
        created_at: new Date(Date.now() - Math.floor(Math.random() * 30) * 24 * 60 * 60 * 1000).toISOString(),
        trusted_form_cert_url: `https://cert.trustedform.com/example${i}`,
        zip_code: '90210'
      });
    }
    
    // Insert leads in smaller batches to avoid request size limitations
    const batchSize = 25;
    const results = [];
    
    for (let i = 0; i < leads.length; i += batchSize) {
      const batch = leads.slice(i, i + batchSize);
      const { data, error } = await supabase
        .from('leads')
        .insert(batch);
      
      results.push({ success: !error, count: batch.length, error });
      
      if (error) {
        console.error(`Error inserting batch ${i/batchSize + 1}:`, error);
      } else {
        console.log(`Successfully inserted batch ${i/batchSize + 1} of leads`);
      }
    }
    
    return NextResponse.json({
      success: true,
      message: 'Sample data created for revenue tracking',
      results: {
        routings: !routingsError,
        leads: results
      }
    });
  } catch (error: any) {
    console.error('Error creating sample data:', error);
    return NextResponse.json({
      success: false, 
      error: error.message
    }, { status: 500 });
  }
}
