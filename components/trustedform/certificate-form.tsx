"use client"

import type React from "react"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { TrustedFormService } from "@/lib/services/trustedform-service"
import { AlertCircle } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"

interface CertificateFormProps {
  onSuccess?: (data: any) => void
}

export function CertificateForm({ onSuccess }: CertificateFormProps) {
  const [formData, setFormData] = useState({
    certificateUrl: "",
    email: "",
    phone: "",
    source: "Manual Entry",
  })
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSubmitting(true)

    try {
      // Validate certificate URL
      if (!TrustedFormService.isValidCertificateUrl(formData.certificateUrl)) {
        throw new Error("Invalid TrustedForm certificate URL format")
      }

      // Validate contact data
      if (!formData.email && !formData.phone) {
        throw new Error("Either email or phone is required")
      }

      // Submit the form
      const response = await fetch("/api/v1/trustedform/capture", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          certificateUrl: formData.certificateUrl,
          contactData: {
            email: formData.email,
            phone: formData.phone,
          },
          source: formData.source,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || "Failed to capture certificate")
      }

      const data = await response.json()

      // Call onSuccess callback if provided
      if (onSuccess) {
        onSuccess(data)
      }

      // Reset form
      setFormData({
        certificateUrl: "",
        email: "",
        phone: "",
        source: "Manual Entry",
      })
    } catch (err) {
      console.error("Error capturing certificate:", err)
      setError((err as Error).message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Add TrustedForm Certificate</CardTitle>
        <CardDescription>Manually add a TrustedForm certificate to the system</CardDescription>
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

          <div className="space-y-2">
            <label htmlFor="certificateUrl" className="text-sm font-medium">
              TrustedForm Certificate URL
            </label>
            <Input
              id="certificateUrl"
              name="certificateUrl"
              value={formData.certificateUrl}
              onChange={handleChange}
              placeholder="https://cert.trustedform.com/..."
              required
            />
            <p className="text-xs text-muted-foreground">
              The URL should be in the format: https://cert.trustedform.com/[40-character-hash]
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <label htmlFor="email" className="text-sm font-medium">
                Email
              </label>
              <Input
                id="email"
                name="email"
                type="email"
                value={formData.email}
                onChange={handleChange}
                placeholder="user@example.com"
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="phone" className="text-sm font-medium">
                Phone
              </label>
              <Input
                id="phone"
                name="phone"
                type="tel"
                value={formData.phone}
                onChange={handleChange}
                placeholder="+15551234567"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label htmlFor="source" className="text-sm font-medium">
              Source
            </label>
            <select
              id="source"
              name="source"
              value={formData.source}
              onChange={handleChange}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
            >
              <option value="Manual Entry">Manual Entry</option>
              <option value="API">API</option>
              <option value="Form Submission">Form Submission</option>
              <option value="Batch Import">Batch Import</option>
            </select>
          </div>
        </CardContent>
        <CardFooter>
          <Button type="submit" disabled={submitting}>
            {submitting ? "Submitting..." : "Add Certificate"}
          </Button>
        </CardFooter>
      </form>
    </Card>
  )
}
