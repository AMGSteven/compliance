"use client"

import type React from "react"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { AlertCircle, Loader2 } from "lucide-react"

export function BatchCheckForm() {
  const router = useRouter()
  const [phones, setPhones] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      // Parse phone numbers
      const phoneList = phones
        .split("\n")
        .map((line) => line.trim())
        .filter((line) => line.length > 0)
        .map((line) => {
          const parts = line.split(",")
          if (parts.length > 1) {
            return {
              phone: parts[0].trim(),
              name: parts[1].trim(),
            }
          }
          return { phone: line }
        })

      if (phoneList.length === 0) {
        throw new Error("Please enter at least one phone number")
      }

      const response = await fetch("/api/v1/tcpa/batch", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          phones: phoneList,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || "Failed to create batch check")
      }

      const data = await response.json()
      router.push(`/tcpa/batch/${data.batchId}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : "An unknown error occurred")
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Batch TCPA Compliance Check</CardTitle>
        <CardDescription>Check multiple phone numbers against the TCPA Litigator List at once</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="phones">
              Phone Numbers (one per line, optionally followed by a comma and contact name)
            </Label>
            <Textarea
              id="phones"
              placeholder="Enter phone numbers, one per line
Example:
5551234567
5557654321, John Doe"
              value={phones}
              onChange={(e) => setPhones(e.target.value)}
              rows={10}
              required
            />
            <p className="text-sm text-muted-foreground">
              You can include contact names by adding a comma after the phone number.
            </p>
          </div>

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
        <Button type="submit" onClick={handleSubmit} disabled={loading || !phones.trim()}>
          {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          {loading ? "Processing..." : "Check Phone Numbers"}
        </Button>
      </CardFooter>
    </Card>
  )
}
