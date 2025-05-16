// Force dynamic rendering instead of static generation
export const dynamic = 'force-dynamic';


import { ComplianceCheckForm } from "@/components/compliance/compliance-check-form"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

export default function CompliancePage() {
  return (
    <div className="container mx-auto py-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Multi-Source Compliance</h1>
        <p className="text-muted-foreground">
          Check phone numbers against multiple compliance databases to ensure regulatory compliance
        </p>
      </div>

      <ComplianceCheckForm />

      <Card>
        <CardHeader>
          <CardTitle>About Multi-Source Compliance</CardTitle>
          <CardDescription>Understanding our comprehensive compliance checking system</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p>
            Our multi-source compliance system checks phone numbers against multiple industry-leading compliance
            databases to provide comprehensive risk assessment and regulatory compliance.
          </p>

          <h3 className="text-lg font-semibold mt-4">Compliance Sources</h3>
          <div className="space-y-4">
            <div>
              <h4 className="font-medium">TCPA Litigator List</h4>
              <p className="text-sm text-muted-foreground">
                Checks against known TCPA litigators, serial plaintiffs, and DNC complainers to reduce the risk of TCPA
                lawsuits.
              </p>
            </div>

            <div>
              <h4 className="font-medium">Blacklist Alliance</h4>
              <p className="text-sm text-muted-foreground">
                Identifies high-risk phone numbers that may be associated with scammers, fraudsters, or individuals
                likely to file complaints.
              </p>
            </div>
          </div>

          <h3 className="text-lg font-semibold mt-4">Benefits</h3>
          <ul className="list-disc pl-6 space-y-2">
            <li>
              <strong>Comprehensive Protection</strong>: Multiple data sources provide broader coverage
            </li>
            <li>
              <strong>Reduced Legal Risk</strong>: Identify potential litigators before contact
            </li>
            <li>
              <strong>Improved Compliance</strong>: Meet regulatory requirements across multiple frameworks
            </li>
            <li>
              <strong>Detailed Reporting</strong>: Get specific reasons for compliance failures
            </li>
          </ul>
        </CardContent>
      </Card>
    </div>
  )
}
