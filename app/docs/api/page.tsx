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

      <div className="mb-8">
        <div className="inline-flex items-center gap-4 p-4 bg-white rounded-lg shadow-sm border border-gray-100">
          <Button className="bg-blue-600 hover:bg-blue-700 text-white px-6" asChild>
            <Link href="#check-suppression">Internal API</Link>
          </Button>
          <Button variant="outline" className="border-gray-200 hover:bg-gray-50 px-6" asChild>
            <Link href="/docs/external-api">External API for Lead Forms</Link>
          </Button>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-[250px_1fr]">
        <div className="space-y-4">
          <div className="font-medium">API Reference</div>
          <nav className="flex flex-col space-y-1">
            <Link href="#leads" className="rounded-md px-3 py-2 text-sm hover:bg-muted">
              Submit Lead (Opt-In)
            </Link>
            <Link href="#dashboard-optin" className="rounded-md px-3 py-2 text-sm hover:bg-muted">
              Add Dashboard Opt-In
            </Link>
            <Link href="#check-suppression" className="rounded-md px-3 py-2 text-sm hover:bg-muted">
              Check Suppression
            </Link>
            <Link href="#opt-out" className="rounded-md px-3 py-2 text-sm hover:bg-muted">
              Add to DNC (Opt-Out)
            </Link>
            <Link href="#batch-check" className="rounded-md px-3 py-2 text-sm hover:bg-muted">
              Batch Check DNC
            </Link>
            <Link href="#bulk-dnc" className="rounded-md px-3 py-2 text-sm hover:bg-muted">
              Bulk DNC Addition
            </Link>
            <Link href="#compliance-verification" className="rounded-md px-3 py-2 text-sm hover:bg-muted">
              Compliance Check
            </Link>
            <Link href="#trusted-form" className="rounded-md px-3 py-2 text-sm hover:bg-muted">
              TrustedForm Verification
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
          <Card id="dashboard-optin">
            <CardHeader>
              <CardTitle>Add Dashboard Opt-In</CardTitle>
              <CardDescription>Add a new opt-in to appear on the dashboard</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h3 className="text-sm font-medium">Endpoint</h3>
                <p className="mt-1 font-mono text-sm">POST /api/leads/add</p>
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
  "firstName": "John",
  "lastName": "Doe",
  "phone": "+14155552671",
  "email": "john@example.com",
  "zipCode": "94105",
  "trustedFormCertUrl": "https://cert.trustedform.com/..."
}`}
                      </code>
                    </pre>
                  </div>
                  <div>
                    <h3 className="text-sm font-medium">Field Descriptions</h3>
                    <ul className="mt-2 list-disc pl-6 text-sm text-gray-600">
                      <li><code>firstName</code>: First name of the lead (required)</li>
                      <li><code>lastName</code>: Last name of the lead (required)</li>
                      <li><code>phone</code>: Phone number in E.164 format (required)</li>
                      <li><code>email</code>: Valid email address (required)</li>
                      <li><code>zipCode</code>: 5-digit US zip code (required)</li>
                      <li><code>trustedFormCertUrl</code>: Valid TrustedForm certificate URL (required)</li>
                    </ul>
                  </div>
                </TabsContent>
                <TabsContent value="response" className="mt-2 space-y-4">
                  <div>
                    <h3 className="text-sm font-medium">Success Response (200 OK)</h3>
                    <pre className="mt-1 overflow-x-auto rounded-md bg-slate-950 p-4">
                      <code className="text-sm text-white">
                        {`{
  "success": true,
  "data": {
    "id": "lead_01H9X7KXZJ1N2Y3Z4A5B6C7D8",
    "name": "John Doe",
    "phone": "+14155552671",
    "date": "2025-05-15T18:17:57-07:00"
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
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid request body",
    "details": {
      "firstName": ["First name is required"],
      "phone": ["Phone number must be in E.164 format"]
    }
  }
}`}
                      </code>
                    </pre>
                  </div>
                </TabsContent>
              </Tabs>

              <div className="mt-4">
                <h3 className="text-sm font-medium">Notes</h3>
                <ul className="mt-2 list-disc pl-6 text-sm text-gray-600">
                  <li>All opt-ins submitted through this endpoint will appear in the dashboard's Recent Opt-Ins section</li>
                  <li>Phone numbers must be in E.164 format (e.g., +14155552671)</li>
                  <li>TrustedForm certificates will be verified before the opt-in is accepted</li>
                  <li>Rate limits apply as specified in the Rate Limits section</li>
                </ul>
              </div>
            </CardContent>
          </Card>

          <Card id="leads">
            <CardHeader>
              <CardTitle>Submit Lead (Opt-In)</CardTitle>
              <CardDescription>Submit a new lead to the system</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h3 className="text-sm font-medium">Endpoint</h3>
                <p className="mt-1 font-mono text-sm">POST /api/v1/leads</p>
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
  "firstName": "John",
  "lastName": "Doe",
  "email": "john@example.com",
  "phone": "1234567890",
  "zipCode": "12345",
  "trustedFormCertUrl": "https://cert.trustedform.com/..."
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
  "data": {
    "id": "lead_123",
    "first_name": "John",
    "last_name": "Doe",
    "email": "john@example.com",
    "phone": "1234567890",
    "zip_code": "12345",
    "trusted_form_cert_url": "https://cert.trustedform.com/...",
    "status": "new",
    "created_at": "2025-05-15T17:55:28-07:00",
    "updated_at": "2025-05-15T17:55:28-07:00"
  }
}`}
                      </code>
                    </pre>
                  </div>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>

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

          <Card id="bulk-dnc">
            <CardHeader>
              <CardTitle>Bulk DNC Addition</CardTitle>
              <CardDescription>Add multiple phone numbers to the DNC list</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h3 className="text-sm font-medium">Endpoint</h3>
                <p className="mt-1 font-mono text-sm">POST /api/dialer/dnc/bulk</p>
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
  "phones": [
    "1234567890",
    "0987654321"
  ],
  "reason": "Consumer Request",
  "source": "Web Form"
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
  "message": "Successfully added 2 numbers to DNC list",
  "data": {
    "added": [
      "1234567890",
      "0987654321"
    ]
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
              <CardTitle>Batch Check DNC</CardTitle>
              <CardDescription>Check multiple phone numbers against the DNC list</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h3 className="text-sm font-medium">Endpoint</h3>
                <p className="mt-1 font-mono text-sm">POST /api/v1/batch-check</p>
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
  "phones": [
    "1234567890",
    "0987654321"
  ]
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
  "data": {
    "results": [
      {
        "phone": "1234567890",
        "onDnc": false
      },
      {
        "phone": "0987654321",
        "onDnc": true,
        "addedOn": "2025-05-15T17:55:28-07:00",
        "reason": "Consumer Request"
      }
    ]
  }
}`}
                      </code>
                    </pre>
                  </div>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>

          <Card id="compliance-verification">
            <CardHeader>
              <CardTitle>Compliance Check</CardTitle>
              <CardDescription>Verify compliance status for a phone number</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h3 className="text-sm font-medium">Endpoint</h3>
                <p className="mt-1 font-mono text-sm">POST /api/v1/compliance/check</p>
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
  "phone": "1234567890",
  "checkType": "all"
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
  "data": {
    "phone": "1234567890",
    "compliant": true,
    "checks": {
      "dnc": {
        "passed": true,
        "details": "Not found on DNC list"
      },
      "tcpa": {
        "passed": true,
        "details": "Valid consent record found"
      }
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

          <Card id="trusted-form">
            <CardHeader>
              <CardTitle>TrustedForm Verification</CardTitle>
              <CardDescription>Verify a TrustedForm certificate</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h3 className="text-sm font-medium">Endpoint</h3>
                <p className="mt-1 font-mono text-sm">POST /api/v1/trustedform/verify</p>
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
  "certificateUrl": "https://cert.trustedform.com/...",
  "phoneNumber": "1234567890",
  "email": "john@example.com"
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
  "data": {
    "verified": true,
    "created": "2025-05-15T17:55:28-07:00",
    "age": "1 hour",
    "fingerprints": {
      "phone": true,
      "email": true
    },
    "screenshot": "https://cert.trustedform.com/.../screenshot.jpg"
  }
}`}
                      </code>
                    </pre>
                  </div>
                </TabsContent>
              </Tabs>
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
              <ul className="mt-2 list-disc pl-6 text-sm text-gray-600">
                <li>Compliance check: 10,000 requests per minute per IP</li>
                <li>Single DNC addition: 10,000 requests per minute per API key</li>
                <li>Bulk DNC addition: 10,000 requests per minute per API key</li>
              </ul>
              <p className="mt-4 text-sm">Rate limit headers are included in all API responses:</p>
              <pre className="mt-2 overflow-x-auto rounded-md bg-slate-950 p-4">
                <code className="text-sm text-white">
                  {`X-RateLimit-Limit: 10000
X-RateLimit-Remaining: 9995
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
