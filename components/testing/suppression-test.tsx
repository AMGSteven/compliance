"use client"

import type React from "react"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { CheckCircle, AlertCircle, Loader2, Copy, Plus } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { sampleTestData, formatJson, formatPhoneNumber } from "@/lib/utils/test-utils"

export function SuppressionTest() {
  const [email, setEmail] = useState("")
  const [phone, setPhone] = useState("")
  const [postal, setPostal] = useState("")
  const [channel, setChannel] = useState("all")
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)
  const [rawResponse, setRawResponse] = useState<string | null>(null)

  // For opt-out creation
  const [optOutIdentifier, setOptOutIdentifier] = useState("")
  const [optOutType, setOptOutType] = useState("email")
  const [optOutChannel, setOptOutChannel] = useState("email")
  const [optOutSource, setOptOutSource] = useState("testing")
  const [optOutCreating, setOptOutCreating] = useState(false)
  const [optOutResult, setOptOutResult] = useState<any>(null)
  const [optOutError, setOptOutError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    await checkSuppression(email, phone, postal, channel)
  }

  const checkSuppression = async (emailToCheck = "", phoneToCheck = "", postalToCheck = "", channelToCheck = "all") => {
    setLoading(true)
    setResult(null)
    setError(null)
    setRawResponse(null)

    try {
      const payload: any = {
        channel: channelToCheck,
      }

      if (emailToCheck) payload.email = emailToCheck
      if (phoneToCheck) payload.phone = phoneToCheck
      if (postalToCheck) payload.postal = postalToCheck

      const response = await fetch("/api/v1/check-suppression", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to check suppression")
      }

      setResult(data)
      setRawResponse(formatJson(data))
    } catch (err) {
      setError(err instanceof Error ? err.message : "An unknown error occurred")
    } finally {
      setLoading(false)
    }
  }

  const createOptOut = async (e: React.FormEvent) => {
    e.preventDefault()
    setOptOutCreating(true)
    setOptOutResult(null)
    setOptOutError(null)

    try {
      const response = await fetch("/api/v1/opt-out", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          identifier: optOutIdentifier,
          identifierType: optOutType,
          channel: optOutChannel,
          source: optOutSource,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to create opt-out")
      }

      setOptOutResult(data)

      // Auto-fill the suppression check form with the newly opted-out identifier
      if (optOutType === "email") setEmail(optOutIdentifier)
      if (optOutType === "phone") setPhone(optOutIdentifier)
      if (optOutType === "postal") setPostal(optOutIdentifier)
      setChannel(optOutChannel)
    } catch (err) {
      setOptOutError(err instanceof Error ? err.message : "An unknown error occurred")
    } finally {
      setOptOutCreating(false)
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

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Suppression Check Test</CardTitle>
        <CardDescription>Test the suppression check system with different identifiers</CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="check" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="check">Check Suppression</TabsTrigger>
            <TabsTrigger value="create">Create Opt-Out</TabsTrigger>
            <TabsTrigger value="sample">Sample Data</TabsTrigger>
          </TabsList>

          <TabsContent value="check" className="space-y-4">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email (Optional)</Label>
                <Input
                  id="email"
                  placeholder="Enter email to check"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Phone (Optional)</Label>
                <Input
                  id="phone"
                  placeholder="Enter phone to check"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="postal">Postal (Optional)</Label>
                <Input
                  id="postal"
                  placeholder="Enter postal code to check"
                  value={postal}
                  onChange={(e) => setPostal(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="channel">Channel</Label>
                <select
                  id="channel"
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
                  value={channel}
                  onChange={(e) => setChannel(e.target.value)}
                >
                  <option value="all">All Channels</option>
                  <option value="email">Email</option>
                  <option value="phone">Phone</option>
                  <option value="sms">SMS</option>
                  <option value="postal">Postal</option>
                </select>
              </div>
              <Button type="submit" disabled={loading || (!email && !phone && !postal)}>
                {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                {loading ? "Checking..." : "Check Suppression"}
              </Button>
            </form>
          </TabsContent>

          <TabsContent value="create" className="space-y-4">
            <form onSubmit={createOptOut} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="optOutIdentifier">Identifier</Label>
                <Input
                  id="optOutIdentifier"
                  placeholder="Enter email, phone, or postal code"
                  value={optOutIdentifier}
                  onChange={(e) => setOptOutIdentifier(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="optOutType">Identifier Type</Label>
                <select
                  id="optOutType"
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
                  value={optOutType}
                  onChange={(e) => setOptOutType(e.target.value)}
                >
                  <option value="email">Email</option>
                  <option value="phone">Phone</option>
                  <option value="postal">Postal</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="optOutChannel">Channel</Label>
                <select
                  id="optOutChannel"
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
                  value={optOutChannel}
                  onChange={(e) => setOptOutChannel(e.target.value)}
                >
                  <option value="all">All Channels</option>
                  <option value="email">Email</option>
                  <option value="phone">Phone</option>
                  <option value="sms">SMS</option>
                  <option value="postal">Postal</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="optOutSource">Source</Label>
                <Input
                  id="optOutSource"
                  placeholder="Enter opt-out source"
                  value={optOutSource}
                  onChange={(e) => setOptOutSource(e.target.value)}
                  required
                />
              </div>
              <Button type="submit" disabled={optOutCreating || !optOutIdentifier}>
                {optOutCreating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                {optOutCreating ? "Creating..." : "Create Opt-Out"}
              </Button>

              {optOutResult && (
                <Alert variant="success" className="mt-4">
                  <CheckCircle className="h-4 w-4" />
                  <AlertTitle>Success</AlertTitle>
                  <AlertDescription>{optOutResult.message}</AlertDescription>
                </Alert>
              )}

              {optOutError && (
                <Alert variant="destructive" className="mt-4">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>Error</AlertTitle>
                  <AlertDescription>{optOutError}</AlertDescription>
                </Alert>
              )}
            </form>
          </TabsContent>

          <TabsContent value="sample" className="space-y-4">
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-medium mb-2">Sample Emails</h3>
                <div className="grid gap-2">
                  {sampleTestData.randomEmails.map((email, index) => (
                    <div key={index} className="flex items-center justify-between p-2 border rounded-md">
                      <p className="font-medium">{email}</p>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setOptOutIdentifier(email)
                            setOptOutType("email")
                            setOptOutChannel("email")
                          }}
                        >
                          <Plus className="h-4 w-4 mr-1" />
                          Opt-Out
                        </Button>
                        <Button size="sm" onClick={() => checkSuppression(email, "", "", "email")} disabled={loading}>
                          Check
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <h3 className="text-sm font-medium mb-2">Sample Phone Numbers</h3>
                <div className="grid gap-2">
                  {sampleTestData.randomPhones.map((phone, index) => (
                    <div key={index} className="flex items-center justify-between p-2 border rounded-md">
                      <p className="font-medium">{formatPhoneNumber(phone)}</p>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setOptOutIdentifier(phone)
                            setOptOutType("phone")
                            setOptOutChannel("phone")
                          }}
                        >
                          <Plus className="h-4 w-4 mr-1" />
                          Opt-Out
                        </Button>
                        <Button size="sm" onClick={() => checkSuppression("", phone, "", "phone")} disabled={loading}>
                          Check
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </TabsContent>
        </Tabs>

        {result && (
          <div className="mt-6 space-y-4">
            <Alert variant={result.suppressed === true ? "destructive" : "success"} className="mt-4">
              {result.suppressed === true ? <AlertCircle className="h-4 w-4" /> : <CheckCircle className="h-4 w-4" />}
              <AlertTitle>{result.suppressed === true ? "Suppressed" : "Not Suppressed"}</AlertTitle>
              <AlertDescription>
                {result.suppressed === true
                  ? "This contact is suppressed and should not be contacted."
                  : "This contact is not suppressed and can be contacted."}
              </AlertDescription>
            </Alert>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">Suppression Details</h3>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => copyToClipboard(rawResponse || "")}
                  disabled={!rawResponse}
                >
                  <Copy className="h-4 w-4 mr-2" />
                  Copy Raw JSON
                </Button>
              </div>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Suppression Status</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {result.details.email !== undefined && (
                      <div className="flex items-center justify-between">
                        <span>Email:</span>
                        {result.details.email ? (
                          <Badge variant="destructive">Suppressed</Badge>
                        ) : (
                          <Badge variant="success">Not Suppressed</Badge>
                        )}
                      </div>
                    )}

                    {result.details.phone !== undefined && (
                      <div className="flex items-center justify-between">
                        <span>Phone:</span>
                        {result.details.phone ? (
                          <Badge variant="destructive">Suppressed</Badge>
                        ) : (
                          <Badge variant="success">Not Suppressed</Badge>
                        )}
                      </div>
                    )}

                    {result.details.postal !== undefined && (
                      <div className="flex items-center justify-between">
                        <span>Postal:</span>
                        {result.details.postal ? (
                          <Badge variant="destructive">Suppressed</Badge>
                        ) : (
                          <Badge variant="success">Not Suppressed</Badge>
                        )}
                      </div>
                    )}

                    <div className="flex items-center justify-between">
                      <span>Request ID:</span>
                      <span className="text-sm font-mono">{result.requestId}</span>
                    </div>

                    <div className="flex items-center justify-between">
                      <span>Timestamp:</span>
                      <span className="text-sm">{new Date(result.timestamp).toLocaleString()}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {rawResponse && (
              <div className="mt-4">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-lg font-semibold">Raw Response</h3>
                  <Button variant="outline" size="sm" onClick={() => copyToClipboard(rawResponse)}>
                    <Copy className="h-4 w-4 mr-2" />
                    Copy
                  </Button>
                </div>
                <pre className="bg-muted p-4 rounded-md overflow-auto text-xs max-h-96">{rawResponse}</pre>
              </div>
            )}
          </div>
        )}

        {error && (
          <Alert variant="destructive" className="mt-4">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  )
}
