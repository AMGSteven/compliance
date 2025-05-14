"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { WebhookEventsTable } from "@/components/webhooks/webhook-events-table"
import { WebhookForm } from "@/components/webhooks/webhook-form"
import { ArrowLeft, Copy, Edit, Loader2, Play, RefreshCw, Trash2 } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

interface Webhook {
  id: string
  name: string
  url: string
  events: string[]
  status: "active" | "inactive" | "failed"
  secret?: string
  created_at: string
  updated_at: string
  last_triggered?: string
  failure_count?: number
  description?: string
}

export default function WebhookDetailPage({ params }: { params: { id: string } }) {
  const router = useRouter()
  const [webhook, setWebhook] = useState<Webhook | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [testResult, setTestResult] = useState<any | null>(null)
  const [testLoading, setTestLoading] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deleteLoading, setDeleteLoading] = useState(false)
  const [editMode, setEditMode] = useState(false)

  const fetchWebhook = async () => {
    try {
      setLoading(true)
      setError(null)
      const response = await fetch(`/api/v1/webhooks/${params.id}`)

      if (!response.ok) {
        throw new Error(`HTTP error ${response.status}`)
      }

      const data = await response.json()
      setWebhook(data.webhook)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load webhook")
      console.error("Error fetching webhook:", err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchWebhook()
  }, [params.id])

  const testWebhook = async () => {
    try {
      setTestLoading(true)
      setTestResult(null)
      const response = await fetch(`/api/v1/webhooks/${params.id}/test`, {
        method: "POST",
      })

      const data = await response.json()
      setTestResult(data)
    } catch (err) {
      console.error("Error testing webhook:", err)
      setTestResult({
        success: false,
        error: err instanceof Error ? err.message : "Failed to test webhook",
      })
    } finally {
      setTestLoading(false)
    }
  }

  const deleteWebhook = async () => {
    try {
      setDeleteLoading(true)
      const response = await fetch(`/api/v1/webhooks/${params.id}`, {
        method: "DELETE",
      })

      if (!response.ok) {
        throw new Error(`HTTP error ${response.status}`)
      }

      router.push("/webhooks")
    } catch (err) {
      console.error("Error deleting webhook:", err)
      setError(err instanceof Error ? err.message : "Failed to delete webhook")
      setDeleteDialogOpen(false)
    } finally {
      setDeleteLoading(false)
    }
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard
      .writeText(text)
      .then(() => {
        alert("Copied to clipboard")
      })
      .catch((err) => {
        console.error("Failed to copy: ", err)
      })
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "active":
        return <Badge variant="default">Active</Badge>
      case "inactive":
        return <Badge variant="secondary">Inactive</Badge>
      case "failed":
        return <Badge variant="destructive">Failed</Badge>
      default:
        return <Badge variant="outline">{status}</Badge>
    }
  }

  if (loading) {
    return (
      <div className="container mx-auto py-10">
        <div className="mb-6 flex items-center">
          <Button variant="outline" size="icon" className="mr-4" asChild>
            <Link href="/webhooks">
              <ArrowLeft className="h-4 w-4" />
              <span className="sr-only">Back</span>
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Webhook Details</h1>
            <p className="text-muted-foreground">Loading webhook information...</p>
          </div>
        </div>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="container mx-auto py-10">
        <div className="mb-6 flex items-center">
          <Button variant="outline" size="icon" className="mr-4" asChild>
            <Link href="/webhooks">
              <ArrowLeft className="h-4 w-4" />
              <span className="sr-only">Back</span>
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Webhook Details</h1>
            <p className="text-muted-foreground">Error loading webhook</p>
          </div>
        </div>
        <Alert variant="destructive" className="mb-6">
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
        <Button onClick={fetchWebhook}>
          <RefreshCw className="mr-2 h-4 w-4" />
          Try Again
        </Button>
      </div>
    )
  }

  if (editMode) {
    return (
      <div className="container mx-auto py-10">
        <div className="mb-6 flex items-center">
          <Button variant="outline" size="icon" className="mr-4" onClick={() => setEditMode(false)}>
            <ArrowLeft className="h-4 w-4" />
            <span className="sr-only">Back</span>
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Edit Webhook</h1>
            <p className="text-muted-foreground">Update webhook configuration</p>
          </div>
        </div>
        <WebhookForm
          webhookId={params.id}
          onSuccess={() => {
            setEditMode(false)
            fetchWebhook()
          }}
        />
      </div>
    )
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
            <h1 className="text-2xl font-bold tracking-tight">{webhook?.name}</h1>
            <p className="text-muted-foreground">Webhook details and delivery history</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setEditMode(true)}>
            <Edit className="mr-2 h-4 w-4" />
            Edit
          </Button>
          <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="destructive" size="sm">
                <Trash2 className="mr-2 h-4 w-4" />
                Delete
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Delete Webhook</DialogTitle>
                <DialogDescription>
                  Are you sure you want to delete this webhook? This action cannot be undone.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
                  Cancel
                </Button>
                <Button variant="destructive" onClick={deleteWebhook} disabled={deleteLoading}>
                  {deleteLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Deleting...
                    </>
                  ) : (
                    "Delete Webhook"
                  )}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Tabs defaultValue="details" className="mb-6">
        <TabsList>
          <TabsTrigger value="details">Details</TabsTrigger>
          <TabsTrigger value="events">Events</TabsTrigger>
          <TabsTrigger value="test">Test</TabsTrigger>
        </TabsList>
        <TabsContent value="details">
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Webhook Information</CardTitle>
              <CardDescription>Details about this webhook endpoint</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <h3 className="text-sm font-medium">Status</h3>
                  <div className="mt-1">{getStatusBadge(webhook?.status || "unknown")}</div>
                </div>
                <div>
                  <h3 className="text-sm font-medium">Last Triggered</h3>
                  <p className="mt-1 text-sm">
                    {webhook?.last_triggered ? new Date(webhook.last_triggered).toLocaleString() : "Never triggered"}
                  </p>
                </div>
                <div>
                  <h3 className="text-sm font-medium">URL</h3>
                  <div className="mt-1 flex items-center">
                    <p className="font-mono text-xs truncate">{webhook?.url}</p>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="ml-2"
                      onClick={() => copyToClipboard(webhook?.url || "")}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <div>
                  <h3 className="text-sm font-medium">Created</h3>
                  <p className="mt-1 text-sm">
                    {webhook?.created_at ? new Date(webhook.created_at).toLocaleString() : "-"}
                  </p>
                </div>
                <div className="sm:col-span-2">
                  <h3 className="text-sm font-medium">Description</h3>
                  <p className="mt-1 text-sm">{webhook?.description || "No description provided"}</p>
                </div>
                <div className="sm:col-span-2">
                  <h3 className="text-sm font-medium">Events</h3>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {webhook?.events.map((event) => (
                      <Badge key={event} variant="outline" className="text-xs">
                        {event}
                      </Badge>
                    ))}
                  </div>
                </div>
                {webhook?.secret && (
                  <div className="sm:col-span-2">
                    <h3 className="text-sm font-medium">Secret Key</h3>
                    <div className="mt-1 flex items-center">
                      <p className="font-mono text-xs">
                        {webhook.secret.substring(0, 8)}...{webhook.secret.substring(webhook.secret.length - 4)}
                      </p>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="ml-2"
                        onClick={() => copyToClipboard(webhook.secret || "")}
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      This secret is used to sign webhook payloads. Verify signatures using the X-Signature header.
                    </p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="events">
          <WebhookEventsTable webhookId={params.id} />
        </TabsContent>
        <TabsContent value="test">
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Test Webhook</CardTitle>
              <CardDescription>Send a test event to this webhook endpoint</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm">
                This will send a test event to your webhook endpoint. The test event will contain a sample payload to
                help you verify that your endpoint is correctly configured.
              </p>
              <Button onClick={testWebhook} disabled={testLoading}>
                {testLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Testing...
                  </>
                ) : (
                  <>
                    <Play className="mr-2 h-4 w-4" />
                    Send Test Event
                  </>
                )}
              </Button>

              {testResult && (
                <div className="mt-4">
                  <h3 className="text-sm font-medium mb-2">Test Result</h3>
                  <div
                    className={`p-4 rounded-md ${
                      testResult.success ? "bg-green-50 text-green-800" : "bg-red-50 text-red-800"
                    }`}
                  >
                    <p className="font-medium">
                      {testResult.success ? "Success! Webhook delivered" : "Failed to deliver webhook"}
                    </p>
                    {testResult.statusCode && <p className="text-sm mt-1">Status code: {testResult.statusCode}</p>}
                    {testResult.error && <p className="text-sm mt-1">Error: {testResult.error}</p>}
                    {testResult.responseBody && (
                      <div className="mt-2">
                        <p className="text-sm font-medium">Response:</p>
                        <pre className="mt-1 p-2 bg-black bg-opacity-10 rounded text-xs overflow-x-auto">
                          {testResult.responseBody.substring(0, 500)}
                          {testResult.responseBody.length > 500 ? "..." : ""}
                        </pre>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
