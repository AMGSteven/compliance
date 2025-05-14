"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useToast } from "@/components/ui/use-toast"
import { formatScheduleType } from "@/lib/utils/cron-utils"
import type { ScheduledBatch } from "@/lib/types/batch"

type ScheduledBatchListProps = {
  userId: string
}

export function ScheduledBatchList({ userId }: ScheduledBatchListProps) {
  const router = useRouter()
  const { toast } = useToast()
  const [scheduledBatches, setScheduledBatches] = useState<ScheduledBatch[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const fetchScheduledBatches = async () => {
      try {
        const response = await fetch("/api/v1/batch/schedule")
        if (!response.ok) {
          throw new Error("Failed to fetch scheduled batches")
        }
        const data = await response.json()
        setScheduledBatches(data)
      } catch (error) {
        console.error("Error fetching scheduled batches:", error)
        toast({
          title: "Error",
          description: "Failed to fetch scheduled batches",
          variant: "destructive",
        })
      } finally {
        setIsLoading(false)
      }
    }

    fetchScheduledBatches()
  }, [toast])

  const handleStatusChange = async (id: string, newStatus: "active" | "paused") => {
    try {
      const response = await fetch(`/api/v1/batch/schedule/${id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ status: newStatus }),
      })

      if (!response.ok) {
        throw new Error("Failed to update scheduled batch status")
      }

      // Update the local state
      setScheduledBatches((prev) => prev.map((batch) => (batch.id === id ? { ...batch, status: newStatus } : batch)))

      toast({
        title: "Success",
        description: `Scheduled batch ${newStatus === "active" ? "activated" : "paused"} successfully`,
      })
    } catch (error) {
      console.error("Error updating scheduled batch status:", error)
      toast({
        title: "Error",
        description: "Failed to update scheduled batch status",
        variant: "destructive",
      })
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this scheduled batch?")) {
      return
    }

    try {
      const response = await fetch(`/api/v1/batch/schedule/${id}`, {
        method: "DELETE",
      })

      if (!response.ok) {
        throw new Error("Failed to delete scheduled batch")
      }

      // Remove from local state
      setScheduledBatches((prev) => prev.filter((batch) => batch.id !== id))

      toast({
        title: "Success",
        description: "Scheduled batch deleted successfully",
      })
    } catch (error) {
      console.error("Error deleting scheduled batch:", error)
      toast({
        title: "Error",
        description: "Failed to delete scheduled batch",
        variant: "destructive",
      })
    }
  }

  if (isLoading) {
    return <div>Loading scheduled batches...</div>
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Scheduled Batches</CardTitle>
          <CardDescription>Manage your scheduled batch operations</CardDescription>
        </div>
        <Button onClick={() => router.push("/trustedform/batch/schedule/new")}>Create New Schedule</Button>
      </CardHeader>
      <CardContent>
        {scheduledBatches.length === 0 ? (
          <div className="text-center py-6">
            <p className="text-muted-foreground">No scheduled batches found</p>
            <Button variant="outline" className="mt-4" onClick={() => router.push("/trustedform/batch/schedule/new")}>
              Create Your First Schedule
            </Button>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Schedule</TableHead>
                <TableHead>Next Run</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {scheduledBatches.map((batch) => (
                <TableRow key={batch.id}>
                  <TableCell className="font-medium">
                    <Link href={`/trustedform/batch/schedule/${batch.id}`} className="hover:underline">
                      {batch.name}
                    </Link>
                  </TableCell>
                  <TableCell>
                    {batch.type === "trustedform_verification" ? "TrustedForm Verification" : batch.type}
                  </TableCell>
                  <TableCell>{formatScheduleType(batch.schedule, batch.cron_expression)}</TableCell>
                  <TableCell>{new Date(batch.next_run).toLocaleString()}</TableCell>
                  <TableCell>
                    <Badge variant={batch.status === "active" ? "default" : "secondary"}>
                      {batch.status === "active" ? "Active" : "Paused"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right space-x-2">
                    {batch.status === "active" ? (
                      <Button variant="outline" size="sm" onClick={() => handleStatusChange(batch.id, "paused")}>
                        Pause
                      </Button>
                    ) : (
                      <Button variant="outline" size="sm" onClick={() => handleStatusChange(batch.id, "active")}>
                        Activate
                      </Button>
                    )}
                    <Button variant="destructive" size="sm" onClick={() => handleDelete(batch.id)}>
                      Delete
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  )
}
