"use client"

import type React from "react"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { CheckCircle, AlertCircle, Loader2 } from "lucide-react"
import { Badge } from "@/components/ui/badge"

interface ComplianceCheckFormProps {
  onCheckComplete?: (result: any) => void
}

export function ComplianceCheckForm({ onCheckComplete }: ComplianceCheckFormProps) {
  const [phone, setPhone] = useState("")
  const [contactName, setContactName] = useState("")
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setResult(null)
    setError(null)

    try {
      const response = await fetch("/api/v1/compliance/check", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          phone,
          contactName: contactName || undefined,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || "Failed to check phone number")
      }

      const data = await response.json()
      setResult(data)
      if (onCheckComplete) {
        onCheckComplete(data)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "An unknown error occurred")
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Multi-Source Compliance Check</CardTitle>
        <CardDescription>Check a phone number against multiple compliance databases</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="phone">Phone Number</Label>
            <Input
              id="phone"
              placeholder="Enter phone number"
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
                <h3 className="text-lg font-semibold">Detailed Results</h3>
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
            </div>
          )}

          {error && (
            <Alert variant="destructive" className="mt-4">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
        </form>
      </CardContent>
      <CardFooter>
        <Button type="submit" onClick={handleSubmit} disabled={loading || !phone}>
          {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          {loading ? "Checking..." : "Check Phone Number"}
        </Button>
      </CardFooter>
    </Card>
  )
}
