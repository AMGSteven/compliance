import { WebhooksRepository, type Webhook } from "@/lib/repositories/webhooks-repository"
import crypto from "crypto"

export class WebhookService {
  private webhooksRepo: WebhooksRepository

  constructor() {
    this.webhooksRepo = new WebhooksRepository()
  }

  /**
   * Get all webhooks
   */
  async getAllWebhooks() {
    try {
      return await this.webhooksRepo.findAll()
    } catch (error) {
      console.error("Error getting webhooks:", error)
      throw error
    }
  }

  /**
   * Get webhook by ID
   */
  async getWebhookById(id: string) {
    try {
      return await this.webhooksRepo.findById(id)
    } catch (error) {
      console.error(`Error getting webhook with id ${id}:`, error)
      throw error
    }
  }

  /**
   * Create a new webhook
   */
  async createWebhook(webhook: Omit<Webhook, "id" | "created_at" | "updated_at">) {
    try {
      return await this.webhooksRepo.create(webhook)
    } catch (error) {
      console.error("Error creating webhook:", error)
      throw error
    }
  }

  /**
   * Update webhook
   */
  async updateWebhook(id: string, webhook: Partial<Webhook>) {
    try {
      return await this.webhooksRepo.update(id, webhook)
    } catch (error) {
      console.error(`Error updating webhook with id ${id}:`, error)
      throw error
    }
  }

  /**
   * Delete webhook
   */
  async deleteWebhook(id: string) {
    try {
      return await this.webhooksRepo.delete(id)
    } catch (error) {
      console.error(`Error deleting webhook with id ${id}:`, error)
      throw error
    }
  }

  /**
   * Trigger webhook for an event
   */
  async triggerWebhook(eventType: string, payload: any) {
    try {
      // Find all active webhooks that subscribe to this event
      const webhooks = await this.webhooksRepo.findAll()
      const relevantWebhooks = webhooks.filter(
        (webhook) => webhook.status === "active" && webhook.events.includes(eventType),
      )

      // Create webhook events for each relevant webhook
      const events = await Promise.all(
        relevantWebhooks.map((webhook) =>
          this.webhooksRepo.recordEvent({
            webhook_id: webhook.id,
            event_type: eventType,
            payload,
            status: "pending",
          }),
        ),
      )

      // Return the created events
      return events
    } catch (error) {
      console.error(`Error triggering webhook for event ${eventType}:`, error)
      throw error
    }
  }

  /**
   * Process pending webhook events
   */
  async processPendingEvents(limit = 10) {
    try {
      const pendingEvents = await this.webhooksRepo.findPendingEvents(limit)

      // Process each event
      const results = await Promise.all(
        pendingEvents.map(async (event) => {
          try {
            const webhook = event.webhooks

            // Skip if webhook is not active
            if (webhook.status !== "active") {
              await this.webhooksRepo.updateEventStatus(event.id, "failed", {
                error_message: "Webhook is not active",
              })
              return { success: false, event, error: "Webhook is not active" }
            }

            // Prepare the payload
            const timestamp = new Date().toISOString()
            const payload = {
              id: event.id,
              timestamp,
              event_type: event.event_type,
              data: event.payload,
            }

            // Generate signature if secret exists
            let signature
            if (webhook.secret) {
              const hmac = crypto.createHmac("sha256", webhook.secret)
              hmac.update(JSON.stringify(payload))
              signature = hmac.digest("hex")
            }

            // Prepare headers
            const headers: Record<string, string> = {
              "Content-Type": "application/json",
              "User-Agent": "Suppression-Engine-Webhook/1.0",
              "X-Webhook-ID": webhook.id,
              "X-Event-ID": event.id,
              "X-Event-Type": event.event_type,
              "X-Timestamp": timestamp,
            }

            if (signature) {
              headers["X-Signature"] = signature
            }

            if (webhook.headers) {
              Object.assign(headers, webhook.headers)
            }

            // Send the webhook
            const response = await fetch(webhook.url, {
              method: "POST",
              headers,
              body: JSON.stringify(payload),
            })

            // Update event status based on response
            if (response.ok) {
              const responseBody = await response.text()
              await this.webhooksRepo.updateEventStatus(event.id, "success", {
                response_code: response.status,
                response_body: responseBody,
                attempts: event.attempts + 1,
              })

              // Update webhook last triggered time
              await this.webhooksRepo.update(webhook.id, {
                last_triggered: timestamp,
                failure_count: 0,
              })

              return { success: true, event, response }
            } else {
              const responseBody = await response.text()
              const nextRetry = new Date()
              nextRetry.setMinutes(nextRetry.getMinutes() + Math.min(30, Math.pow(2, event.attempts)))

              await this.webhooksRepo.updateEventStatus(event.id, "failed", {
                response_code: response.status,
                response_body: responseBody,
                attempts: event.attempts + 1,
                next_retry: nextRetry.toISOString(),
                error_message: `HTTP ${response.status}: ${responseBody.substring(0, 100)}`,
              })

              // Update webhook failure count
              await this.webhooksRepo.update(webhook.id, {
                failure_count: (webhook.failure_count || 0) + 1,
                status: (webhook.failure_count || 0) >= 5 ? "failed" : "active",
              })

              return { success: false, event, error: `HTTP ${response.status}`, response }
            }
          } catch (error) {
            console.error(`Error processing webhook event ${event.id}:`, error)

            const nextRetry = new Date()
            nextRetry.setMinutes(nextRetry.getMinutes() + Math.min(30, Math.pow(2, event.attempts)))

            await this.webhooksRepo.updateEventStatus(event.id, "failed", {
              attempts: event.attempts + 1,
              next_retry: nextRetry.toISOString(),
              error_message: error instanceof Error ? error.message : String(error),
            })

            return { success: false, event, error }
          }
        }),
      )

      return results
    } catch (error) {
      console.error("Error processing pending webhook events:", error)
      throw error
    }
  }

