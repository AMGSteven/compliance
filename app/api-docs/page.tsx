import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import Link from "next/link"

export default function ApiDocsPage() {
  return (
    <main className="container mx-auto py-10">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">API Documentation</h1>
        <p className="text-muted-foreground">Reference documentation for the Suppression & Compliance Engine API</p>
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

              <div>
                <h3 className="text-sm font-medium">Request Body</h3>
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
                <h3 className="text-sm font-medium">Response</h3>
                <pre className="mt-1 overflow-x-auto rounded-md bg-slate-950 p-4">
                  <code className="text-sm text-white">
                    {`{
  "suppressed": true,
  "details": {
    "email": true,
    "phone": false,
    "postal": false
  },
  "timestamp": "2025-05-07T11:35:26.000Z",
  "requestId": "550e8400-e29b-41d4-a716-446655440000"
}`}
                  </code>
                </pre>
              </div>
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

              <div>
                <h3 className="text-sm font-medium">Request Body</h3>
                <pre className="mt-1 overflow-x-auto rounded-md bg-slate-950 p-4">
                  <code className="text-sm text-white">
                    {`{
  "identifier": "user@example.com",
  "identifierType": "email",
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

              <div>
                <h3 className="text-sm font-medium">Response</h3>
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
            </CardContent>
          </Card>

          <Card id="batch-check">
            <CardHeader>
              <CardTitle>Batch Check</CardTitle>
              <CardDescription>Check multiple contacts against the suppression list</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h3 className="text-sm font-medium">Endpoint</h3>
                <p className="mt-1 font-mono text-sm">POST /api/v1/batch-check</p>
              </div>

              <div>
                <h3 className="text-sm font-medium">Request Body</h3>
                <pre className="mt-1 overflow-x-auto rounded-md bg-slate-950 p-4">
                  <code className="text-sm text-white">
                    {`{
  "contacts": [
    {
      "id": "contact_1",
      "email": "user1@example.com"
    },
    {
      "id": "contact_2",
      "phone": "+15551234567"
    },
    {
      "id": "contact_3",
      "email": "user3@example.com",
      "phone": "+15559876543"
    }
  ],
  "channel": "all"
}`}
                  </code>
                </pre>
              </div>

              <div>
                <h3 className="text-sm font-medium">Response</h3>
                <pre className="mt-1 overflow-x-auto rounded-md bg-slate-950 p-4">
                  <code className="text-sm text-white">
                    {`{
  "timestamp": "2025-05-07T11:35:26.000Z",
  "requestId": "550e8400-e29b-41d4-a716-446655440000",
  "totalProcessed": 3,
  "totalSuppressed": 1,
  "results": [
    {
      "id": "contact_1",
      "suppressed": true,
      "details": {
        "email": true
      }
    },
    {
      "id": "contact_2",
      "suppressed": false,
      "details": {
        "phone": false
      }
    },
    {
      "id": "contact_3",
      "suppressed": false,
      "details": {
        "email": false,
        "phone": false
      }
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
              <p className="text-sm">All API requests must include your API key in the Authorization header:</p>
              <pre className="overflow-x-auto rounded-md bg-slate-950 p-4">
                <code className="text-sm text-white">Authorization: Bearer YOUR_API_KEY</code>
              </pre>
              <p className="text-sm">
                For this starter implementation, authentication is not yet enforced. It will be added in a future
                update.
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
                The API is rate limited to protect our infrastructure and ensure fair usage. Rate limits will be
                implemented in a future update.
              </p>
              <p className="text-sm">For this starter implementation, there are no rate limits enforced.</p>
            </CardContent>
          </Card>
        </div>
      </div>
    </main>
  )
}
