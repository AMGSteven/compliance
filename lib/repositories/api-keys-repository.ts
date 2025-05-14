import { BaseRepository } from "./base-repository"
import { generateApiKey } from "@/lib/utils/api-key"

interface ApiKey {
  id: string
  name: string
  key: string
  status: "active" | "inactive" | "revoked"
  created_at: string
  last_used_at?: string
  expires_at?: string
  created_by?: string
  permissions: {
    read: boolean
    write: boolean
  }
  allowed_origins?: string[]
}

export class ApiKeysRepository extends BaseRepository<ApiKey> {
  constructor() {
    super("api_keys")
  }

  async findByKey(key: string): Promise<ApiKey | null> {
    try {
      const { data, error } = await this.supabase.from(this.tableName).select("*").eq("key", key).maybeSingle()

      if (error) throw error
      return data as ApiKey
    } catch (error) {
      console.error("Error finding API key:", error)
      return null
    }
  }

  async createApiKey(
    name: string,
    options: {
      permissions?: { read: boolean; write: boolean }
      allowedOrigins?: string[]
      expiresAt?: string
      createdBy?: string
    } = {},
  ): Promise<ApiKey> {
    try {
      const apiKey = generateApiKey()

      const newKey: Partial<ApiKey> = {
        name,
        key: apiKey,
        status: "active",
        created_at: new Date().toISOString(),
        permissions: options.permissions || { read: true, write: false },
        allowed_origins: options.allowedOrigins,
        expires_at: options.expiresAt,
        created_by: options.createdBy,
      }

      return await this.create(newKey)
    } catch (error) {
      console.error("Error creating API key:", error)
      throw error
    }
  }

  async updateLastUsed(id: string): Promise<void> {
    try {
      await this.supabase.from(this.tableName).update({ last_used_at: new Date().toISOString() }).eq("id", id)
    } catch (error) {
      console.error("Error updating API key last used:", error)
    }
  }

  async validateApiKey(key: string): Promise<{ valid: boolean; apiKey: ApiKey | null }> {
    try {
      const apiKey = await this.findByKey(key)

      if (!apiKey) {
        return { valid: false, apiKey: null }
      }

      // Check if key is active
      if (apiKey.status !== "active") {
        return { valid: false, apiKey }
      }

      // Check if key is expired
      if (apiKey.expires_at && new Date(apiKey.expires_at) < new Date()) {
        await this.update(apiKey.id, { status: "inactive" })
        return { valid: false, apiKey }
      }

      // Update last used timestamp
      await this.updateLastUsed(apiKey.id)

      return { valid: true, apiKey }
    } catch (error) {
      console.error("Error validating API key:", error)
      return { valid: false, apiKey: null }
    }
  }
}
