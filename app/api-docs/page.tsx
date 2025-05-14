import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import Link from "next/link"

export default function ApiDocsPage() {
  return (
    <main className="container mx-auto py-10">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">API Documentation</h1>
        <p className="text-muted-foreground">Reference documentation for the Compliance Engine API</p>
      </div>

      <div className="grid gap-6 md:grid-cols-[250px_1fr]">
        <div className="space-y-4">
          <div className="font-medium">API Reference</div>
          <nav className="flex flex-col space-y-1">
            <Link href="#check-compliance" className="rounded-md px-3 py-2 text-sm hover:bg-muted">
              Check Compliance
            </Link>
            <Link href="#add-to-dnc" className="rounded-md px-3 py-2 text-sm hover:bg-muted">
              Add to DNC
            </Link>
            <Link href="#bulk-add-to-dnc" className="rounded-md px-3 py-2 text-sm hover:bg-muted">
              Bulk Add to DNC
            </Link>
            <Link href="#opt-outs" className="rounded-md px-3 py-2 text-sm hover:bg-muted">
              Get Opt-Outs
            </Link>
            <Link href="#authentication" className="rounded-md px-3 py-2 text-sm hover:bg-muted">
              Authentication
            </Link>
            <Link href="#rate-limits" className="rounded-md px-3 py-2 text-sm hover:bg-muted">
              Rate Limits
            </Link>
          </nav>
        </div>

        <div className="space-y-6">
          <Card id="check-compliance">
            <CardHeader>
              <CardTitle>Check Compliance</CardTitle>
              <CardDescription>Check if a phone number is compliant for calling</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h3 className="text-sm font-medium">Endpoint</h3>
                <p className="mt-1 font-mono text-sm">POST /api/check-compliance</p>
              </div>

              <div>
                <h3 className="text-sm font-medium">Request Body</h3>
                <pre className="mt-1 overflow-x-auto rounded-md bg-slate-950 p-4">
                  <code className="text-sm text-white">
                    {`{
  "phoneNumber": "+15551234567"
}`}
                  </code>
                </pre>
              </div>

              <div>
                <h3 className="text-sm font-medium">Response</h3>
                <pre className="mt-1 overflow-x-auto rounded-md bg-slate-950 p-4">
                  <code className="text-sm text-white">
                    {`{
  "phoneNumber": "+15551234567",
  "isCompliant": false,
  "results": [
    {
      "source": "TCPA Litigator List",
      "isCompliant": false,
      "reasons": ["dnc_complainers"],
      "details": { ... }
    },
    {
      "source": "Blacklist Alliance",
      "isCompliant": true,
      "reasons": []
    },
    {
      "source": "Webrecon",
      "isCompliant": true,
      "reasons": []
    },
    {
      "source": "Internal DNC List",
      "isCompliant": false,
      "reasons": ["Customer request"]
    }
  ],
  "timestamp": "2025-05-14T07:43:39.221Z"
}`}
                  </code>
                </pre>
              </div>
            </CardContent>
          </Card>

          <Card id="add-to-dnc">
            <CardHeader>
              <CardTitle>Add to DNC</CardTitle>
              <CardDescription>Add a phone number to the Do Not Call list</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h3 className="text-sm font-medium">Endpoint</h3>
                <p className="mt-1 font-mono text-sm">POST /api/dialer/dnc</p>
              </div>

              <div>
                <h3 className="text-sm font-medium">Headers</h3>
                <pre className="mt-1 overflow-x-auto rounded-md bg-slate-950 p-4">
                  <code className="text-sm text-white">
                    {`x-api-key: YOUR_API_KEY`}
                  </code>
                </pre>
              </div>

              <div>
                <h3 className="text-sm font-medium">Request Body</h3>
                <pre className="mt-1 overflow-x-auto rounded-md bg-slate-950 p-4">
                  <code className="text-sm text-white">
                    {`{
  "phone_number": "+15551234567",
  "reason": "Customer request",
  "source": "web_form"
}`}
                  </code>
                </pre>
              </div>

              <div>
                <h3 className="text-sm font-medium">Response</h3>
                <pre className="mt-1 overflow-x-auto rounded-md bg-slate-950 p-4">
                  <code className="text-sm text-white">
                    {`{
  "success": true,
  "message": "Number added to DNC",
  "phone_number": "+15551234567"
}`}
                  </code>
                </pre>
              </div>
            </CardContent>
          </Card>

          <Card id="bulk-add-to-dnc">
            <CardHeader>
              <CardTitle>Bulk Add to DNC</CardTitle>
              <CardDescription>Add multiple phone numbers to the Do Not Call list</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h3 className="text-sm font-medium">Endpoint</h3>
                <p className="mt-1 font-mono text-sm">POST /api/dialer/dnc/bulk</p>
              </div>

              <div>
                <h3 className="text-sm font-medium">Headers</h3>
                <pre className="mt-1 overflow-x-auto rounded-md bg-slate-950 p-4">
                  <code className="text-sm text-white">
                    {`x-api-key: YOUR_API_KEY`}
                  </code>
                </pre>
              </div>

              <div>
                <h3 className="text-sm font-medium">Request Body</h3>
                <pre className="mt-1 overflow-x-auto rounded-md bg-slate-950 p-4">
                  <code className="text-sm text-white">
                    {`{
  "numbers": [
    {
      "phone_number": "+15551234567",
      "reason": "Bulk test - Do not call request",
      "source": "bulk_api_test"
    },
    {
      "phone_number": "+15555678901",
      "reason": "Bulk test - Consumer request",
      "source": "bulk_api_test"
    }
  ]
}`}
                  </code>
                </pre>
              </div>

              <div>
                <h3 className="text-sm font-medium">Response</h3>
                <pre className="mt-1 overflow-x-auto rounded-md bg-slate-950 p-4">
                  <code className="text-sm text-white">
                    {`{
  "success": true,
  "added": 2,
  "errors": [],
  "details": [
    {
      "phone_number": "+15551234567",
      "date_added": "2025-05-14T07:43:09.150Z",
      "reason": "Bulk test - Do not call request",
      "source": "bulk_api_test",
      "status": "active"
    },
    {
      "phone_number": "+15555678901",
      "date_added": "2025-05-14T07:43:09.150Z",
      "reason": "Bulk test - Consumer request",
      "source": "bulk_api_test",
      "status": "active"
    }
  ]
}`}
                  </code>
                </pre>
              </div>
            </CardContent>
          </Card>

          <Card id="authentication">
            <CardHeader>
              <CardTitle>Authentication</CardTitle>
              <CardDescription>How to authenticate with the API</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm">DNC management endpoints require an API key in the x-api-key header:</p>
              <pre className="overflow-x-auto rounded-md bg-slate-950 p-4">
                <code className="text-sm text-white">x-api-key: YOUR_API_KEY</code>
              </pre>
              <p className="text-sm">
                Contact support to get your API key. The compliance check endpoint does not require authentication.
              </p>
            </CardContent>
          </Card>

          <Card id="rate-limits">
            <CardHeader>
              <CardTitle>Rate Limits</CardTitle>
              <CardDescription>API rate limiting information</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm">
                The API is rate limited to protect our infrastructure and ensure fair usage:
              </p>
              <ul className="list-disc list-inside text-sm space-y-2">
                <li>Compliance check: 100 requests per minute per IP</li>
                <li>Single DNC addition: 60 requests per minute per API key</li>
                <li>Bulk DNC addition: 2 requests per minute per API key</li>
              </ul>
              <p className="text-sm">
                If you exceed these limits, you'll receive a 429 Too Many Requests response.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </main>
  )
}
