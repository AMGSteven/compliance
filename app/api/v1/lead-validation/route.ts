import { type NextRequest, NextResponse } from "next/server"

// Mock TrustedForm certificate validation
function validateTrustedFormCertificate(certificateUrl: string) {
  // In a real implementation, this would call the TrustedForm API
  // For this example, we'll just check if the URL looks valid
  const isValid = certificateUrl.startsWith("https://cert.trustedform.com/")

  return {
    valid: isValid,
    created: isValid ? new Date().toISOString() : null,
    expires: isValid ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString() : null, // 30 days
    fingerprints: isValid ? ["127.0.0.1", "::1"] : [],
    warnings: isValid ? [] : ["Invalid certificate URL"],
  }
}

// Mock TCPA consent validation
function validateTcpaConsent(consentData: any) {
  // In a real implementation, this would validate against regulatory requirements
  const isValid =
    consentData &&
    consentData.timestamp &&
    consentData.text &&
    consentData.text.includes("consent") &&
    new Date(consentData.timestamp) <= new Date()

  return {
    valid: isValid,
    warnings: isValid ? [] : ["Invalid consent data"],
    details: isValid
      ? {
          consentText: consentData.text,
          consentTimestamp: consentData.timestamp,
          consentMethod: consentData.method || "unknown",
        }
      : null,
  }
}

// Mock lead age validation
function validateLeadAge(createdAt: string, maxAgeHours = 72) {
  const createdDate = new Date(createdAt)
  const now = new Date()
  const ageMs = now.getTime() - createdDate.getTime()
  const ageHours = ageMs / (1000 * 60 * 60)

  return {
    valid: ageHours <= maxAgeHours,
    age: {
      hours: ageHours,
      days: ageHours / 24,
    },
    warnings:
      ageHours > maxAgeHours
        ? [`Lead age (${ageHours.toFixed(1)} hours) exceeds maximum allowed (${maxAgeHours} hours)`]
        : [],
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    // Validate request
    if (!body.lead) {
      return NextResponse.json({ error: "Lead data is required" }, { status: 400 })
    }

    const lead = body.lead
    const validations: Record<string, any> = {}
    const warnings: string[] = []

    // Validate TrustedForm certificate if provided
    if (lead.trustedFormCertificateUrl) {
      validations.trustedForm = validateTrustedFormCertificate(lead.trustedFormCertificateUrl)
      if (!validations.trustedForm.valid) {
        warnings.push(...validations.trustedForm.warnings)
      }
    }

    // Validate TCPA consent if provided
    if (lead.tcpaConsent) {
      validations.tcpaConsent = validateTcpaConsent(lead.tcpaConsent)
      if (!validations.tcpaConsent.valid) {
        warnings.push(...validations.tcpaConsent.warnings)
      }
    }

    // Validate lead age if created timestamp provided
    if (lead.createdAt) {
      validations.leadAge = validateLeadAge(lead.createdAt, body.maxAgeHours || 72)
      if (!validations.leadAge.valid) {
        warnings.push(...validations.leadAge.warnings)
      }
    }

    // Determine overall validation status
    const isValid = Object.values(validations).every((v: any) => v.valid)

    // Return validation results
    return NextResponse.json({
      timestamp: new Date().toISOString(),
      requestId: crypto.randomUUID(),
      valid: isValid,
      warnings: warnings,
      validations: validations,
    })
  } catch (error) {
    console.error("Error processing lead validation:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
