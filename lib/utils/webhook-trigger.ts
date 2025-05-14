/**
 * Utility function to trigger a webhook event
 */
export async function triggerWebhook(eventType: string, payload: any) {
  try {
    // Make a request to the webhook API
    const response = await fetch("/api/v1/webhooks/trigger", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        eventType,
        payload,
      }),
    })

    if (!response.ok) {
      throw new Error(`HTTP error ${response.status}`)
    }

    return await response.json()
  } catch (error) {
    console.error(`Error triggering webhook for event ${eventType}:`, error)
    // Don't throw, just log the error
    return { success: false, error: error instanceof Error ? error.message : String(error) }
  }
}
