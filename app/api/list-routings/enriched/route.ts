import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const serviceRoleKey = process.env.DATABASE_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || ''
const supabase = createClient(supabaseUrl, serviceRoleKey)

type EnrichedRouting = {
  id: string
  list_id: string
  campaign_id: string | null
  cadence_id: string | null
  description: string | null
  active: boolean
  bid: number | null
  token: string | null
  dialer_type: number | null
  auto_claim_trusted_form: boolean | null
  created_at: string | null
  updated_at: string | null
  vertical: string | null
  partner_name: string
  partner_name_normalized: string
  data_source_type: 'on_hour' | 'after_hour' | 'aged' | 'unknown'
}

const normalize = (s: string | null | undefined) => (s || '').toLowerCase().trim()

function canonicalizePartnerName(dbPartnerName: string | null | undefined, description: string | null | undefined): string {
  const pn = normalize(dbPartnerName)
  const desc = normalize(description)
  const text = pn || desc
  if (!text) return 'Unknown'
  if (text.includes('moxxi')) return 'Moxxi'
  if (text.includes('employers')) return 'Employers.io'
  if (text.includes('fluent')) return 'Fluent'
  if (text.includes('citadel')) return 'Citadel'
  if (text.includes('onpoint') || text.includes('opg')) return 'OPG'
  if (text.includes('shift44')) return 'Shift44'
  if (text.includes('top of funnel') || text.includes('topfunnel')) return 'Top of Funnel'
  if (text.includes('pushnami')) return 'Pushnami'
  if (text.includes('interest media')) return 'Interest Media'
  if (text.includes('what if media')) return 'What If Media'
  if (text.includes('iexecute') || text.includes('iexcecute')) return 'iExecute'
  if (text.includes('launch')) return 'Launch Potato'
  if (text.includes('juiced')) return 'Juiced Media'
  return dbPartnerName || 'Unknown'
}

function extractDataSourceType(description: string | null | undefined): EnrichedRouting['data_source_type'] {
  const d = normalize(description)
  if (!d) return 'unknown'
  if (d.includes('on hour') || d.includes('on-hour')) return 'on_hour'
  if (d.includes('after hour') || d.includes('after-hour') || d.includes('off hour') || d.includes('off-hour')) return 'after_hour'
  if (d.includes('aged')) return 'aged'
  return 'unknown'
}

export async function GET(req: NextRequest) {
  try {
    const { data, error } = await supabase
      .from('list_routings')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error loading list_routings for enrichment:', error)
      return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    }

    const enriched: EnrichedRouting[] = (data || []).map((r: any) => {
      const partnerName = canonicalizePartnerName(r.partner_name, r.description)
      const partner_name_normalized = normalize(partnerName)
      return {
        id: r.id,
        list_id: r.list_id,
        campaign_id: r.campaign_id,
        cadence_id: r.cadence_id,
        description: r.description,
        active: !!r.active,
        bid: r.bid ?? null,
        token: r.token ?? null,
        dialer_type: r.dialer_type ?? null,
        auto_claim_trusted_form: r.auto_claim_trusted_form ?? null,
        created_at: r.created_at ?? null,
        updated_at: r.updated_at ?? null,
        vertical: r.vertical ?? null,
        partner_name: partnerName,
        partner_name_normalized,
        data_source_type: extractDataSourceType(r.description),
      }
    })

    return NextResponse.json({ success: true, data: enriched })
  } catch (e: any) {
    console.error('Unexpected error in enriched route:', e)
    return NextResponse.json({ success: false, error: e.message }, { status: 500 })
  }
}

