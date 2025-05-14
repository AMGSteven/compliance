"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { AlertCircle, Loader2 } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { useRouter } from "next/navigation"

// Define available event types
const availableEvents = [
  { id: "email.optout", label: "Email Opt-Out" },
  { id: "sms.optout", label: "SMS Opt-Out" },
  { id: "phone.optout", label: "Phone Opt-Out" },
  { id: "postal.optout", label: "Postal Opt-Out" },
  { id: "lead.validated", label: "Lead Validated" },
  { id: "lead.rejected", label: "Lead Rejected" },
  { id: "compliance.warning", label: "Compliance Warning" },
  { id: "compliance.failure", label: "Compliance Failure" },
  { id: "trustedform.verified", label: "TrustedForm Verified" },
  { id: "trustedform.failed", label: "TrustedForm Failed" },
  { id: "batch.completed", label: "Batch Operation Completed" },
]

interface WebhookFormProps {
  webhookId?: string
  onSuccess?: () => void
}

export function WebhookForm({ webhookId, onSuccess }: WebhookFormProps) {
  const router = useRouter()
  const [name, setName] = useState("")
  const [url, setUrl] = useState("")
  const [description, setDescription] = useState("")
  const [selectedEvents, setSelectedEvents] = useState<string[]>([])
  const [generateSecret, setGenerateSecret] = useState(true)
  const [secret, setSecret] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isEditing, setIsEditing] = useState(false)
  const [initialLoading, setInitialLoading] = useState(!!webhookId)

  useEffect(() => {
    if (webhookId) {
      setIsEditing(true)
      fetchWebhook()
    }
  }, [webhookId])

  const fetchWebhook = async () => {
    try {
      setInitialLoading(true)
      const response = await fetch(`/api/v1/webhooks/${webhookId}`)

      if (!response.ok) {
        throw new Error(`HTTP error ${response.status}`)
      }

      const data = await response.json()
      const webhook = data.webhook

      setName(webhook.name || "")
      setUrl(webhook.url || "")
      setDescription(webhook.description || "")
      setSelectedEvents(webhook.events || [])
      setSecret(webhook.secret || "")
      setGenerateSecret(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load webhook")
      console.error("Error fetching webhook:", err)
    } finally {
      setInitialLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!name.trim()) {
      setError("Webhook name is required")
      return
    }

    if (!url.trim()) {
      setError("Endpoint URL is required")
      return
    }

    try {
      new URL(url)
    } catch (err) {
      setError("Invalid URL format")
      return
    }

    if (selectedEvents.length === 0) {
      setError("At least one event must be selected")
      return
    }

    setLoading(true)
    setError(null)

    try {
      const payload = {
        name,
        url,
        events: selectedEvents,
        description: description || undefined,
        generateSecret,
        secret: !generateSecret ? secret : undefined,
      }

      const response = await fetch(isEditing ? `/api/v1/webhooks/${webhookId}` : "/api/v1/webhooks", {
        method: isEditing ? "PUT" : "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || `HTTP error ${response.status}`)
      }

      const data = await response.json()

      if (onSuccess) {
        onSuccess()
      } else {
        router.push(`/webhooks/${data.webhook.id}`)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save webhook")
      console.error("Error saving webhook:", err)
    } finally {
      setLoading(false)
    }
  }

  const toggleEvent = (eventId: string) => {
    setSelectedEvents((prev) => (prev.includes(eventId) ? prev.filter((id) => id !== eventId) : [...prev, eventId]))
  }

  if (initialLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Loading Webhook</CardTitle>
          <CardDescription>Please wait while we load the webhook details</CardDescription>
        </CardHeader>
        <CardContent className="flex justify-center py-8">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{isEditing ? "Edit Webhook" : "Create Webhook"}</CardTitle>
        <CardDescription>
          {isEditing
            ? "Update your webhook configuration"
            : "Create a new webhook endpoint to receive event notifications"}
        </CardDescription>
      </CardHeader>
      <form onSubmit={handleSubmit}>
        <CardContent className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="name">Webhook Name</Label>
              <Input
                id="name"
                placeholder="Webhook name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="url">Endpoint URL</Label>
              <Input
                id="url"
                placeholder="https://example.com/webhook"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description (Optional)</Label>
            <Textarea
              id="description"
              placeholder="Describe the purpose of this webhook"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
            />
          </div>

          <div className="space-y-2">
            <Label>Events to Subscribe</Label>
            <div className="grid gap-2 sm:grid-cols-2 md:grid-cols-3">
              {availableEvents.map((event) => (
                <div key={event.id} className="flex items-center space-x-2">
                  <Checkbox
                    id={`event-${event.id}`}
                    checked={selectedEvents.includes(event.id)}
                    onCheckedChange={() => toggleEvent(event.id)}
                  />
                  <Label htmlFor={`event-${event.id}`} className="text-sm">
                    {event.label}
                  </Label>
                </div>
              ))}
            </div>
          </div>

          {!isEditing && (
            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="generate-secret"
                  checked={generateSecret}
                  onCheckedChange={(checked) => setGenerateSecret(checked as boolean)}
                />
                <Label htmlFor="generate-secret" className="text-sm">
                  Generate a secret key for signing webhook payloads
                </Label>
              </div>

              {!generateSecret && (
                <div className="pt-2">
                  <Label htmlFor="secret">Webhook Secret</Label>
                  <Input
                    id="secret"
                    placeholder="Enter a secret key"
                    value={secret}
                    onChange={(e) => setSecret(e.target.value)}
                  />
                  <p className="mt-1 text-xs text-muted-foreground">
                    This secret will be used to sign webhook payloads so you can verify they came from us.
                  </p>
                </div>
              )}
            </div>
          )}
        </CardContent>
        <CardFooter className="flex justify-between">
          <Button variant="outline" type="button" onClick={() => router.push("/webhooks")}>
            Cancel
          </Button>
          <Button type="submit" disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {isEditing ? "Updating..." : "Creating..."}
              </>
            ) : (
              <>{isEditing ? "Update Webhook" : "Create Webhook"}</>
            )}
          </Button>
        </CardFooter>
      </form>
    </Card>
  )
}
