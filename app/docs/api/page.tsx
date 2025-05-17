"use client"

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
            <Link href="#email-optin" className="rounded-md px-3 py-2 text-sm hover:bg-muted">
              Email Opt-In
            </Link>
            <Link href="#email-optout" className="rounded-md px-3 py-2 text-sm hover:bg-muted">
              Email Opt-Out
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
          <Card id="leads">
            <CardHeader>
              <CardTitle>Submit Lead (Opt-In)</CardTitle>
              <CardDescription>Add a new phone opt-in lead with required tracking fields</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h3 className="text-sm font-medium">Endpoint</h3>
                <p className="mt-1 font-mono text-sm">POST /api/leads</p>
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
x-api-key: YOUR_API_KEY`}
                      </code>
                    </pre>
                  </div>
                  <div>
                    <h3 className="text-sm font-medium">Body</h3>
                    <pre className="mt-1 overflow-x-auto rounded-md bg-slate-950 p-4">
                      <code className="text-sm text-white">
                        {`{
  "firstName": "John",          // Required
  "lastName": "Doe",            // Required
  "email": "john@example.com",  // Required
  "phone": "+15551234567",     // Required
  "list_id": "list_12345",     // Required - provided by administrator
  "campaign_id": "camp_6789",  // Required - provided by administrator
  "traffic_source": "Custom",  // Optional - will be auto-mapped from list_id if not provided
  "address": "123 Main St",    // Optional - physical address 
  "city": "San Francisco",     // Optional - city
  "state": "CA",              // Optional - state/province
  "zip_code": "90210",         // Optional - postal code
  "source": "Landing Page",    // Optional - lead source/origin
  "transaction_id": "abc123",  // Optional - unique transaction identifier
  "custom_fields": {           // Optional - any additional custom data
    "age": 35,
    "income": "100k-150k",
    "interested_in": "Solar Panels"
  },
  "trusted_form_cert_url": "https://cert.trustedform.com/..."  // Optional
}`}
                      </code>
                    </pre>
                  </div>
                  <div>
                    <h3 className="text-sm font-medium text-amber-500">⚠️ Important Note</h3>
                    <p className="mt-1 text-sm">The <code className="text-xs bg-gray-100 p-1 rounded">list_id</code> and <code className="text-xs bg-gray-100 p-1 rounded">campaign_id</code> fields are required for all lead submissions. These values will be provided to you by the administrator and must be included with every submission.</p>
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
    "id": "123e4567-e89b-12d3-a456-426614174000",
    "first_name": "John",
    "last_name": "Doe",
    "email": "john@example.com",
    "phone": "+15551234567",
    "address": "123 Main St",
    "city": "San Francisco",
    "state": "CA",
    "zip_code": "90210",
    "source": "Landing Page",
    "transaction_id": "abc123",
    "custom_fields": {
      "age": 35,
      "income": "100k-150k",
      "interested_in": "Solar Panels"
    },
    "list_id": "list_12345",
    "traffic_source": "Onpoint",
    "campaign_id": "camp_6789",
    "created_at": "2025-05-16T15:34:46-07:00"
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
  "error": "Missing required fields",
  "received": {
    "firstName": "John",
    "lastName": "Doe",
    "email": "john@example.com",
    "phone": "+15551234567"
    // Missing list_id and campaign_id
  },
  "required": ["firstName", "lastName", "email", "phone", "list_id", "campaign_id"]
}`}
                      </code>
                    </pre>
                  </div>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
          
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
  "email": "john@example.com",
  "phone": "+15551234567",
  "certificateUrl": "https://cert.trustedform.com/...",
  "source": "https://yourleadsite.com/form-page",
  "formName": "Insurance Quote Form",
  "verifyImmediately": true
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
  "message": "Lead and TrustedForm certificate captured successfully",
  "certificateId": "cert_123abc",
  "status": "pending",
  "verificationResult": {
    "success": true,
    "status": "verified",
    "matchStatus": true
  }
}`}
                      </code>
                    </pre>
                  </div>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>

          <Card id="email-optin">
            <CardHeader>
              <CardTitle>Email Opt-In</CardTitle>
              <CardDescription>Add and check email opt-ins</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Tabs defaultValue="post">
                <TabsList>
                  <TabsTrigger value="post">Add Email Opt-In</TabsTrigger>
                  <TabsTrigger value="get">Check Email Opt-In</TabsTrigger>
                  <TabsTrigger value="recent">Get Recent Opt-Ins</TabsTrigger>
                </TabsList>
                <TabsContent value="post" className="mt-2 space-y-4">
                  <div>
                    <h3 className="text-sm font-medium">Endpoint</h3>
                    <p className="mt-1 font-mono text-sm">POST /api/email/optin</p>
                  </div>
                  <div>
                    <h3 className="text-sm font-medium">Headers</h3>
                    <pre className="mt-1 overflow-x-auto rounded-md bg-slate-950 p-4">
                      <code className="text-sm text-white">
                        {`Content-Type: application/json
