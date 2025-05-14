"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Loader2, RefreshCw } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"

export function WebhookProcessor() {
  const [processing, setProcessing] = useState(false)
  const [lastProcessed, setLastProcessed] = useState<Date | null>(null)
  const [result, setResult] = useState<{
    processed: number
    successful: number
    failed: number
  } | null>(null)
  const [error, setError] = useState<string | null>(null)

  const processWebhooks = async () => {
    try {
      setProcessing(true)
      setError(null)

      const response = await fetch("/api/v1/webhooks/process", {
        method: "POST",
      })

      if (!response.ok) {
        throw new Error(`HTTP error ${response.status}`)
      }

      const data = await response.json()
      setResult(data)
      setLastProcessed(new Date())
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to process webhooks")
      console.error("Error processing webhooks:", err)
    } finally {
      setProcessing(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Webhook Processor</CardTitle>
        <CardDescription>Process pending webhook events</CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-sm mb-4">
          Manually trigger the webhook processor to send any pending webhook events to their destinations.
        </p>

        {error && (
          <Alert variant="destructive" className="mb-4">
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {result && (
          <div className="mb-4 p-4 bg-muted rounded-md">
            <h3 className="text-sm font-medium mb-2">Last Processing Result</h3>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <p className="text-xs text-muted-foreground">Processed</p>
                <p className="text-2xl font-bold">{result.processed}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Successful</p>
                <p className="text-2xl font-bold text-green-600">{result.successful}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Failed</p>
                <p className="text-2xl font-bold text-red-600">{result.failed}</p>
              </div>
            </div>
          </div>
        )}

        {lastProcessed && (
          <p className="text-xs text-muted-foreground mb-4">Last processed: {lastProcessed.toLocaleString()}</p>
        )}
      </CardContent>
      <CardFooter>
        <Button onClick={processWebhooks} disabled={processing}>
          {processing ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Processing...
            </>
          ) : (
            <>
              <RefreshCw className="mr-2 h-4 w-4" />
              Process Webhooks
            </>
          )}
        </Button>
      </CardFooter>
    </Card>
  )
}
