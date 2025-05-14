"use client"

import { Badge } from "@/components/ui/badge"

import type React from "react"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { AlertCircle, Loader2, Copy, Play } from "lucide-react"
import { formatJson } from "@/lib/utils/test-utils"

export function ApiTest() {
  const [url, setUrl] = useState("/api/v1/compliance/check")
  const [method, setMethod] = useState("POST")
  const [body, setBody] = useState(JSON.stringify({ phone: "2012510414" }, null, 2))
  const [headers, setHeaders] = useState(JSON.stringify({ "Content-Type": "application/json" }, null, 2))
  const [loading, setLoading] = useState(false)
  const [response, setResponse] = useState<any>(null)
  const [responseHeaders, setResponseHeaders] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)
  const [statusCode, setStatusCode] = useState<number | null>(null)
  const [responseTime, setResponseTime] = useState<number | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setResponse(null)
    setResponseHeaders(null)
    setError(null)
    setStatusCode(null)
    setResponseTime(null)

    try {
      let parsedHeaders = {}
      try {
        parsedHeaders = JSON.parse(headers)
      } catch (err) {
        throw new Error("Invalid headers JSON")
      }

      let parsedBody = undefined
      if (method !== "GET" && body.trim()) {
        try {
          parsedBody = JSON.parse(body)
        } catch (err) {
          throw new Error("Invalid body JSON")
        }
      }

      const startTime = performance.now()

      const response = await fetch(url, {
        method,
        headers: parsedHeaders,
        body: method !== "GET" ? JSON.stringify(parsedBody) : undefined,
      })

      const endTime = performance.now()
      setResponseTime(Math.round(endTime - startTime))

      setStatusCode(response.status)

      // Get response headers
      const headersObj: Record<string, string> = {}
      response.headers.forEach((value, key) => {
        headersObj[key] = value
      })
      setResponseHeaders(headersObj)

      // Get response body
      const contentType = response.headers.get("content-type")
      if (contentType && contentType.includes("application/json")) {
        const data = await response.json()
        setResponse(formatJson(data))
      } else {
        const text = await response.text()
        setResponse(text)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "An unknown error occurred")
    } finally {
      setLoading(false)
    }
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard
      .writeText(text)
      .then(() => {
        alert("Copied to clipboard!")
      })
      .catch((err) => {
        console.error("Failed to copy: ", err)
      })
  }

  const apiExamples = [
    {
      name: "Check Compliance",
      url: "/api/v1/compliance/check",
      method: "POST",
      body: { phone: "2012510414" },
      headers: { "Content-Type": "application/json" },
    },
    {
      name: "Check Suppression",
      url: "/api/v1/check-suppression",
      method: "POST",
      body: { email: "test@example.com" },
      headers: { "Content-Type": "application/json" },
    },
    {
      name: "Get Dashboard Stats",
      url: "/api/v1/dashboard-stats",
      method: "GET",
      body: {},
      headers: { "Content-Type": "application/json" },
    },
  ]

  const loadExample = (example: any) => {
    setUrl(example.url)
    setMethod(example.method)
    setBody(JSON.stringify(example.body, null, 2))
    setHeaders(JSON.stringify(example.headers, null, 2))
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>API Test Tool</CardTitle>
        <CardDescription>Test API endpoints directly</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="flex flex-wrap gap-4 mb-4">
            {apiExamples.map((example, index) => (
              <Button key={index} type="button" variant="outline" size="sm" onClick={() => loadExample(example)}>
                {example.name}
              </Button>
            ))}
          </div>

          <div className="flex gap-4">
            <div className="w-1/4">
              <Label htmlFor="method">Method</Label>
              <select
                id="method"
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
                value={method}
                onChange={(e) => setMethod(e.target.value)}
              >
                <option value="GET">GET</option>
                <option value="POST">POST</option>
                <option value="PUT">PUT</option>
                <option value="DELETE">DELETE</option>
              </select>
            </div>
            <div className="flex-1">
              <Label htmlFor="url">URL</Label>
              <Input
                id="url"
                placeholder="Enter API URL"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                required
              />
            </div>
          </div>

          <div>
            <Label htmlFor="headers">Headers (JSON)</Label>
            <Textarea
              id="headers"
              placeholder="Enter request headers as JSON"
              value={headers}
              onChange={(e) => setHeaders(e.target.value)}
              className="font-mono text-xs h-24"
            />
          </div>

          {method !== "GET" && (
            <div>
              <Label htmlFor="body">Body (JSON)</Label>
              <Textarea
                id="body"
                placeholder="Enter request body as JSON"
                value={body}
                onChange={(e) => setBody(e.target.value)}
                className="font-mono text-xs h-40"
              />
            </div>
          )}

          <Button type="submit" disabled={loading}>
            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Play className="mr-2 h-4 w-4" />}
            {loading ? "Sending..." : "Send Request"}
          </Button>
        </form>

        {(response || error) && (
          <div className="mt-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">Response</h3>
              {statusCode !== null && (
                <div className="flex items-center gap-2">
                  <Badge
                    variant={statusCode >= 200 && statusCode < 300 ? "success" : "destructive"}
                    className="px-2 py-1"
                  >
                    {statusCode}
                  </Badge>
                  {responseTime !== null && <span className="text-sm text-muted-foreground">{responseTime}ms</span>}
                </div>
              )}
            </div>

            {responseHeaders && Object.keys(responseHeaders).length > 0 && (
              <div>
                <h4 className="text-sm font-medium mb-2">Headers</h4>
                <pre className="bg-muted p-2 rounded-md overflow-auto text-xs max-h-40">
                  {formatJson(responseHeaders)}
                </pre>
              </div>
            )}

            {response && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-sm font-medium">Body</h4>
                  <Button variant="outline" size="sm" onClick={() => copyToClipboard(response)}>
                    <Copy className="h-4 w-4 mr-2" />
                    Copy
                  </Button>
                </div>
                <pre className="bg-muted p-4 rounded-md overflow-auto text-xs max-h-96">{response}</pre>
              </div>
            )}

            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Error</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