api_key: YOUR_API_KEY`}
                      </code>
                    </pre>
                  </div>
                  <div>
                    <h3 className="text-sm font-medium">Body</h3>
                    <pre className="mt-1 overflow-x-auto rounded-md bg-slate-950 p-4">
                      <code className="text-sm text-white">
                        {`{
  "email": "subscriber@example.com",
  "first_name": "Jane",    // Optional
  "last_name": "Smith",    // Optional
  "source": "website-form", // Optional
  "consent_details": "Subscribed via newsletter form"  // Optional
}`}
                      </code>
                    </pre>
                  </div>
                  <div>
                    <h3 className="text-sm font-medium">Success Response (200 OK)</h3>
                    <pre className="mt-1 overflow-x-auto rounded-md bg-slate-950 p-4">
                      <code className="text-sm text-white">
                        {`{
  "success": true,
  "message": "Email added to opt-in list",
  "data": {
    "id": "123e4567-e89b-12d3-a456-426614174000",
    "email": "subscriber@example.com",
    "status": "active",
    "date_added": "2025-05-16T00:31:53-07:00"
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
  "message": "Invalid email format"
}`}
                      </code>
                    </pre>
                  </div>
                </TabsContent>
                <TabsContent value="get" className="mt-2 space-y-4">
                  <div>
                    <h3 className="text-sm font-medium">Endpoint</h3>
                    <p className="mt-1 font-mono text-sm">GET /api/email/optin?email=subscriber@example.com</p>
                  </div>
                  <div>
                    <h3 className="text-sm font-medium">Headers</h3>
                    <pre className="mt-1 overflow-x-auto rounded-md bg-slate-950 p-4">
                      <code className="text-sm text-white">
                        {`api_key: YOUR_API_KEY`}
                      </code>
                    </pre>
                  </div>
                  <div>
                    <h3 className="text-sm font-medium">Success Response (200 OK)</h3>
                    <pre className="mt-1 overflow-x-auto rounded-md bg-slate-950 p-4">
                      <code className="text-sm text-white">
                        {`{
  "success": true,
  "isOptedIn": true,
  "data": {
    "email": "subscriber@example.com",
    "date_added": "2025-05-16T00:31:53-07:00",
    "source": "website-form"
  }
}`}
                      </code>
                    </pre>
                  </div>
                  <div>
                    <h3 className="text-sm font-medium">Not Found Response (200 OK)</h3>
                    <pre className="mt-1 overflow-x-auto rounded-md bg-slate-950 p-4">
                      <code className="text-sm text-white">
                        {`{
  "success": true,
  "isOptedIn": false
}`}
                      </code>
                    </pre>
                  </div>
                </TabsContent>
                <TabsContent value="recent" className="mt-2 space-y-4">
                  <div>
                    <h3 className="text-sm font-medium">Endpoint</h3>
                    <p className="mt-1 font-mono text-sm">GET /api/email/recent/optins</p>
                  </div>
                  <div>
                    <h3 className="text-sm font-medium">Headers</h3>
                    <pre className="mt-1 overflow-x-auto rounded-md bg-slate-950 p-4">
                      <code className="text-sm text-white">
                        {`api_key: YOUR_API_KEY`}
                      </code>
                    </pre>
                  </div>
                  <div>
                    <h3 className="text-sm font-medium">Query Parameters</h3>
                    <pre className="mt-1 overflow-x-auto rounded-md bg-slate-950 p-4">
                      <code className="text-sm text-white">
                        {`limit=10    // Optional: Number of records to return (default: 10, max: 100) 
offset=0    // Optional: Pagination offset`}
                      </code>
                    </pre>
                  </div>
                  <div>
                    <h3 className="text-sm font-medium">Success Response (200 OK)</h3>
                    <pre className="mt-1 overflow-x-auto rounded-md bg-slate-950 p-4">
                      <code className="text-sm text-white">
                        {`{
  "success": true,
  "data": [
    {
      "id": "123e4567-e89b-12d3-a456-426614174000",
      "email": "subscriber@example.com",
      "first_name": "Jane", 
      "last_name": "Smith",
      "source": "website-form",
      "consent_details": "Subscribed via newsletter form",
      "date_added": "2025-05-16T00:31:53-07:00"
    },
    {
      "id": "223e4567-e89b-12d3-a456-426614174001",
      "email": "newsletter@example.com",
      "source": "marketing-campaign",
      "date_added": "2025-05-15T14:22:10-07:00"
    }
  ],
  "count": 2,
  "total": 2
}`}
                      </code>
                    </pre>
                  </div>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>

          <Card id="email-optout">
            <CardHeader>
              <CardTitle>Email Opt-Out</CardTitle>
              <CardDescription>Add and check email opt-outs</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Tabs defaultValue="post">
                <TabsList>
                  <TabsTrigger value="post">Add Email Opt-Out</TabsTrigger>
                  <TabsTrigger value="get">Check Email Opt-Out</TabsTrigger>
                  <TabsTrigger value="recent">Get Recent Opt-Outs</TabsTrigger>
                </TabsList>
                <TabsContent value="post" className="mt-2 space-y-4">
                  <div>
                    <h3 className="text-sm font-medium">Endpoint</h3>
                    <p className="mt-1 font-mono text-sm">POST /api/email/optout</p>
                  </div>
                  <div>
                    <h3 className="text-sm font-medium">Headers</h3>
                    <pre className="mt-1 overflow-x-auto rounded-md bg-slate-950 p-4">
                      <code className="text-sm text-white">
                        {`Content-Type: application/json
api_key: YOUR_API_KEY`}
                      </code>
                    </pre>
                  </div>
                  <div>
                    <h3 className="text-sm font-medium">Body</h3>
                    <pre className="mt-1 overflow-x-auto rounded-md bg-slate-950 p-4">
                      <code className="text-sm text-white">
                        {`{
  "email": "unsubscribe@example.com",
  "first_name": "John",    // Optional
  "last_name": "Doe",      // Optional
  "reason": "No longer interested",  // Optional
  "source": "unsubscribe-form"       // Optional
}`}
                      </code>
                    </pre>
                  </div>
                  <div>
                    <h3 className="text-sm font-medium">Success Response (200 OK)</h3>
                    <pre className="mt-1 overflow-x-auto rounded-md bg-slate-950 p-4">
                      <code className="text-sm text-white">
                        {`{
  "success": true,
  "message": "Email added to opt-out list",
  "data": {
    "id": "123e4567-e89b-12d3-a456-426614174000",
    "email": "unsubscribe@example.com",
    "status": "opted_out",
    "date_added": "2025-05-16T00:31:53-07:00"
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
  "message": "Invalid email format"
}`}
                      </code>
                    </pre>
                  </div>
                </TabsContent>
                <TabsContent value="get" className="mt-2 space-y-4">
                  <div>
                    <h3 className="text-sm font-medium">Endpoint</h3>
                    <p className="mt-1 font-mono text-sm">GET /api/email/optout?email=unsubscribe@example.com</p>
                  </div>
                  <div>
                    <h3 className="text-sm font-medium">Headers</h3>
                    <pre className="mt-1 overflow-x-auto rounded-md bg-slate-950 p-4">
                      <code className="text-sm text-white">
                        {`api_key: YOUR_API_KEY`}
                      </code>
                    </pre>
                  </div>
                  <div>
                    <h3 className="text-sm font-medium">Success Response (200 OK)</h3>
                    <pre className="mt-1 overflow-x-auto rounded-md bg-slate-950 p-4">
                      <code className="text-sm text-white">
                        {`{
  "success": true,
  "isOptedOut": true,
  "data": {
    "email": "unsubscribe@example.com",
    "date_added": "2025-05-16T00:31:53-07:00",
    "reason": "No longer interested"
  }
}`}
                      </code>
                    </pre>
                  </div>
                  <div>
                    <h3 className="text-sm font-medium">Not Found Response (200 OK)</h3>
                    <pre className="mt-1 overflow-x-auto rounded-md bg-slate-950 p-4">
                      <code className="text-sm text-white">
                        {`{
  "success": true,
  "isOptedOut": false
}`}
                      </code>
                    </pre>
                  </div>
                </TabsContent>
                <TabsContent value="recent" className="mt-2 space-y-4">
                  <div>
                    <h3 className="text-sm font-medium">Endpoint</h3>
                    <p className="mt-1 font-mono text-sm">GET /api/email/recent/optouts</p>
                  </div>
                  <div>
                    <h3 className="text-sm font-medium">Headers</h3>
                    <pre className="mt-1 overflow-x-auto rounded-md bg-slate-950 p-4">
                      <code className="text-sm text-white">
                        {`api_key: YOUR_API_KEY`}
                      </code>
                    </pre>
                  </div>
                  <div>
                    <h3 className="text-sm font-medium">Query Parameters</h3>
                    <pre className="mt-1 overflow-x-auto rounded-md bg-slate-950 p-4">
                      <code className="text-sm text-white">
                        {`limit=10    // Optional: Number of records to return (default: 10, max: 100) 
offset=0    // Optional: Pagination offset`}
                      </code>
                    </pre>
                  </div>
                  <div>
                    <h3 className="text-sm font-medium">Success Response (200 OK)</h3>
                    <pre className="mt-1 overflow-x-auto rounded-md bg-slate-950 p-4">
                      <code className="text-sm text-white">
                        {`{
  "success": true,
  "data": [
    {
      "id": "123e4567-e89b-12d3-a456-426614174000",
      "email": "unsubscribe@example.com",
      "first_name": "John",
      "last_name": "Doe",
      "reason": "No longer interested",
      "source": "unsubscribe-form",
      "date_added": "2025-05-16T00:31:53-07:00"
    },
    {
      "id": "223e4567-e89b-12d3-a456-426614174001",
      "email": "optout@example.com",
      "reason": "Spam complaints",
      "source": "admin-interface",
      "date_added": "2025-05-15T14:22:10-07:00"
    }
  ],
  "count": 2,
  "total": 2
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
              <CardTitle>Add to DNC (Opt-Out)</CardTitle>
              <CardDescription>Add a phone number to the Do Not Contact list</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h3 className="text-sm font-medium">Endpoint</h3>
                <p className="mt-1 font-mono text-sm">POST /api/dialer/dnc</p>
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
x-api-key: YOUR_API_KEY`}
                      </code>
                    </pre>
                  </div>
                  
                  <div>
                    <h3 className="text-sm font-medium">Body</h3>
                    <pre className="mt-1 overflow-x-auto rounded-md bg-slate-950 p-4">
                      <code className="text-sm text-white">
                        {`{
  "phone_number": "+15551234567",  // Required - must use this exact parameter name (snake_case)
  "reason": "Customer request",     // Optional - reason for adding to DNC
  "source": "website-form"         // Optional - source of the opt-out
}`}
                      </code>
                    </pre>
                  </div>
                  <div>
                    <h3 className="text-sm font-medium text-amber-500">⚠️ Important Note</h3>
                    <p className="mt-1 text-sm">The parameter name <code className="text-xs bg-gray-100 p-1 rounded">phone_number</code> must be in snake_case format exactly as shown. Using <code className="text-xs bg-gray-100 p-1 rounded">phoneNumber</code> or other variations will result in an error.</p>
                  </div>
                </TabsContent>
                <TabsContent value="response" className="mt-2 space-y-4">
                  <div>
                    <h3 className="text-sm font-medium">Success Response (200 OK)</h3>
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
                  <div>
                    <h3 className="text-sm font-medium">Error Response (400 Bad Request)</h3>
                    <pre className="mt-1 overflow-x-auto rounded-md bg-slate-950 p-4">
                      <code className="text-sm text-white">
                        {`{
  "success": false,
  "error": "phoneNumber is required"
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