  /**
   * Get webhook events by webhook ID
   */
  async getWebhookEvents(webhookId: string, limit = 50) {
    try {
      return await this.webhooksRepo.findEventsByWebhookId(webhookId, limit)
    } catch (error) {
      console.error(`Error getting events for webhook ${webhookId}:`, error)
      throw error
    }
  }

  /**
   * Test webhook
   */
  async testWebhook(webhookId: string) {
    try {
      const webhook = await this.webhooksRepo.findById(webhookId)

      // Create a test event
      const testEvent = await this.webhooksRepo.recordEvent({
        webhook_id: webhookId,
        event_type: "test.event",
        payload: {
          message: "This is a test event",
          timestamp: new Date().toISOString(),
        },
        status: "pending",
      })

      // Process the test event immediately
      const timestamp = new Date().toISOString()
      const payload = {
        id: testEvent.id,
        timestamp,
        event_type: testEvent.event_type,
        data: testEvent.payload,
      }

      // Generate signature if secret exists
      let signature
      if (webhook.secret) {
        const hmac = crypto.createHmac("sha256", webhook.secret)
        hmac.update(JSON.stringify(payload))
        signature = hmac.digest("hex")
      }

      // Prepare headers
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        "User-Agent": "Suppression-Engine-Webhook/1.0",
        "X-Webhook-ID": webhook.id,
        "X-Event-ID": testEvent.id,
        "X-Event-Type": testEvent.event_type,
        "X-Timestamp": timestamp,
        "X-Test": "true",
      }

      if (signature) {
        headers["X-Signature"] = signature
      }

      if (webhook.headers) {
        Object.assign(headers, webhook.headers)
      }

      try {
        // Send the webhook
        const response = await fetch(webhook.url, {
          method: "POST",
          headers,
          body: JSON.stringify(payload),
        })

        // Update event status based on response
        if (response.ok) {
          const responseBody = await response.text()
          await this.webhooksRepo.updateEventStatus(testEvent.id, "success", {
            response_code: response.status,
            response_body: responseBody,
            attempts: 1,
          })

          return {
            success: true,
            statusCode: response.status,
            responseBody: responseBody,
            event: testEvent,
          }
        } else {
          const responseBody = await response.text()
          await this.webhooksRepo.updateEventStatus(testEvent.id, "failed", {
            response_code: response.status,
            response_body: responseBody,
            attempts: 1,
            error_message: `HTTP ${response.status}: ${responseBody.substring(0, 100)}`,
          })

          return {
            success: false,
            statusCode: response.status,
            responseBody: responseBody,
            event: testEvent,
          }
        }
      } catch (error) {
        console.error(`Error testing webhook ${webhookId}:`, error)

        await this.webhooksRepo.updateEventStatus(testEvent.id, "failed", {
          attempts: 1,
          error_message: error instanceof Error ? error.message : String(error),
        })

        return {
          success: false,
          error: error instanceof Error ? error.message : String(error),
          event: testEvent,
        }
      }
    } catch (error) {
      console.error(`Error testing webhook ${webhookId}:`, error)
      throw error
    }
  }
}
