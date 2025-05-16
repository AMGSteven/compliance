

"use client"

// Force dynamic rendering instead of static generation
export const dynamic = 'force-dynamic';
import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ArrowLeft, Loader2, RefreshCw } from "lucide-react"
import Link from "next/link"
import { Badge } from "@/components/ui/badge"
import { WebhookProcessor } from "@/components/webhooks/webhook-processor"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"

interface WebhookEvent {
  id: string
  webhook_id: string
  event_type: string
  status: "pending" | "success" | "failed"
  response_code?: number
  attempts: number
  created_at: string
  updated_at: string
  next_retry?: string
  error_message?: string
}

export default function WebhookEventsPage() {
  const [events, setEvents] = useState<WebhookEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchEvents = async () => {
    try {
      setLoading(true)
      setError(null)

      // In a real implementation, this would fetch from a dedicated API endpoint
      // For now, we'll use a mock implementation
      const mockEvents: WebhookEvent[] = [
        {
          id: "evt_1",
          webhook_id: "wh_1",
          event_type: "email.optout",
          status: "success",
          response_code: 200,
          attempts: 1,
          created_at: new Date(Date.now() - 3600000).toISOString(),
          updated_at: new Date(Date.now() - 3590000).toISOString(),
        },
        {
          id: "evt_2",
          webhook_id: "wh_2",
          event_type: "lead.validated",
          status: "failed",
          response_code: 500,
          attempts: 3,
          created_at: new Date(Date.now() - 7200000).toISOString(),
          updated_at: new Date(Date.now() - 3600000).toISOString(),
          next_retry: new Date(Date.now() + 3600000).toISOString(),
          error_message: "Internal Server Error",
        },
        {
          id: "evt_3",
          webhook_id: "wh_1",
          event_type: "compliance.warning",
          status: "pending",
          attempts: 0,
          created_at: new Date(Date.now() - 1800000).toISOString(),
          updated_at: new Date(Date.now() - 1800000).toISOString(),
        },
      ]

      setEvents(mockEvents)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load webhook events")
      console.error("Error fetching webhook events:", err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchEvents()
  }, [])

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "success":
        return <Badge variant="default">Success</Badge>
      case "failed":
        return <Badge variant="destructive">Failed</Badge>
      case "pending":
        return <Badge variant="secondary">Pending</Badge>
      default:
        return <Badge variant="outline">{status}</Badge>
    }
  }

  return (
    <div className="container mx-auto py-10">
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center">
          <Button variant="outline" size="icon" className="mr-4" asChild>
            <Link href="/webhooks">
              <ArrowLeft className="h-4 w-4" />
              <span className="sr-only">Back</span>
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Webhook Events</h1>
            <p className="text-muted-foreground">Monitor and manage webhook delivery events</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={fetchEvents} disabled={loading}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <div className="md:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Recent Events</CardTitle>
              <CardDescription>Recent webhook delivery attempts</CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : error ? (
                <Alert variant="destructive" className="mb-4">
                  <AlertTitle>Error</AlertTitle>
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              ) : events.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <p className="text-muted-foreground">No webhook events found</p>
                </div>
              ) : (
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Event Type</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Response</TableHead>
                        <TableHead>Attempts</TableHead>
                        <TableHead>Created</TableHead>
                        <TableHead>Next Retry</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {events.map((event) => (
                        <TableRow key={event.id}>
                          <TableCell className="font-medium">{event.event_type}</TableCell>
                          <TableCell>{getStatusBadge(event.status)}</TableCell>
                          <TableCell>
                            {event.response_code ? (
                              <span
                                className={
                                  event.response_code >= 200 && event.response_code < 300
                                    ? "text-green-600"
                                    : "text-red-600"
                                }
                              >
                                {event.response_code}
                              </span>
                            ) : event.error_message ? (
                              <span className="text-red-600" title={event.error_message}>
                                Error
                              </span>
                            ) : (
                              "-"
                            )}
                          </TableCell>
                          <TableCell>{event.attempts}</TableCell>
                          <TableCell>{new Date(event.created_at).toLocaleString()}</TableCell>
                          <TableCell>{event.next_retry ? new Date(event.next_retry).toLocaleString() : "-"}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
        <div>
          <WebhookProcessor />
        </div>
      </div>
    </div>
  )
}
