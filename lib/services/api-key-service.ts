import { ApiKeysRepository } from "@/lib/repositories/api-keys-repository"

export class ApiKeyService {
  private apiKeysRepo: ApiKeysRepository

  constructor() {
    this.apiKeysRepo = new ApiKeysRepository()
  }

  /**
   * Generate a new API key
   */
  async generateApiKey(
    name: string,
    options: {
      permissions?: { read: boolean; write: boolean }
      allowedOrigins?: string[]
      expiresAt?: string
      createdBy?: string
    } = {},
  ) {
    try {
      return await this.apiKeysRepo.createApiKey(name, options)
    } catch (error) {
      console.error("Error generating API key:", error)
      throw error
    }
  }

  /**
   * Get all API keys
   */
  async getAllApiKeys() {
    try {
      return await this.apiKeysRepo.findAll({
        orderBy: "created_at",
        orderDirection: "desc",
      })
    } catch (error) {
      console.error("Error getting API keys:", error)
      throw error
    }
  }

  /**
   * Update API key status
   */
  async updateApiKeyStatus(id: string, status: "active" | "inactive" | "revoked") {
    try {
      return await this.apiKeysRepo.update(id, { status })
    } catch (error) {
      console.error("Error updating API key status:", error)
      throw error
    }
  }

  /**
   * Delete API key
   */
  async deleteApiKey(id: string) {
    try {
      return await this.apiKeysRepo.delete(id)
    } catch (error) {
      console.error("Error deleting API key:", error)
      throw error
    }
  }

  /**
   * Validate API key
   */
  async validateApiKey(key: string) {
    try {
      return await this.apiKeysRepo.validateApiKey(key)
    } catch (error) {
      console.error("Error validating API key:", error)
      return { valid: false, apiKey: null }
    }
  }
}
