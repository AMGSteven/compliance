"use client"

import type React from "react"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { useToast } from "@/components/ui/use-toast"
import { calculateNextRunDate } from "@/lib/utils/cron-utils"

type ScheduledBatchFormProps = {
  userId: string
}

export function ScheduledBatchForm({ userId }: ScheduledBatchFormProps) {
  const router = useRouter()
  const { toast } = useToast()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [formData, setFormData] = useState({
    name: "",
    type: "trustedform_verification",
    schedule: "daily",
    cronExpression: "",
    certificateIds: "",
  })

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  const handleSelectChange = (name: string, value: string) => {
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)

    try {
      // Parse certificate IDs
      const certificateIds = formData.certificateIds
        .split("\n")
        .map((line) => line.trim())
        .filter((line) => line.length > 0)
        .map((line) => {
          const parts = line.split(",")
          return {
            certificateId: parts[0].trim(),
            leadId: parts.length > 1 ? parts[1].trim() : undefined,
          }
        })

      if (certificateIds.length === 0) {
        toast({
          title: "Error",
          description: "Please enter at least one certificate ID",
          variant: "destructive",
        })
        setIsSubmitting(false)
        return
      }

      // Calculate next run date
      const nextRun = calculateNextRunDate(formData.schedule, formData.cronExpression)

      // Create scheduled batch
      const response = await fetch("/api/v1/batch/schedule", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: formData.name,
          type: formData.type,
          schedule: formData.schedule,
          cronExpression: formData.schedule === "custom" ? formData.cronExpression : undefined,
          nextRun: nextRun.toISOString(),
          configuration: {
            items: certificateIds,
            metadata: {
              source: "scheduled_batch",
            },
          },
          createdBy: userId,
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.message || "Failed to create scheduled batch")
      }

      const data = await response.json()

      toast({
        title: "Success",
        description: "Scheduled batch created successfully",
      })

      // Redirect to scheduled batch list
      router.push("/trustedform/batch/schedule")
      router.refresh()
    } catch (error) {
      console.error("Error creating scheduled batch:", error)
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to create scheduled batch",
        variant: "destructive",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Create Scheduled Batch</CardTitle>
        <CardDescription>Schedule a batch operation to run automatically at specified intervals</CardDescription>
      </CardHeader>
      <form onSubmit={handleSubmit}>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              name="name"
              placeholder="Weekly TrustedForm Verification"
              value={formData.name}
              onChange={handleChange}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="type">Type</Label>
            <Select value={formData.type} onValueChange={(value) => handleSelectChange("type", value)}>
              <SelectTrigger>
                <SelectValue placeholder="Select batch type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="trustedform_verification">TrustedForm Verification</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="schedule">Schedule</Label>
            <Select value={formData.schedule} onValueChange={(value) => handleSelectChange("schedule", value)}>
              <SelectTrigger>
                <SelectValue placeholder="Select schedule" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="daily">Daily</SelectItem>
                <SelectItem value="weekly">Weekly</SelectItem>
                <SelectItem value="monthly">Monthly</SelectItem>
                <SelectItem value="custom">Custom</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {formData.schedule === "custom" && (
            <div className="space-y-2">
              <Label htmlFor="cronExpression">Cron Expression</Label>
              <Input
                id="cronExpression"
                name="cronExpression"
                placeholder="0 0 * * *"
                value={formData.cronExpression}
                onChange={handleChange}
                required={formData.schedule === "custom"}
              />
              <p className="text-sm text-muted-foreground">
                Enter a cron expression (e.g., "0 0 * * *" for daily at midnight)
              </p>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="certificateIds">Certificate IDs</Label>
            <Textarea
              id="certificateIds"
              name="certificateIds"
              placeholder="certificate-id-1
certificate-id-2,lead-id-2
certificate-id-3"
              value={formData.certificateIds}
              onChange={handleChange}
              rows={5}
              required
            />
            <p className="text-sm text-muted-foreground">
              Enter one certificate ID per line. Optionally, you can include a lead ID by adding a comma after the
              certificate ID.
            </p>
          </div>
        </CardContent>
        <CardFooter className="flex justify-between">
          <Button type="button" variant="outline" onClick={() => router.push("/trustedform/batch/schedule")}>
            Cancel
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Creating..." : "Create Scheduled Batch"}
          </Button>
        </CardFooter>
      </form>
    </Card>
  )
}
