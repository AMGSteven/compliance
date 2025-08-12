import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const supabase = createClient(supabaseUrl, supabaseKey)

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const list_id = searchParams.get('list_id')
  const year = searchParams.get('year')
  const month = searchParams.get('month')
  const format = searchParams.get('format') || 'json'

  try {
    // If specific list_id, year, month provided, return that specific export
    if (list_id && year && month) {
      const { data: export_data, error } = await supabase
        .from('monthly_dnc_exports')
        .select('*')
        .eq('list_id', list_id)
        .eq('year', parseInt(year))
        .eq('month', parseInt(month))
        .single()

      if (error || !export_data) {
        return NextResponse.json(
          { 
            success: false, 
            error: 'Monthly DNC export not found',
            message: `No DNC export found for list ${list_id} in ${year}-${month}. It may not have been processed yet.`
          },
          { status: 404 }
        )
      }

      // Return CSV download
      if (format === 'csv') {
        const filename = `dnc-export-${list_id}-${year}-${month.toString().padStart(2, '0')}.csv`
        return new Response(export_data.csv_data || '', {
          headers: {
            'Content-Type': 'text/csv',
            'Content-Disposition': `attachment; filename="${filename}"`
          }
        })
      }

      // Return JSON metadata
      return NextResponse.json({
        success: true,
        data: {
          list_id: export_data.list_id,
          year: export_data.year,
          month: export_data.month,
          total_leads: export_data.total_leads,
          dnc_matches: export_data.dnc_matches,
          processed_at: export_data.processed_at,
          has_csv_data: !!export_data.csv_data
        }
      })
    }

    // Otherwise, return list of available monthly exports
    let query = supabase
      .from('monthly_dnc_exports')
      .select('list_id, year, month, total_leads, dnc_matches, processed_at')
      .order('year', { ascending: false })
      .order('month', { ascending: false })
      .order('list_id', { ascending: true })

    // Filter by list_id if provided
    if (list_id) {
      query = query.eq('list_id', list_id)
    }

    // Filter by year if provided
    if (year) {
      query = query.eq('year', parseInt(year))
    }

    // Filter by month if provided  
    if (month) {
      query = query.eq('month', parseInt(month))
    }

    const { data: exports, error } = await query

    if (error) {
      console.error('Error fetching monthly DNC exports:', error)
      throw error
    }

    // Group by year/month for easier UI consumption
    const groupedExports = exports?.reduce((acc: any, exp: any) => {
      const key = `${exp.year}-${exp.month.toString().padStart(2, '0')}`
      if (!acc[key]) {
        acc[key] = {
          year: exp.year,
          month: exp.month,
          month_name: new Date(exp.year, exp.month - 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
          lists: []
        }
      }
      acc[key].lists.push({
        list_id: exp.list_id,
        total_leads: exp.total_leads,
        dnc_matches: exp.dnc_matches,
        dnc_rate: exp.total_leads > 0 ? ((exp.dnc_matches / exp.total_leads) * 100).toFixed(1) : '0.0',
        processed_at: exp.processed_at
      })
      return acc
    }, {}) || {}

    return NextResponse.json({
      success: true,
      data: {
        available_months: Object.values(groupedExports),
        total_exports: exports?.length || 0
      }
    })

  } catch (error) {
    console.error('❌ Monthly DNC Exports API Error:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch monthly DNC exports',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
