"use client"

import type React from "react"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { FileUpload } from "@/components/batch/file-upload"
import { AlertCircle, Loader2 } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { useRouter } from "next/navigation"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

interface BatchVerificationFormProps {
  onSuccess?: (batchId: string) => void
}

export function BatchVerificationForm({ onSuccess }: BatchVerificationFormProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [manualItems, setManualItems] = useState<string[]>([])
  const [currentItem, setCurrentItem] = useState("")
  const [vendor, setVendor] = useState("")
  const [referenceId, setReferenceId] = useState("")
  const [uploadedData, setUploadedData] = useState<any[] | null>(null)

  const handleAddItem = () => {
    if (!currentItem.trim()) return
    setManualItems([...manualItems, currentItem.trim()])
    setCurrentItem("")
  }

  const handleRemoveItem = (index: number) => {
    setManualItems(manualItems.filter((_, i) => i !== index))
  }

  const handleFileUpload = (data: any[]) => {
    setUploadedData(data)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      let items: any[] = []

      if (uploadedData) {
        // Process uploaded data
        items = uploadedData.map((item) => {
          return {
            certificateUrl: item.certificateUrl || item.certificate_url,
            certificateId: item.certificateId || item.certificate_id,
            leadData: {
              email: item.email,
              phone: item.phone,
              firstName: item.firstName || item.first_name,
              lastName: item.lastName || item.last_name,
            },
          }
        })
      } else {
        // Process manually entered items
        items = manualItems.map((item) => {
          return {
            certificateUrl: item,
            leadData: {},
          }
        })
      }

      if (items.length === 0) {
        throw new Error("No items to process")
      }

      const response = await fetch("/api/v1/trustedform/batch-verify", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          items,
          vendor,
          referenceId,
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || `HTTP error ${response.status}`)
      }

      const data = await response.json()

      if (onSuccess) {
        onSuccess(data.batchId)
      } else {
        router.push(`/trustedform/batch/${data.batchId}`)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create batch verification")
      console.error("Error creating batch verification:", err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Batch TrustedForm Verification</CardTitle>
        <CardDescription>Verify multiple TrustedForm certificates at once</CardDescription>
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

          <Tabs defaultValue="upload" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="upload">Upload File</TabsTrigger>
              <TabsTrigger value="manual">Manual Entry</TabsTrigger>
            </TabsList>
            <TabsContent value="upload" className="pt-4">
              <FileUpload
                onUpload={handleFileUpload}
                title="Upload Certificate Data"
                description="Upload a CSV or JSON file containing TrustedForm certificate URLs and lead data"
                requiredColumns={["certificateUrl"]}
                onError={setError}
              />

              {uploadedData && (
                <div className="mt-4">
                  <p className="text-sm font-medium">
                    {uploadedData.length} {uploadedData.length === 1 ? "item" : "items"} loaded
                  </p>
                </div>
              )}
            </TabsContent>
            <TabsContent value="manual" className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label htmlFor="certificate-url">Certificate URL</Label>
                <div className="flex space-x-2">
                  <Input
                    id="certificate-url"
                    placeholder="https://cert.trustedform.com/..."
                    value={currentItem}
                    onChange={(e) => setCurrentItem(e.target.value)}
                  />
                  <Button type="button" onClick={handleAddItem}>
                    Add
                  </Button>
                </div>
              </div>

              {manualItems.length > 0 && (
                <div className="rounded-md border">
                  <div className="p-4">
                    <h3 className="text-sm font-medium">Certificate URLs ({manualItems.length})</h3>
                    <ul className="mt-2 space-y-2">
                      {manualItems.map((item, index) => (
                        <li key={index} className="flex items-center justify-between">
                          <span className="text-sm font-mono truncate">{item}</span>
                          <Button type="button" variant="ghost" size="sm" onClick={() => handleRemoveItem(index)}>
                            Remove
                          </Button>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}
            </TabsContent>
          </Tabs>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="vendor">Vendor (Optional)</Label>
              <Input id="vendor" placeholder="Vendor name" value={vendor} onChange={(e) => setVendor(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="reference-id">Reference ID (Optional)</Label>
              <Input
                id="reference-id"
                placeholder="Your reference ID"
                value={referenceId}
                onChange={(e) => setReferenceId(e.target.value)}
              />
            </div>
          </div>
        </CardContent>
        <CardFooter>
          <Button type="submit" disabled={loading || (manualItems.length === 0 && !uploadedData)} className="w-full">
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Creating Batch...
              </>
            ) : (
              "Create Batch Verification"
            )}
          </Button>
        </CardFooter>
      </form>
    </Card>
  )
}
