#!/usr/bin/env node
/**
 * Orphaned Lead Re-routing Script - FIXED
 * Only sends leads with valid routing data
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '.env.local') });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.DATABASE_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ Missing environment variables');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// Constants
const DIALER_TYPE_INTERNAL = 1;
const DIALER_TYPE_PITCH_BPO = 2;
const PITCH_BPO_STATES = ['FL', 'TX'];
const INTERNAL_DIALER_URL = 'https://dialer.juicedmedia.io/api/webhooks/lead-postback';
const PITCH_BPO_URL = 'https://api.chasedatacorp.com/HttpImport/InjectLead.php';

// Settings
const BATCH_SIZE = 500;
const PARALLEL_INTERNAL = 50;
const PARALLEL_PITCH = 15;

// Stats
let stats = { internal: 0, pitch: 0, dup: 0, noRouting: 0, fail: 0 };
const startTime = Date.now();
const routingCache = {};

async function getRoutingData(listId) {
  if (routingCache[listId] !== undefined) return routingCache[listId];
  try {
    const { data } = await supabase.from('list_routings').select('token, campaign_id, cadence_id').eq('list_id', listId).single();
    // Only cache if we have valid campaign_id (must be UUID)
    if (data && data.campaign_id && /^[0-9a-f-]{36}$/i.test(data.campaign_id)) {
      routingCache[listId] = data;
    } else {
      routingCache[listId] = null;
    }
  } catch { 
    routingCache[listId] = null; 
  }
  return routingCache[listId];
}

async function sendToInternal(lead, routingData) {
  const phone = lead.phone?.startsWith('+1') ? lead.phone : `+1${(lead.phone || '').replace(/\D/g, '')}`;
  
  const url = new URL(INTERNAL_DIALER_URL);
  url.searchParams.append('list_id', lead.list_id);
  url.searchParams.append('campaign_id', routingData.campaign_id);
  url.searchParams.append('cadence_id', routingData.cadence_id || '');
  url.searchParams.append('token', routingData.token);
  
  let customFields = {};
  try { customFields = typeof lead.custom_fields === 'string' ? JSON.parse(lead.custom_fields) : (lead.custom_fields || {}); } catch {}
  
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);
  
  try {
    const res = await fetch(url.toString(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        first_name: lead.first_name || '', last_name: lead.last_name || '',
        email: lead.email || '', phone, state: lead.state || '',
        zip_code: lead.zip_code || '', list_id: lead.list_id,
        campaign_id: routingData.campaign_id, compliance_lead_id: lead.id,
        custom_fields: { ...customFields, compliance_lead_id: lead.id, rerouted: true }
      })
    });
    clearTimeout(timeout);
    
    const result = await res.json().catch(() => ({}));
    if (res.status === 409 || result.error === 'CAMPAIGN_DUPLICATE') return 'dup';
    if (res.status !== 200 || result.error) return 'fail';
    return 'ok';
  } catch {
    clearTimeout(timeout);
    return 'fail';
  }
}

async function sendToPitch(lead) {
  const url = new URL(PITCH_BPO_URL);
  url.searchParams.append('token', '70942646-125b-4ddd-96fc-b9a142c698b8');
  url.searchParams.append('accid', 'pitchperfect');
  url.searchParams.append('Campaign', 'Jade ACA');
  url.searchParams.append('Subcampaign', 'Juiced Real Time');
  url.searchParams.append('adv_SubID', lead.list_id);
  url.searchParams.append('PrimaryPhone', lead.phone || '');
  url.searchParams.append('FirstName', lead.first_name || '');
  url.searchParams.append('LastName', lead.last_name || '');
  url.searchParams.append('email', lead.email || '');
  url.searchParams.append('ZipCode', lead.zip_code || '');
  url.searchParams.append('State', lead.state || '');
  url.searchParams.append('ClientId', lead.id);
  url.searchParams.append('ImportOnly', '0');
  url.searchParams.append('DuplicatesCheck', '1');
  url.searchParams.append('AllowDialingDups', '1');
  
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  
  try {
    const res = await fetch(url.toString(), { method: 'GET', signal: controller.signal });
    clearTimeout(timeout);
    return res.status === 200 ? 'ok' : 'fail';
  } catch {
    clearTimeout(timeout);
    return 'fail';
  }
}

async function processInternalLeads(leads) {
  const results = [];
  
  for (let i = 0; i < leads.length; i += PARALLEL_INTERNAL) {
    const chunk = leads.slice(i, i + PARALLEL_INTERNAL);
    const chunkResults = await Promise.all(chunk.map(async (lead) => {
      const routingData = await getRoutingData(lead.list_id);
      
      // Skip if no valid routing
      if (!routingData) {
        stats.noRouting++;
        return { id: lead.id, result: 'norouting' };
      }
      
      const result = await sendToInternal(lead, routingData);
      if (result === 'ok') stats.internal++;
      else if (result === 'dup') { stats.dup++; return { id: lead.id, result: 'ok' }; }
      else stats.fail++;
      
      return { id: lead.id, result };
    }));
    results.push(...chunkResults);
  }
  
  return results;
}

async function processPitchLeads(leads) {
  const results = [];
  
  for (let i = 0; i < leads.length; i += PARALLEL_PITCH) {
    const chunk = leads.slice(i, i + PARALLEL_PITCH);
    const chunkResults = await Promise.all(chunk.map(async (lead) => {
      const result = await sendToPitch(lead);
      if (result === 'ok') stats.pitch++;
      else if (result === 'dup') { stats.dup++; return { id: lead.id, result: 'ok' }; }
      else stats.fail++;
      
      return { id: lead.id, result };
    }));
    results.push(...chunkResults);
  }
  
  return results;
}

async function run() {
  console.log('🚀 Orphan Reroute - FIXED');
  console.log(`   Internal: ${PARALLEL_INTERNAL}x | Pitch: ${PARALLEL_PITCH}x\n`);
  
  let totalProcessed = 0;
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  
  // Get initial count
  const { count } = await supabase
    .from('leads')
    .select('id', { count: 'exact', head: true })
    .is('assigned_dialer_type', null)
    .gte('created_at', thirtyDaysAgo.toISOString());
  
  console.log(`📋 ${count?.toLocaleString()} orphaned leads remaining\n`);
  
  while (true) {
    const { data: batch, error } = await supabase
      .from('leads')
      .select('id, list_id, phone, first_name, last_name, email, state, zip_code, custom_fields')
      .is('assigned_dialer_type', null)
      .gte('created_at', thirtyDaysAgo.toISOString())
      .limit(BATCH_SIZE);
    
    if (error) {
      console.error('DB Error:', error.message);
      await new Promise(r => setTimeout(r, 2000));
      continue;
    }
    
    if (!batch || batch.length === 0) {
      console.log('\n🎉 Done! No more leads.');
      break;
    }
    
    // Split by destination
    const internalLeads = [];
    const pitchLeads = [];
    
    for (const lead of batch) {
      const listId = lead.list_id || '';
      if (!listId || (!/^[0-9a-f-]{36}$/i.test(listId) && !listId.startsWith('pitch-bpo-'))) continue;
      
      const state = (lead.state || '').toUpperCase();
      if (listId.startsWith('pitch-bpo-') || PITCH_BPO_STATES.includes(state)) {
        pitchLeads.push(lead);
      } else {
        internalLeads.push(lead);
      }
    }
    
    // Process both simultaneously
    const [internalResults, pitchResults] = await Promise.all([
      processInternalLeads(internalLeads),
      processPitchLeads(pitchLeads)
    ]);
    
    // Update successful leads in DB
    const successfulInternal = internalResults.filter(r => r.result === 'ok').map(r => r.id);
    const successfulPitch = pitchResults.filter(r => r.result === 'ok').map(r => r.id);
    
    if (successfulInternal.length > 0) {
      await supabase.from('leads').update({ assigned_dialer_type: DIALER_TYPE_INTERNAL, dialer_selection_method: 'orphan_reroute' }).in('id', successfulInternal);
    }
    if (successfulPitch.length > 0) {
      await supabase.from('leads').update({ assigned_dialer_type: DIALER_TYPE_PITCH_BPO, dialer_selection_method: 'orphan_reroute' }).in('id', successfulPitch);
    }
    
    totalProcessed += batch.length;
    const elapsed = (Date.now() - startTime) / 1000;
    const rate = Math.round(totalProcessed / elapsed);
    const remaining = (count || 60000) - totalProcessed;
    const etaMin = remaining > 0 && rate > 0 ? Math.round(remaining / rate / 60) : 0;
    
    console.log(`📊 ${totalProcessed.toLocaleString()} | ${rate}/s | ~${etaMin}m | ✓Int:${stats.internal} ✓Pitch:${stats.pitch} Dup:${stats.dup} NoRoute:${stats.noRouting} Fail:${stats.fail}`);
  }
  
  const totalTime = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`\n✅ COMPLETE: ${totalProcessed.toLocaleString()} in ${totalTime}s`);
  console.log(`   ✓Int:${stats.internal} ✓Pitch:${stats.pitch} Dup:${stats.dup} NoRoute:${stats.noRouting} Fail:${stats.fail}`);
}

run().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
