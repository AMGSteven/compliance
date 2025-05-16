// Force dynamic rendering instead of static generation
export const dynamic = 'force-dynamic';

import { Suspense } from "react"
import { createServerClient } from "@/lib/supabase/server"
import { ScheduledBatchForm } from "@/components/batch/scheduled-batch-form"

async function NewScheduledBatchPage() {
  const supabase = createServerClient()
  const {
    data: { session },
  } = await supabase.auth.getSession()

  if (!session) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <p className="text-muted-foreground">Please sign in to create scheduled batches</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">Create Scheduled Batch</h1>
      <ScheduledBatchForm userId={session.user.id} />
    </div>
  )
}

export default function NewScheduledBatchPageWrapper() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <NewScheduledBatchPage />
    </Suspense>
  )
}
