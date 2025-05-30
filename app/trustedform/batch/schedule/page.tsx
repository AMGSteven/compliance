// Force dynamic rendering instead of static generation
export const dynamic = 'force-dynamic';

import { Suspense } from "react"
import { createServerClient } from "@/lib/supabase/server"
import { ScheduledBatchList } from "@/components/batch/scheduled-batch-list"
import { Button } from "@/components/ui/button"


async function ScheduledBatchesPage() {
  const supabase = createServerClient()
  const {
    data: { session },
  } = await supabase.auth.getSession()

  if (!session) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <p className="text-muted-foreground">Please sign in to view scheduled batches</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">Scheduled Batches</h1>
      <ScheduledBatchList userId={session.user.id} />
    </div>
  )
}

export default function ScheduledBatchesPageWrapper() {
  return (
    <Suspense fallback={<div>Loading scheduled batches...</div>}>
      <ScheduledBatchesPage />
    </Suspense>
  )
}
