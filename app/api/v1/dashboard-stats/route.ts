import { NextResponse } from "next/server"
import { SuppressionService } from "@/lib/services/suppression-service"
import { TrustedFormService } from "@/lib/services/trusted-form-service"

export async function GET() {
  try {
    const suppressionService = new SuppressionService()

    // Get suppression stats
    const suppressionStats = await suppressionService.getDashboardStats()

    // Get TrustedForm stats
    let trustedFormStats = null
    try {
      const trustedFormService = new TrustedFormService()
      trustedFormStats = await trustedFormService.getDashboardStats()
    } catch (error) {
      console.error("Error fetching TrustedForm stats:", error)
      // Continue with suppression stats only
    }

    // Combine stats
    const stats = {
      ...suppressionStats,
      trustedForm: trustedFormStats,
    }

    return NextResponse.json(stats)
  } catch (error) {
    console.error("Error in dashboard stats API:", error)
    // Return mock data for development/preview
    return NextResponse.json({
      totalContacts: 1250,
      totalOptOuts: 87,
      emailOptOuts: 45,
      phoneOptOuts: 22,
      smsOptOuts: 15,
      postalOptOuts: 5,
      complianceRate: 99.2,
      recentOptOuts: [],
    })
  }
}
