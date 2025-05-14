import { BaseRepository } from "./base-repository"
import type { OptOut } from "@/lib/types"

export class OptOutsRepository extends BaseRepository<OptOut> {
  constructor() {
    super("opt_outs")
  }

  async findByContactAndChannel(contactId: string, channel: string): Promise<OptOut | null> {
    try {
      const { data, error } = await this.supabase
        .from(this.tableName)
        .select("*")
        .eq("contact_id", contactId)
        .eq("channel", channel)
        .maybeSingle()

      if (error) throw error
      return data as OptOut
    } catch (error) {
      console.error("Error finding opt-out by contact and channel:", error)
      return null
    }
  }

  async findActiveByContactId(contactId: string): Promise<OptOut[]> {
    try {
      const { data, error } = await this.supabase
        .from(this.tableName)
        .select("*")
        .eq("contact_id", contactId)
        .is("expiration_date", null)
        .order("opt_out_date", { ascending: false })

      if (error) throw error
      return data as OptOut[]
    } catch (error) {
      console.error("Error finding active opt-outs by contact ID:", error)
      return []
    }
  }

  async findRecentWithContacts(limit = 10): Promise<any[]> {
    try {
      const { data, error } = await this.supabase
        .from(this.tableName)
        .select(`
          *,
          contact:contact_id (
            id, email, phone, postal, first_name, last_name
          )
        `)
        .order("opt_out_date", { ascending: false })
        .limit(limit)

      if (error) throw error
      return data
    } catch (error) {
      console.error("Error finding recent opt-outs with contacts:", error)
      return []
    }
  }

  async findWithPagination({
    limit = 10,
    offset = 0,
    search = "",
  }: { limit: number; offset: number; search?: string }) {
    try {
      let query = this.supabase
        .from(this.tableName)
        .select(
          `
          *,
          contact:contact_id (
            id, email, phone, postal, first_name, last_name
          )
        `,
          { count: "exact" },
        )
        .order("opt_out_date", { ascending: false })

      // Add search filter if provided
      if (search) {
        query = query.or(`
          contact.email.ilike.%${search}%,
          contact.phone.ilike.%${search}%,
          contact.postal.ilike.%${search}%,
          source.ilike.%${search}%
        `)
      }

      // Add pagination
      query = query.range(offset, offset + limit - 1)

      const { data, error, count } = await query

      if (error) throw error

      return {
        data: data || [],
        total: count || 0,
      }
    } catch (error) {
      console.error("Error finding opt-outs with pagination:", error)
      throw error
    }
  }

  async countByChannel(): Promise<Record<string, number>> {
    try {
      const channels = ["email", "phone", "sms", "postal", "all"]
      const counts: Record<string, number> = {}

      for (const channel of channels) {
        const { count, error } = await this.supabase
          .from(this.tableName)
          .select("*", { count: "exact", head: true })
          .eq("channel", channel)

        if (error) throw error
        counts[channel] = count || 0
      }

      return counts
    } catch (error) {
      console.error("Error counting opt-outs by channel:", error)
      return { email: 0, phone: 0, sms: 0, postal: 0, all: 0 }
    }
  }
}
