import { BaseRepository } from "./base-repository"
import { normalizeEmail, normalizePhone, normalizePostal } from "@/lib/utils"
import type { Contact } from "@/lib/types"

export class ContactsRepository extends BaseRepository<Contact> {
  constructor() {
    super("contacts")
  }

  async findByEmail(email: string): Promise<Contact | null> {
    try {
      const normalizedEmail = normalizeEmail(email)
      const { data, error } = await this.supabase
        .from(this.tableName)
        .select("*")
        .eq("email", normalizedEmail)
        .maybeSingle()

      if (error) throw error
      return data as Contact
    } catch (error) {
      console.error("Error finding contact by email:", error)
      return null
    }
  }

  async findByPhone(phone: string): Promise<Contact | null> {
    try {
      const normalizedPhone = normalizePhone(phone)
      const { data, error } = await this.supabase
        .from(this.tableName)
        .select("*")
        .eq("phone", normalizedPhone)
        .maybeSingle()

      if (error) throw error
      return data as Contact
    } catch (error) {
      console.error("Error finding contact by phone:", error)
      return null
    }
  }

  async findByPostal(postal: string): Promise<Contact | null> {
    try {
      const normalizedPostal = normalizePostal(postal)
      const { data, error } = await this.supabase
        .from(this.tableName)
        .select("*")
        .eq("postal", normalizedPostal)
        .maybeSingle()

      if (error) throw error
      return data as Contact
    } catch (error) {
      console.error("Error finding contact by postal:", error)
      return null
    }
  }

  async findOrCreate(contactData: Partial<Contact>): Promise<Contact> {
    try {
      // Normalize data
      if (contactData.email) {
        contactData.email = normalizeEmail(contactData.email)
      }
      if (contactData.phone) {
        contactData.phone = normalizePhone(contactData.phone)
      }
      if (contactData.postal) {
        contactData.postal = normalizePostal(contactData.postal)
      }

      // Try to find existing contact
      let contact: Contact | null = null

      if (contactData.email) {
        contact = await this.findByEmail(contactData.email)
      }

      if (!contact && contactData.phone) {
        contact = await this.findByPhone(contactData.phone)
      }

      if (!contact && contactData.postal) {
        contact = await this.findByPostal(contactData.postal)
      }

      // If contact exists, update with any new information
      if (contact) {
        const updateData: Partial<Contact> = {}
        let needsUpdate = false

        // Only update fields that are provided and different
        Object.entries(contactData).forEach(([key, value]) => {
          if (value && value !== contact![key as keyof Contact]) {
            updateData[key as keyof Contact] = value
            needsUpdate = true
          }
        })

        if (needsUpdate) {
          const updated = await this.update(contact.id, updateData)
          return updated || contact
        }

        return contact
      }

      // Create new contact if not found
      return await this.create({
        ...contactData,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
    } catch (error) {
      console.error("Error in findOrCreate contact:", error)
      throw error
    }
  }
}
