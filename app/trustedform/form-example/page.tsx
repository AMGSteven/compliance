

"use client"

// Force dynamic rendering instead of static generation
export const dynamic = 'force-dynamic';
import type React from "react"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { ArrowLeft } from "lucide-react"
import Link from "next/link"
import Script from "next/script"

export default function TrustedFormExamplePage() {
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    consent: false,
  })
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target
    setFormData({
      ...formData,
      [name]: type === "checkbox" ? checked : value,
    })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    setResult(null)

    try {
      // Get the TrustedForm certificate URL from the hidden field
      const certificateUrlInput = document.querySelector('input[name="xxTrustedFormCertUrl"]') as HTMLInputElement
      const certificateUrl = certificateUrlInput?.value

      if (!certificateUrl) {
        throw new Error("TrustedForm certificate URL not found")
      }

      // Submit the form data along with the certificate URL
      const response = await fetch("/api/v1/trustedform/capture", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          certificateUrl,
          contactData: {
            firstName: formData.firstName,
            lastName: formData.lastName,
            email: formData.email,
            phone: formData.phone,
          },
          source: "Example Form",
          formName: "TrustedForm Example",
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || "Failed to submit form")
      }

      const data = await response.json()
      setResult(data)

      // Clear form
      setFormData({
        firstName: "",
        lastName: "",
        email: "",
        phone: "",
        consent: false,
      })
    } catch (err) {
      console.error("Error submitting form:", err)
      setError((err as Error).message || "An error occurred while submitting the form")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="container mx-auto py-10">
      <div className="flex items-center mb-6">
        <Button variant="outline" size="icon" className="mr-4" asChild>
          <Link href="/trustedform">
            <ArrowLeft className="h-4 w-4" />
            <span className="sr-only">Back</span>
          </Link>
        </Button>
        <h1 className="text-2xl font-bold">TrustedForm Example</h1>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Lead Capture Form</CardTitle>
            <CardDescription>Example form with TrustedForm integration</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* TrustedForm hidden fields */}
              <input type="hidden" name="xxTrustedFormCertUrl" value="" />
              <input type="hidden" name="xxTrustedFormToken" value="" />

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="firstName">First Name</Label>
                  <Input id="firstName" name="firstName" value={formData.firstName} onChange={handleChange} required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lastName">Last Name</Label>
                  <Input id="lastName" name="lastName" value={formData.lastName} onChange={handleChange} required />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" name="email" type="email" value={formData.email} onChange={handleChange} required />
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone">Phone</Label>
                <Input id="phone" name="phone" type="tel" value={formData.phone} onChange={handleChange} required />
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="consent"
                  name="consent"
                  checked={formData.consent}
                  onCheckedChange={(checked) => setFormData({ ...formData, consent: checked as boolean })}
                  required
                />
                <Label htmlFor="consent" className="text-sm">
                  I consent to receive calls and text messages at the phone number provided above. I understand these
                  calls may be generated using an automated technology.
                </Label>
              </div>

              <Button type="submit" className="w-full" disabled={submitting}>
                {submitting ? "Submitting..." : "Submit"}
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Form Submission Result</CardTitle>
            <CardDescription>This shows the result of the form submission with TrustedForm</CardDescription>
          </CardHeader>
          <CardContent>
            {error ? (
              <div className="p-4 bg-red-50 text-red-800 rounded-md">
                <h3 className="font-medium mb-2">Error</h3>
                <p>{error}</p>
              </div>
            ) : result ? (
              <div className="p-4 bg-green-50 text-green-800 rounded-md">
                <h3 className="font-medium mb-2">Success</h3>
                <p>{result.message}</p>
                <p className="mt-2">
                  Certificate ID: <span className="font-mono text-xs">{result.certificateId}</span>
                </p>
                <p>Status: {result.status}</p>
              </div>
            ) : (
              <div className="p-4 bg-gray-50 text-gray-800 rounded-md">
                <h3 className="font-medium mb-2">Instructions</h3>
                <ol className="list-decimal list-inside space-y-2">
                  <li>Fill out the form with your information</li>
                  <li>Check the consent checkbox</li>
                  <li>Submit the form</li>
                  <li>The TrustedForm certificate will be captured and stored</li>
                  <li>You can view the certificate in the TrustedForm dashboard</li>
                </ol>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* TrustedForm script */}
      <Script
        id="trustedform-script"
        strategy="afterInteractive"
        src="https://certificates.trustedform.com/js/certv4.js"
      />
    </main>
  )
}
