import { Suspense } from "react"
import { notFound } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { createClient } from "@/lib/supabase/server"
import { ScheduledBatchesService } from "@/lib/services/scheduled-batches-service"
import { formatScheduleType } from "@/lib/utils/cron-utils"

export const dynamic = "force-dynamic"

async function ScheduledBatchDetail({ params }: { params: { id: string } }) {
  const supabase = createClient()
  const {
    data: { session },
  } = await supabase.auth.getSession()

  if (!session) {
    return notFound()
  }

  const scheduledBatchesService = new ScheduledBatchesService()
  const scheduledBatch = await scheduledBatchesService.getScheduledBatchById(params.id)

  if (!scheduledBatch) {
    return notFound()
  }

  const history = await scheduledBatchesService.getScheduledBatchHistory(params.id)

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold tracking-tight">{scheduledBatch.name}</h1>
        <Badge variant={scheduledBatch.status === "active" ? "default" : "secondary"}>
          {scheduledBatch.status === "active" ? "Active" : "Paused"}
        </Badge>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Schedule Details</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <dt className="text-sm font-medium text-muted-foreground">Type</dt>
              <dd className="text-lg">
                {scheduledBatch.type === "trustedform_verification" ? "TrustedForm Verification" : scheduledBatch.type}
              </dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-muted-foreground">Schedule</dt>
              <dd className="text-lg">{formatScheduleType(scheduledBatch.schedule, scheduledBatch.cron_expression)}</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-muted-foreground">Next Run</dt>
              <dd className="text-lg">{new Date(scheduledBatch.next_run).toLocaleString()}</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-muted-foreground">Last Run</dt>
              <dd className="text-lg">
                {scheduledBatch.last_run ? new Date(scheduledBatch.last_run).toLocaleString() : "Never"}
              </dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-muted-foreground">Created</dt>
              <dd className="text-lg">{new Date(scheduledBatch.created_at).toLocaleString()}</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-muted-foreground">Items</dt>
              <dd className="text-lg">{scheduledBatch.configuration.items.length} certificates</dd>
            </div>
          </dl>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Execution History</CardTitle>
          <CardDescription>History of scheduled batch executions</CardDescription>
        </CardHeader>
        <CardContent>
          {history.length === 0 ? (
            <div className="text-center py-6">
              <p className="text-muted-foreground">No execution history yet</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Run At</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Batch Operation</TableHead>
                  <TableHead>Error</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {history.map((entry) => (
                  <TableRow key={entry.id}>
                    <TableCell>{new Date(entry.run_at).toLocaleString()}</TableCell>
                    <TableCell>
                      <Badge variant={entry.status === "success" ? "success" : "destructive"}>{entry.status}</Badge>
                    </TableCell>
                    <TableCell>
                      {entry.batch_operation_id ? (
                        <Button variant="link" asChild>
                          <a href={`/trustedform/batch/${entry.batch_operation_id}`}>View Results</a>
                        </Button>
                      ) : (
                        "N/A"
                      )}
                    </TableCell>
                    <TableCell className="text-red-500">{entry.error_message || "-"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

export default function ScheduledBatchDetailPage({ params }: { params: { id: string } }) {
  return (
    <Suspense fallback={<div>Loading scheduled batch details...</div>}>
      <ScheduledBatchDetail params={params} />
    </Suspense>
  )
}
