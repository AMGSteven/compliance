import { createServerClient } from "@/lib/supabase/server"
import { generateId } from "@/lib/utils/api-key"

export type Webhook = {
  id: string
  name: string
  url: string
  events: string[]
  status: "active" | "inactive" | "failed"
  secret?: string
  created_at: string
  updated_at: string
  last_triggered?: string
  failure_count?: number
  headers?: Record<string, string>
  description?: string
  created_by?: string
}

export type WebhookEvent = {
  id: string
  webhook_id: string
  event_type: string
  payload: any
  status: "pending" | "success" | "failed"
  response_code?: number
  response_body?: string
  attempts: number
  created_at: string
  updated_at: string
  next_retry?: string
  error_message?: string
}

export class WebhooksRepository {
  async findAll(options: { orderBy?: string; orderDirection?: "asc" | "desc" } = {}) {
    const supabase = createServerClient()

    let query = supabase.from("webhooks").select("*")

    if (options.orderBy) {
      query = query.order(options.orderBy, { ascending: options.orderDirection === "asc" })
    } else {
      query = query.order("created_at", { ascending: false })
    }

    const { data, error } = await query

    if (error) {
      console.error("Error fetching webhooks:", error)
      throw error
    }

    return data as Webhook[]
  }

  async findById(id: string) {
    const supabase = createServerClient()
    const { data, error } = await supabase.from("webhooks").select("*").eq("id", id).single()

    if (error) {
      console.error(`Error fetching webhook with id ${id}:`, error)
      throw error
    }

    return data as Webhook
  }

  async create(webhook: Omit<Webhook, "id" | "created_at" | "updated_at">) {
    const supabase = createServerClient()
    const now = new Date().toISOString()

    const newWebhook = {
      id: generateId(),
      ...webhook,
      created_at: now,
      updated_at: now,
      secret: webhook.secret || generateId(),
    }

    const { data, error } = await supabase.from("webhooks").insert(newWebhook).select().single()

    if (error) {
      console.error("Error creating webhook:", error)
      throw error
    }

    return data as Webhook
  }

  async update(id: string, webhook: Partial<Webhook>) {
    const supabase = createServerClient()
    const now = new Date().toISOString()

    const { data, error } = await supabase
      .from("webhooks")
      .update({
        ...webhook,
        updated_at: now,
      })
      .eq("id", id)
      .select()
      .single()

    if (error) {
      console.error(`Error updating webhook with id ${id}:`, error)
      throw error
    }

    return data as Webhook
  }

  async delete(id: string) {
    const supabase = createServerClient()
    const { error } = await supabase.from("webhooks").delete().eq("id", id)

    if (error) {
      console.error(`Error deleting webhook with id ${id}:`, error)
      throw error
    }

    return true
  }

  async recordEvent(event: Omit<WebhookEvent, "id" | "created_at" | "updated_at" | "attempts">) {
    const supabase = createServerClient()
    const now = new Date().toISOString()

    const newEvent = {
      id: generateId(),
      ...event,
      attempts: 0,
      created_at: now,
      updated_at: now,
    }

    const { data, error } = await supabase.from("webhook_events").insert(newEvent).select().single()

    if (error) {
      console.error("Error recording webhook event:", error)
      throw error
    }

    return data as WebhookEvent
  }

  async updateEventStatus(id: string, status: WebhookEvent["status"], details: Partial<WebhookEvent> = {}) {
    const supabase = createServerClient()
    const now = new Date().toISOString()

    const { data, error } = await supabase
      .from("webhook_events")
      .update({
        status,
        ...details,
        updated_at: now,
      })
      .eq("id", id)
      .select()
      .single()

    if (error) {
      console.error(`Error updating webhook event with id ${id}:`, error)
      throw error
    }

    return data as WebhookEvent
  }

  async findPendingEvents(limit = 10) {
    const supabase = createServerClient()
    const now = new Date().toISOString()

    const { data, error } = await supabase
      .from("webhook_events")
      .select("*, webhooks(*)")
      .eq("status", "pending")
      .or(`next_retry.is.null,next_retry.lte.${now}`)
      .order("created_at", { ascending: true })
      .limit(limit)

    if (error) {
      console.error("Error fetching pending webhook events:", error)
      throw error
    }

    return data as (WebhookEvent & { webhooks: Webhook })[]
  }

  async findEventsByWebhookId(webhookId: string, limit = 50) {
    const supabase = createServerClient()

    const { data, error } = await supabase
      .from("webhook_events")
      .select("*")
      .eq("webhook_id", webhookId)
      .order("created_at", { ascending: false })
      .limit(limit)

    if (error) {
      console.error(`Error fetching events for webhook ${webhookId}:`, error)
      throw error
    }

    return data as WebhookEvent[]
  }
}
