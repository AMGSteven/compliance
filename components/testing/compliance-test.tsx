"use client"

import type React from "react"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { CheckCircle, AlertCircle, Loader2, Copy } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { sampleTestData, formatJson, formatPhoneNumber } from "@/lib/utils/test-utils"

export function ComplianceTest() {
  const [phone, setPhone] = useState("")
  const [contactName, setContactName] = useState("")
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)
  const [rawResponse, setRawResponse] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    await checkCompliance(phone, contactName)
  }

  const checkCompliance = async (phoneToCheck: string, name = "") => {
    setLoading(true)
    setResult(null)
    setError(null)
    setRawResponse(null)

    try {
      const response = await fetch("/api/v1/compliance/check", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          phone: phoneToCheck,
          contactName: name || undefined,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to check phone number")
      }

      setResult(data)
      setRawResponse(formatJson(data))
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

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Compliance Checker Test</CardTitle>
        <CardDescription>Test the multi-source compliance checker against phone numbers</CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="manual" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="manual">Manual Test</TabsTrigger>
            <TabsTrigger value="sample">Sample Data</TabsTrigger>
          </TabsList>

          <TabsContent value="manual" className="space-y-4">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="phone">Phone Number</Label>
                <Input
                  id="phone"
                  placeholder="Enter phone number to test"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="contactName">Contact Name (Optional)</Label>
                <Input
                  id="contactName"
                  placeholder="Enter contact name"
                  value={contactName}
                  onChange={(e) => setContactName(e.target.value)}
                />
              </div>
              <Button type="submit" disabled={loading || !phone}>
                {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                {loading ? "Checking..." : "Check Compliance"}
              </Button>
            </form>
          </TabsContent>

          <TabsContent value="sample" className="space-y-4">
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-medium mb-2">Known Test Numbers</h3>
                <div className="grid gap-2">
                  {sampleTestData.tcpaTestNumbers.map((item, index) => (
                    <div key={index} className="flex items-center justify-between p-2 border rounded-md">
                      <div>
                        <p className="font-medium">{formatPhoneNumber(item.phone)}</p>
                        <p className="text-sm text-muted-foreground">{item.description}</p>
                      </div>
                      <Button size="sm" onClick={() => checkCompliance(item.phone)} disabled={loading}>
                        Test
                      </Button>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <h3 className="text-sm font-medium mb-2">Random Test Numbers</h3>
                <div className="grid gap-2">
                  {sampleTestData.randomPhones.map((phone, index) => (
                    <div key={index} className="flex items-center justify-between p-2 border rounded-md">
                      <p className="font-medium">{formatPhoneNumber(phone)}</p>
                      <Button size="sm" onClick={() => checkCompliance(phone)} disabled={loading}>
                        Test
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </TabsContent>
        </Tabs>

        {result && (
          <div className="mt-6 space-y-4">
            <Alert
              variant={
                result.overallCompliant === true
                  ? "success"
                  : result.overallCompliant === false
                    ? "destructive"
                    : "default"
              }
              className="mt-4"
            >
              {result.overallCompliant === true ? (
                <CheckCircle className="h-4 w-4" />
              ) : (
                <AlertCircle className="h-4 w-4" />
              )}
              <AlertTitle>
                {result.overallCompliant === true
                  ? "Compliant"
                  : result.overallCompliant === false
                    ? "Non-Compliant"
                    : "Partial Results"}
              </AlertTitle>
              <AlertDescription>
                {result.overallCompliant === true
                  ? "This phone number passed all compliance checks."
                  : result.overallCompliant === false
                    ? `This phone number failed ${result.summary.failedChecks.length} compliance check(s).`
                    : "Some compliance checks encountered errors. Please review the detailed results."}
              </AlertDescription>
            </Alert>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">Detailed Results</h3>
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

              {result.checkResults.map((check: any, index: number) => (
                <Card key={index} className="overflow-hidden">
                  <CardHeader className="pb-2">
                    <div className="flex justify-between items-center">
                      <CardTitle className="text-base">{check.source}</CardTitle>
                      {check.compliant === true ? (
                        <Badge variant="success">PASS</Badge>
                      ) : check.compliant === false ? (
                        <Badge variant="destructive">FAIL</Badge>
                      ) : (
                        <Badge variant="outline">ERROR</Badge>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent className="pt-2">
                    {check.error ? (
                      <p className="text-destructive">{check.error}</p>
                    ) : check.compliant === false && check.reasons.length > 0 ? (
                      <div>
                        <p className="font-medium">Reasons:</p>
                        <ul className="list-disc pl-5 mt-1">
                          {check.reasons.map((reason: string, i: number) => (
                            <li key={i}>{reason}</li>
                          ))}
                        </ul>
                      </div>
                    ) : check.compliant === true ? (
                      <p>No compliance issues found.</p>
                    ) : (
                      <p>No detailed information available.</p>
                    )}
                  </CardContent>
                </Card>
              ))}
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
