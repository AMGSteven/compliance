"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ArrowLeft, Edit, Loader2, MoreHorizontal, Pause, Play, Plus, Trash2 } from "lucide-react"
import Link from "next/link"
import { Badge } from "@/components/ui/badge"
import { WebhookForm } from "@/components/webhooks/webhook-form"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useRouter } from "next/navigation"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"

interface Webhook {
  id: string
  name: string
  url: string
  events: string[]
  status: "active" | "inactive" | "failed"
  created_at: string
  last_triggered?: string
}

export default function WebhooksPage() {
  const router = useRouter()
  const [webhooks, setWebhooks] = useState<Webhook[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)

  const fetchWebhooks = async () => {
    try {
      setLoading(true)
      setError(null)
      const response = await fetch("/api/v1/webhooks")

      if (!response.ok) {
        throw new Error(`HTTP error ${response.status}`)
      }

      const data = await response.json()
      setWebhooks(data.webhooks || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load webhooks")
      console.error("Error fetching webhooks:", err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchWebhooks()
  }, [])

  const toggleWebhookStatus = async (id: string, currentStatus: string) => {
    try {
      const newStatus = currentStatus === "active" ? "inactive" : "active"
      const response = await fetch(`/api/v1/webhooks/${id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          status: newStatus,
          // We need to include these required fields
          name: webhooks.find((w) => w.id === id)?.name || "",
          url: webhooks.find((w) => w.id === id)?.url || "",
          events: webhooks.find((w) => w.id === id)?.events || [],
        }),
      })

      if (!response.ok) {
        throw new Error(`HTTP error ${response.status}`)
      }

      setWebhooks(webhooks.map((webhook) => (webhook.id === id ? { ...webhook, status: newStatus } : webhook)))
    } catch (err) {
      console.error("Error toggling webhook status:", err)
      alert("Failed to update webhook status")
    }
  }

  const deleteWebhook = async (id: string) => {
    if (confirm("Are you sure you want to delete this webhook? This action cannot be undone.")) {
      try {
        const response = await fetch(`/api/v1/webhooks/${id}`, {
          method: "DELETE",
        })

        if (!response.ok) {
          throw new Error(`HTTP error ${response.status}`)
        }

        setWebhooks(webhooks.filter((webhook) => webhook.id !== id))
      } catch (err) {
        console.error("Error deleting webhook:", err)
        alert("Failed to delete webhook")
      }
    }
  }

  const testWebhook = async (id: string) => {
    try {
      router.push(`/webhooks/${id}?tab=test`)
    } catch (err) {
      console.error("Error navigating to test page:", err)
    }
  }

  const handleFormSuccess = () => {
    setShowForm(false)
    fetchWebhooks()
  }

  if (showForm) {
    return (
      <div className="container mx-auto py-10">
        <div className="mb-6 flex items-center">
          <Button variant="outline" size="icon" className="mr-4" onClick={() => setShowForm(false)}>
            <ArrowLeft className="h-4 w-4" />
            <span className="sr-only">Back</span>
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Create Webhook</h1>
            <p className="text-muted-foreground">Set up a new webhook endpoint</p>
          </div>
        </div>
        <WebhookForm onSuccess={handleFormSuccess} />
      </div>
    )
  }

  return (
    <div className="container mx-auto py-10">
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center">
          <Button variant="outline" size="icon" className="mr-4" asChild>
            <Link href="/">
              <ArrowLeft className="h-4 w-4" />
              <span className="sr-only">Back</span>
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Webhooks</h1>
            <p className="text-muted-foreground">Manage webhook endpoints for real-time event notifications</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" onClick={() => setShowForm(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Add Webhook
          </Button>
        </div>
      </div>

      {error && (
        <Alert variant="destructive" className="mb-6">
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Webhooks</CardTitle>
          <CardDescription>A list of all webhook endpoints</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : webhooks.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <p className="mb-4 text-muted-foreground">No webhooks found</p>
              <Button onClick={() => setShowForm(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Add Webhook
              </Button>
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>URL</TableHead>
                    <TableHead>Events</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Last Triggered</TableHead>
                    <TableHead className="w-[100px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {webhooks.map((webhook) => (
                    <TableRow key={webhook.id}>
                      <TableCell className="font-medium">
                        <Link href={`/webhooks/${webhook.id}`} className="hover:underline">
                          {webhook.name}
                        </Link>
                      </TableCell>
                      <TableCell className="font-mono text-xs truncate max-w-[200px]">{webhook.url}</TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {webhook.events.slice(0, 3).map((event) => (
                            <Badge key={event} variant="outline" className="text-xs">
                              {event}
                            </Badge>
                          ))}
                          {webhook.events.length > 3 && (
                            <Badge variant="outline" className="text-xs">
                              +{webhook.events.length - 3} more
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            webhook.status === "active"
                              ? "default"
                              : webhook.status === "failed"
                                ? "destructive"
                                : "secondary"
                          }
                        >
                          {webhook.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {webhook.last_triggered ? new Date(webhook.last_triggered).toLocaleString() : "Never"}
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreHorizontal className="h-4 w-4" />
                              <span className="sr-only">Open menu</span>
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuLabel>Actions</DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => router.push(`/webhooks/${webhook.id}`)}>
                              <Edit className="mr-2 h-4 w-4" />
                              View Details
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => toggleWebhookStatus(webhook.id, webhook.status)}>
                              {webhook.status === "active" ? (
                                <>
                                  <Pause className="mr-2 h-4 w-4" />
                                  Deactivate
                                </>
                              ) : (
                                <>
                                  <Play className="mr-2 h-4 w-4" />
                                  Activate
                                </>
                              )}
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => testWebhook(webhook.id)}>Test Webhook</DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem className="text-destructive" onClick={() => deleteWebhook(webhook.id)}>
                              <Trash2 className="mr-2 h-4 w-4" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
