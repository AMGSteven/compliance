import { createServerClient } from "@/lib/supabase/server"
import type { SupabaseClient } from "@supabase/supabase-js"

export interface Repository<T> {
  findById(id: string): Promise<T | null>
  findAll(options?: QueryOptions): Promise<T[]>
  create(data: Partial<T>): Promise<T>
  update(id: string, data: Partial<T>): Promise<T | null>
  delete(id: string): Promise<boolean>
  count(filters?: Record<string, any>): Promise<number>
}

export interface QueryOptions {
  limit?: number
  offset?: number
  orderBy?: string
  orderDirection?: "asc" | "desc"
  filters?: Record<string, any>
}

export class BaseRepository<T> implements Repository<T> {
  protected tableName: string
  protected supabase: SupabaseClient

  constructor(tableName: string) {
    this.tableName = tableName
    this.supabase = createServerClient()
  }

  async findById(id: string): Promise<T | null> {
    try {
      const { data, error } = await this.supabase.from(this.tableName).select("*").eq("id", id).single()

      if (error) throw error
      return data as T
    } catch (error) {
      console.error(`Error finding ${this.tableName} by ID:`, error)
      return null
    }
  }

  async findAll(options: QueryOptions = {}): Promise<T[]> {
    try {
      let query = this.supabase.from(this.tableName).select("*")

      // Apply filters
      if (options.filters) {
        Object.entries(options.filters).forEach(([key, value]) => {
          if (value !== undefined && value !== null) {
            query = query.eq(key, value)
          }
        })
      }

      // Apply ordering
      if (options.orderBy) {
        query = query.order(options.orderBy, {
          ascending: options.orderDirection !== "desc",
        })
      }

      // Apply pagination
      if (options.limit) {
        query = query.limit(options.limit)
      }

      if (options.offset) {
        query = query.range(options.offset, options.offset + (options.limit || 10) - 1)
      }

      const { data, error } = await query

      if (error) throw error
      return data as T[]
    } catch (error) {
      console.error(`Error finding all ${this.tableName}:`, error)
      return []
    }
  }

  async create(data: Partial<T>): Promise<T> {
    try {
      const { data: created, error } = await this.supabase.from(this.tableName).insert(data).select().single()

      if (error) throw error
      return created as T
    } catch (error) {
      console.error(`Error creating ${this.tableName}:`, error)
      throw error
    }
  }

  async update(id: string, data: Partial<T>): Promise<T | null> {
    try {
      const { data: updated, error } = await this.supabase
        .from(this.tableName)
        .update(data)
        .eq("id", id)
        .select()
        .single()

      if (error) throw error
      return updated as T
    } catch (error) {
      console.error(`Error updating ${this.tableName}:`, error)
      return null
    }
  }

  async delete(id: string): Promise<boolean> {
    try {
      const { error } = await this.supabase.from(this.tableName).delete().eq("id", id)

      if (error) throw error
      return true
    } catch (error) {
      console.error(`Error deleting ${this.tableName}:`, error)
      return false
    }
  }

  async count(filters?: Record<string, any>): Promise<number> {
    try {
      let query = this.supabase.from(this.tableName).select("*", { count: "exact", head: true })

      // Apply filters
      if (filters) {
        Object.entries(filters).forEach(([key, value]) => {
          if (value !== undefined && value !== null) {
            query = query.eq(key, value)
          }
        })
      }

      const { count, error } = await query

      if (error) throw error
      return count || 0
    } catch (error) {
      console.error(`Error counting ${this.tableName}:`, error)
      return 0
    }
  }
}
