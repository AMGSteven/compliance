"use client"

import type React from "react"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { CheckCircle, AlertCircle, Loader2 } from "lucide-react"

interface PhoneCheckFormProps {
  onCheckComplete?: (result: any) => void
}

export function PhoneCheckForm({ onCheckComplete }: PhoneCheckFormProps) {
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
      const response = await fetch("/api/v1/tcpa/check", {
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
        <CardTitle>TCPA Compliance Check</CardTitle>
        <CardDescription>Check a phone number against the TCPA Litigator List to ensure compliance</CardDescription>
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
            <Alert variant={result.compliant ? "success" : "destructive"} className="mt-4">
              {result.compliant ? <CheckCircle className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
              <AlertTitle>{result.compliant ? "Compliant" : "Non-Compliant"}</AlertTitle>
              <AlertDescription>
                {result.compliant
                  ? "This phone number is not on any TCPA litigator lists."
                  : `This phone number is on the following lists: ${result.reasons.join(", ")}`}
              </AlertDescription>
            </Alert>
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
