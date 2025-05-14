"use client"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ArrowLeft, Layers } from "lucide-react"
import Link from "next/link"
import { BatchOperationsList } from "@/components/batch/batch-operations-list"

export default function BatchDashboardPage() {
  return (
    <div className="container mx-auto py-10">
      <div className="mb-6 flex items-center">
        <Button variant="outline" size="icon" className="mr-4" asChild>
          <Link href="/">
            <ArrowLeft className="h-4 w-4" />
            <span className="sr-only">Back</span>
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Batch Operations</h1>
          <p className="text-muted-foreground">Manage and monitor all batch operations</p>
        </div>
      </div>

      <div className="grid gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Batch Operations Overview</CardTitle>
            <CardDescription>Summary of all batch operations in the system</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-lg border p-4">
                <div className="flex items-center gap-2">
                  <Layers className="h-5 w-5 text-muted-foreground" />
                  <span className="text-sm font-medium">TrustedForm Verifications</span>
                </div>
                <div className="mt-2">
                  <Link href="/trustedform/batch" className="text-sm text-blue-600 hover:underline">
                    View TrustedForm batch operations
                  </Link>
                </div>
              </div>
              {/* Add more batch operation types here as they are implemented */}
            </div>
          </CardContent>
        </Card>

        <BatchOperationsList
          title="Recent Batch Operations"
          description="View and manage all batch operations across the system"
        />
      </div>
    </div>
  )
}
