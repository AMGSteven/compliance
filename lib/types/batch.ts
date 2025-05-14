export type BatchOperation = {
  id: string
  type: string
  status: "pending" | "processing" | "completed" | "failed"
  total_items: number
  processed_items: number
  successful_items: number
  failed_items: number
  created_at: string
  updated_at: string
  completed_at?: string
  created_by: string
  metadata?: any
}

export type BatchOperationResult = {
  id: string
  batch_operation_id: string
  item_id: string
  success: boolean
  message: string
  data?: any
  created_at: string
}

export type ScheduledBatch = {
  id: string
  name: string
  type: string
  schedule: "daily" | "weekly" | "monthly" | "custom"
  cron_expression?: string
  next_run: string
  last_run?: string
  configuration: any
  status: "active" | "paused" | "completed"
  created_at: string
  updated_at: string
  created_by: string
}

export type BatchScheduleHistory = {
  id: string
  scheduled_batch_id: string
  batch_operation_id?: string
  status: "success" | "failed" | "skipped"
  run_at: string
  error_message?: string
}
