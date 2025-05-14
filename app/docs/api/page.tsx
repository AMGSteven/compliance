import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { Button } from "@/components/ui/button"

export default function ApiDocsPage() {
  return (
    <div className="container mx-auto py-10">
      <div className="mb-6 flex items-center">
        <Button variant="outline" size="icon" className="mr-4" asChild>
          <Link href="/">
            <ArrowLeft className="h-4 w-4" />
            <span className="sr-only">Back</span>
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">API Documentation</h1>
          <p className="text-muted-foreground">Reference documentation for the Suppression & Compliance Engine API</p>
        </div>
      </div>

      <div className="mb-6">
        <Card>
          <CardHeader>
            <CardTitle>API Documentation</CardTitle>
            <CardDescription>Choose the API documentation you need</CardDescription>
          </CardHeader>
          <CardContent className="flex gap-4">
            <Button asChild>
              <Link href="#check-suppression">Internal API</Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href="/docs/external-api">External API for Lead Forms</Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-[250px_1fr]">
        <div className="space-y-4">
          <div className="font-medium">API Reference</div>
          <nav className="flex flex-col space-y-1">
            <Link href="#check-suppression" className="rounded-md px-3 py-2 text-sm hover:bg-muted">
              Check Suppression
            </Link>
            <Link href="#opt-out" className="rounded-md px-3 py-2 text-sm hover:bg-muted">
              Opt-Out
            </Link>
            <Link href="#batch-check" className="rounded-md px-3 py-2 text-sm hover:bg-muted">
              Batch Check
            </Link>
            <Link href="#compliance-verification" className="rounded-md px-3 py-2 text-sm hover:bg-muted">
              Compliance Verification
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
          <Card id="check-suppression">
            <CardHeader>
              <CardTitle>Check Suppression</CardTitle>
              <CardDescription>Check if a contact is on the suppression list</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h3 className="text-sm font-medium">Endpoint</h3>
                <p className="mt-1 font-mono text-sm">POST /api/v1/check-suppression</p>
              </div>

              <Tabs defaultValue="request">
                <TabsList>
                  <TabsTrigger value="request">Request</TabsTrigger>
                  <TabsTrigger value="response">Response</TabsTrigger>
                </TabsList>
                <TabsContent value="request" className="mt-2 space-y-4">
                  <div>
                    <h3 className="text-sm font-medium">Headers</h3>
                    <pre className="mt-1 overflow-x-auto rounded-md bg-slate-950 p-4">
                      <code className="text-sm text-white">
                        {`Content-Type: application/json
Authorization: Bearer YOUR_API_KEY`}
                      </code>
                    </pre>
                  </div>
                  <div>
                    <h3 className="text-sm font-medium">Body</h3>
                    <pre className="mt-1 overflow-x-auto rounded-md bg-slate-950 p-4">
                      <code className="text-sm text-white">
                        {`{
  "email": "user@example.com",
  "phone": "+15551234567",
  "postal": "123 Main St, Anytown, US 12345",
  "channel": "all"
}`}
                      </code>
                    </pre>
                  </div>
                  <div>
                    <h3 className="text-sm font-medium">Parameters</h3>
                    <div className="mt-1 rounded-md border">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b bg-muted/50">
                            <th className="p-2 text-left font-medium">Parameter</th>
                            <th className="p-2 text-left font-medium">Type</th>
                            <th className="p-2 text-left font-medium">Required</th>
                            <th className="p-2 text-left font-medium">Description</th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr className="border-b">
                            <td className="p-2 font-mono">email</td>
                            <td className="p-2">string</td>
                            <td className="p-2">No*</td>
                            <td className="p-2">Email address to check</td>
                          </tr>
                          <tr className="border-b">
                            <td className="p-2 font-mono">phone</td>
                            <td className="p-2">string</td>
                            <td className="p-2">No*</td>
                            <td className="p-2">Phone number in E.164 format</td>
                          </tr>
                          <tr className="border-b">
                            <td className="p-2 font-mono">postal</td>
                            <td className="p-2">string</td>
                            <td className="p-2">No*</td>
                            <td className="p-2">Postal address</td>
                          </tr>
                          <tr>
                            <td className="p-2 font-mono">channel</td>
                            <td className="p-2">string</td>
                            <td className="p-2">No</td>
                            <td className="p-2">Channel to check (email, phone, sms, postal, all)</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                    <p className="mt-2 text-xs text-muted-foreground">
                      * At least one of email, phone, or postal is required
                    </p>
                  </div>
                </TabsContent>
                <TabsContent value="response" className="mt-2 space-y-4">
                  <div>
                    <h3 className="text-sm font-medium">Success Response (200 OK)</h3>
                    <pre className="mt-1 overflow-x-auto rounded-md bg-slate-950 p-4">
                      <code className="text-sm text-white">
                        {`{
  "timestamp": "2025-05-07T11:35:26.000Z",
  "requestId": "550e8400-e29b-41d4-a716-446655440000",
  "suppressed": true,
  "details": {
    "email": true,
    "phone": false,
    "postal": false
  }
}`}
                      </code>
                    </pre>
                  </div>
                  <div>
                    <h3 className="text-sm font-medium">Error Response (400 Bad Request)</h3>
                    <pre className="mt-1 overflow-x-auto rounded-md bg-slate-950 p-4">
                      <code className="text-sm text-white">
                        {`{
  "error": "At least one identifier (email, phone, or postal) is required"
}`}
                      </code>
                    </pre>
                  </div>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>

          <Card id="opt-out">
            <CardHeader>
              <CardTitle>Opt-Out</CardTitle>
              <CardDescription>Add a contact to the suppression list</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h3 className="text-sm font-medium">Endpoint</h3>
                <p className="mt-1 font-mono text-sm">POST /api/v1/opt-out</p>
              </div>

              <Tabs defaultValue="request">
                <TabsList>
                  <TabsTrigger value="request">Request</TabsTrigger>
                  <TabsTrigger value="response">Response</TabsTrigger>
                </TabsList>
                <TabsContent value="request" className="mt-2 space-y-4">
                  <div>
                    <h3 className="text-sm font-medium">Headers</h3>
                    <pre className="mt-1 overflow-x-auto rounded-md bg-slate-950 p-4">
                      <code className="text-sm text-white">
                        {`Content-Type: application/json
Authorization: Bearer YOUR_API_KEY`}
                      </code>
                    </pre>
                  </div>
                  <div>
                    <h3 className="text-sm font-medium">Body</h3>
                    <pre className="mt-1 overflow-x-auto rounded-md bg-slate-950 p-4">
                      <code className="text-sm text-white">
                        {`{
  "identifier": "user@example.com",
  "channel": "email",
  "source": "Preference Center",
  "reason": "User request",
  "metadata": {
    "campaignId": "camp_12345",
    "ipAddress": "192.168.1.1"
  }
}`}
                      </code>
                    </pre>
                  </div>
                </TabsContent>
                <TabsContent value="response" className="mt-2 space-y-4">
                  <div>
                    <h3 className="text-sm font-medium">Success Response (200 OK)</h3>
                    <pre className="mt-1 overflow-x-auto rounded-md bg-slate-950 p-4">
                      <code className="text-sm text-white">
                        {`{
  "success": true,
  "timestamp": "2025-05-07T11:35:26.000Z",
  "requestId": "550e8400-e29b-41d4-a716-446655440000",
  "message": "Successfully opted out user@example.com from email communications",
  "details": {
    "identifier": "user@example.com",
    "channel": "email",
    "source": "Preference Center",
    "reason": "User request",
    "metadata": {
      "campaignId": "camp_12345",
      "ipAddress": "192.168.1.1"
    }
  }
}`}
                      </code>
                    </pre>
                  </div>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>

          <Card id="batch-check">
            <CardHeader>
              <CardTitle>Batch Check</CardTitle>
              <CardDescription>Check multiple contacts against the suppression list</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">Documentation for this endpoint is coming soon.</p>
            </CardContent>
          </Card>

          <Card id="compliance-verification">
            <CardHeader>
              <CardTitle>Compliance Verification</CardTitle>
              <CardDescription>Verify compliance status for a contact</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">Documentation for this endpoint is coming soon.</p>
            </CardContent>
          </Card>

          <Card id="authentication">
            <CardHeader>
              <CardTitle>Authentication</CardTitle>
              <CardDescription>How to authenticate with the API</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm">All API requests must include your API key in the Authorization header:</p>
              <pre className="overflow-x-auto rounded-md bg-slate-950 p-4">
                <code className="text-sm text-white">Authorization: Bearer YOUR_API_KEY</code>
              </pre>
              <p className="text-sm">
                You can obtain an API key from the{" "}
                <Link href="/settings/api" className="text-primary underline">
                  API Settings
                </Link>{" "}
                page.
              </p>
            </CardContent>
          </Card>

          <Card id="rate-limits">
            <CardHeader>
              <CardTitle>Rate Limits</CardTitle>
              <CardDescription>API rate limiting information</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm">The API is rate limited to protect our infrastructure and ensure fair usage:</p>
              <div className="rounded-md border">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="p-2 text-left font-medium">Plan</th>
                      <th className="p-2 text-left font-medium">Rate Limit</th>
                      <th className="p-2 text-left font-medium">Burst Limit</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b">
                      <td className="p-2">Standard</td>
                      <td className="p-2">100 requests per minute</td>
                      <td className="p-2">200 requests</td>
                    </tr>
                    <tr className="border-b">
                      <td className="p-2">Professional</td>
                      <td className="p-2">500 requests per minute</td>
                      <td className="p-2">1,000 requests</td>
                    </tr>
                    <tr>
                      <td className="p-2">Enterprise</td>
                      <td className="p-2">2,000 requests per minute</td>
                      <td className="p-2">5,000 requests</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <p className="text-sm">Rate limit headers are included in all API responses:</p>
              <pre className="overflow-x-auto rounded-md bg-slate-950 p-4">
                <code className="text-sm text-white">
                  {`X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1620000000`}
                </code>
              </pre>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
