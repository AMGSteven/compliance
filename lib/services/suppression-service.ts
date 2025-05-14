import { ContactsRepository } from "@/lib/repositories/contacts-repository"
import { OptOutsRepository } from "@/lib/repositories/opt-outs-repository"
import { normalizeEmail, normalizePhone, normalizePostal } from "@/lib/utils"
import type { SuppressionCheckRequest, SuppressionCheckResponse, OptOutRequest } from "@/lib/types"

// Import the webhook trigger utility
import { triggerWebhook } from "@/lib/utils/webhook-trigger"

export class SuppressionService {
  private contactsRepo: ContactsRepository
  private optOutsRepo: OptOutsRepository

  constructor() {
    this.contactsRepo = new ContactsRepository()
    this.optOutsRepo = new OptOutsRepository()
  }

  /**
   * Check if a contact is suppressed
   */
  async checkSuppression(request: SuppressionCheckRequest): Promise<SuppressionCheckResponse> {
    const result: SuppressionCheckResponse = {
      suppressed: false,
      details: {},
      timestamp: new Date().toISOString(),
      requestId: crypto.randomUUID(),
    }

    try {
      // Check email suppression if provided
      if (request.email && (request.channel === "all" || request.channel === "email")) {
        const normalizedEmail = normalizeEmail(request.email)
        const contact = await this.contactsRepo.findByEmail(normalizedEmail)

        if (contact) {
          // Check if this contact has opted out of email
          const optOuts = await this.optOutsRepo.findActiveByContactId(contact.id)
          const isOptedOut = optOuts.some((optOut) => optOut.channel === "email" || optOut.channel === "all")

          result.details.email = isOptedOut
          if (isOptedOut) result.suppressed = true
        }
      }

      // Check phone suppression if provided
      if (request.phone && (request.channel === "all" || request.channel === "phone" || request.channel === "sms")) {
        const normalizedPhone = normalizePhone(request.phone)
        const contact = await this.contactsRepo.findByPhone(normalizedPhone)

        if (contact) {
          // Check if this contact has opted out of phone/sms
          const optOuts = await this.optOutsRepo.findActiveByContactId(contact.id)
          const channelToCheck = request.channel === "sms" ? "sms" : "phone"

          const isOptedOut = optOuts.some((optOut) => optOut.channel === channelToCheck || optOut.channel === "all")

          result.details.phone = isOptedOut
          if (isOptedOut) result.suppressed = true
        }
      }

      // Check postal suppression if provided
      if (request.postal && (request.channel === "all" || request.channel === "postal")) {
        const normalizedPostal = normalizePostal(request.postal)
        const contact = await this.contactsRepo.findByPostal(normalizedPostal)

        if (contact) {
          // Check if this contact has opted out of postal
          const optOuts = await this.optOutsRepo.findActiveByContactId(contact.id)
          const isOptedOut = optOuts.some((optOut) => optOut.channel === "postal" || optOut.channel === "all")

          result.details.postal = isOptedOut
          if (isOptedOut) result.suppressed = true
        }
      }
    } catch (error) {
      console.error("Error in checkSuppression:", error)
      // Don't throw, just return the default result
    }

    return result
  }

  /**
   * Record an opt-out
   */
  async optOut(optOutRequest: OptOutRequest): Promise<{ success: boolean; message: string; optOutId?: string }> {
    try {
      // Normalize the identifier based on type
      let normalizedIdentifier: string
      switch (optOutRequest.identifierType) {
        case "email":
          normalizedIdentifier = normalizeEmail(optOutRequest.identifier)
          break
        case "phone":
          normalizedIdentifier = normalizePhone(optOutRequest.identifier)
          break
        case "postal":
          normalizedIdentifier = normalizePostal(optOutRequest.identifier)
          break
        default:
          throw new Error("Invalid identifier type")
      }

      // Find or create contact
      const contact = await this.contactsRepo.findOrCreate({
        [optOutRequest.identifierType]: normalizedIdentifier,
      })

      // Check if opt-out already exists
      const existingOptOut = await this.optOutsRepo.findByContactAndChannel(contact.id, optOutRequest.channel)

      if (existingOptOut) {
        // Update existing opt-out if needed
        if (existingOptOut.expiration_date) {
          await this.optOutsRepo.update(existingOptOut.id, {
            expiration_date: null,
            opt_out_date: new Date().toISOString(),
            source: optOutRequest.source,
            reason: optOutRequest.reason || existingOptOut.reason,
            metadata: optOutRequest.metadata || existingOptOut.metadata,
          })
        }

        return {
          success: true,
          message: `${optOutRequest.identifier} is already opted out from ${optOutRequest.channel} communications`,
          optOutId: existingOptOut.id,
        }
      }

      // Create new opt-out
      const optOut = await this.optOutsRepo.create({
        contact_id: contact.id,
        channel: optOutRequest.channel,
        source: optOutRequest.source,
        reason: optOutRequest.reason || null,
        opt_out_date: new Date().toISOString(),
        metadata: optOutRequest.metadata || null,
      })

      // Trigger webhook for opt-out event
      await triggerWebhook(`${optOutRequest.channel}.optout`, {
        identifier: optOutRequest.identifier,
        identifierType: optOutRequest.identifierType,
        channel: optOutRequest.channel,
        source: optOutRequest.source,
        reason: optOutRequest.reason,
        timestamp: new Date().toISOString(),
        optOutId: optOut.id,
      })

      return {
        success: true,
        message: `Successfully opted out ${optOutRequest.identifier} from ${optOutRequest.channel} communications`,
        optOutId: optOut.id,
      }
    } catch (error) {
      console.error("Error processing opt-out:", error)
      throw error
    }
  }

  /**
   * Get dashboard statistics
   */
  async getDashboardStats() {
    try {
      // Try to get real data from the database
      try {
        const totalContacts = await this.contactsRepo.count()
        const totalOptOuts = await this.optOutsRepo.count()
        const channelCounts = await this.optOutsRepo.countByChannel()
        const recentOptOuts = await this.optOutsRepo.findRecentWithContacts(10)

        // Calculate compliance rate (mock for now)
        const complianceRate = 99.8

        return {
          totalContacts,
          totalOptOuts,
          emailOptOuts: channelCounts.email,
          phoneOptOuts: channelCounts.phone,
          smsOptOuts: channelCounts.sms,
          postalOptOuts: channelCounts.postal,
          complianceRate,
          recentOptOuts,
        }
      } catch (dbError) {
        console.error("Database error in getDashboardStats:", dbError)
        // Fall back to mock data
        throw new Error("Database error: " + (dbError instanceof Error ? dbError.message : String(dbError)))
      }
    } catch (error) {
      console.error("Error getting dashboard stats:", error)
      // Return mock data for development/preview
      return {
        totalContacts: 1250,
        totalOptOuts: 87,
        emailOptOuts: 45,
        phoneOptOuts: 22,
        smsOptOuts: 15,
        postalOptOuts: 5,
        complianceRate: 99.2,
        recentOptOuts: [],
      }
    }
  }
}
