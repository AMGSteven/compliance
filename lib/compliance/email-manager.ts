import { createClient } from '@supabase/supabase-js';
import { EmailOptInEntry, EmailOptOutEntry } from './types';

export class EmailManager {
  private readonly supabase;

  constructor() {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
      console.error('Missing Supabase credentials in environment variables');
    }

    this.supabase = createClient(supabaseUrl || '', supabaseKey || '');
  }

  /**
   * Add an email to the opt-out list
   */
  async addToOptOut(entry: EmailOptOutEntry): Promise<{
    success: boolean;
    message?: string;
    data?: any;
    error?: any;
  }> {
    try {
      console.log(`Adding email to opt-out list: ${entry.email}`);
      
      const { email, first_name, last_name, reason, source } = entry;
      
      // Normalize email by trimming and converting to lowercase
      const normalizedEmail = email.trim().toLowerCase();
      
      const optOutEntry = {
        email: normalizedEmail,
        first_name,
        last_name,
        reason: reason || 'User opted out',
        source: source || 'manual',
        status: 'active',
        date_added: new Date().toISOString(),
      };

      const { data, error } = await this.supabase
        .from('email_optouts')
        .upsert(optOutEntry)
        .select('*')
        .maybeSingle();

      if (error) {
        console.error('Error adding email to opt-out list:', {
          message: error.message,
          details: error.details,
          hint: error.hint,
          code: error.code
        });
        return {
          success: false,
          message: `Failed to add email to opt-out list: ${error.message}`,
          error,
        };
      }

      console.log('Successfully added email to opt-out list:', data);
      return {
        success: true,
        message: 'Email added to opt-out list successfully',
        data,
      };
    } catch (error: any) {
      console.error('Unexpected error adding email to opt-out list:', error);
      return {
        success: false,
        message: `Unexpected error: ${error.message}`,
        error,
      };
    }
  }

  /**
   * Check if an email is in the opt-out list
   */
  async checkOptOut(email: string): Promise<{
    isOptedOut: boolean;
    data?: any;
    error?: any;
  }> {
    try {
      console.log(`Checking if email is opted out: ${email}`);
      
      // Normalize email by trimming and converting to lowercase
      const normalizedEmail = email.trim().toLowerCase();
      
      const { data, error } = await this.supabase
        .from('email_optouts')
        .select('*')
        .eq('email', normalizedEmail)
        .eq('status', 'active')
        .maybeSingle();

      if (error) {
        console.error('Error checking email opt-out status:', error);
        return {
          isOptedOut: false,
          error,
        };
      }

      return {
        isOptedOut: !!data,
        data,
      };
    } catch (error: any) {
      console.error('Unexpected error checking email opt-out status:', error);
      return {
        isOptedOut: false,
        error,
      };
    }
  }

  /**
   * Add an email to the opt-in list
   */
  async addToOptIn(entry: EmailOptInEntry): Promise<{
    success: boolean;
    message?: string;
    data?: any;
    error?: any;
  }> {
    try {
      console.log(`Adding email to opt-in list: ${entry.email}`);
      
      const { email, first_name, last_name, source, consent_details } = entry;
      
      // Normalize email by trimming and converting to lowercase
      const normalizedEmail = email.trim().toLowerCase();
      
      const optInEntry = {
        email: normalizedEmail,
        first_name,
        last_name,
        source: source || 'manual',
        consent_details,
        status: 'active',
        date_added: new Date().toISOString(),
      };

      const { data, error } = await this.supabase
        .from('email_optins')
        .upsert(optInEntry)
        .select('*')
        .maybeSingle();

      if (error) {
        console.error('Error adding email to opt-in list:', error);
        return {
          success: false,
          message: `Failed to add email to opt-in list: ${error.message}`,
          error,
        };
      }

      console.log('Successfully added email to opt-in list:', data);
      return {
        success: true,
        message: 'Email added to opt-in list successfully',
        data,
      };
    } catch (error: any) {
      console.error('Unexpected error adding email to opt-in list:', error);
      return {
        success: false,
        message: `Unexpected error: ${error.message}`,
        error,
      };
    }
  }

  /**
   * Check if an email is in the opt-in list
   */
  async checkOptIn(email: string): Promise<{
    isOptedIn: boolean;
    data?: any;
    error?: any;
  }> {
    try {
      console.log(`Checking if email is opted in: ${email}`);
      
      // Normalize email by trimming and converting to lowercase
      const normalizedEmail = email.trim().toLowerCase();
      
      const { data, error } = await this.supabase
        .from('email_optins')
        .select('*')
        .eq('email', normalizedEmail)
        .eq('status', 'active')
        .maybeSingle();

      if (error) {
        console.error('Error checking email opt-in status:', error);
        return {
          isOptedIn: false,
          error,
        };
      }

      return {
        isOptedIn: !!data,
        data,
      };
    } catch (error: any) {
      console.error('Unexpected error checking email opt-in status:', error);
      return {
        isOptedIn: false,
        error,
      };
    }
  }

  /**
   * Get recent opt-out entries
   */
  async getRecentOptOuts(limit = 10, offset = 0): Promise<{
    data: any[];
    error?: any;
  }> {
    try {
      const { data, error } = await this.supabase
        .from('email_optouts')
        .select('*')
        .eq('status', 'active')
        .order('date_added', { ascending: false })
        .range(offset, offset + limit - 1);

      if (error) {
        console.error('Error fetching recent opt-outs:', error);
        return { data: [], error };
      }

      return { data: data || [] };
    } catch (error) {
      console.error('Unexpected error fetching recent opt-outs:', error);
      return { data: [], error };
    }
  }

  /**
   * Get recent opt-in entries
   */
  async getRecentOptIns(limit = 10, offset = 0): Promise<{
    data: any[];
    error?: any;
  }> {
    try {
      const { data, error } = await this.supabase
        .from('email_optins')
        .select('*')
        .eq('status', 'active')
        .order('date_added', { ascending: false })
        .range(offset, offset + limit - 1);

      if (error) {
        console.error('Error fetching recent opt-ins:', error);
        return { data: [], error };
      }

      return { data: data || [] };
    } catch (error) {
      console.error('Unexpected error fetching recent opt-ins:', error);
      return { data: [], error };
    }
  }

  /**
   * Get the count of active opt-out emails
   */
  async getOptOutCount(): Promise<number> {
    try {
      const { count, error } = await this.supabase
        .from('email_optouts')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'active');

      if (error) {
        console.error('Error getting opt-out count:', error);
        return 0;
      }

      return count || 0;
    } catch (error) {
      console.error('Unexpected error getting opt-out count:', error);
      return 0;
    }
  }

  /**
   * Get the count of active opt-in emails
   */
  async getOptInCount(): Promise<number> {
    try {
      const { count, error } = await this.supabase
        .from('email_optins')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'active');

      if (error) {
        console.error('Error getting opt-in count:', error);
        return 0;
      }

      return count || 0;
    } catch (error) {
      console.error('Unexpected error getting opt-in count:', error);
      return 0;
    }
  }

  /**
   * Get opt-outs added today
   */
  async getOptOutsAddedToday(): Promise<number> {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const { count, error } = await this.supabase
        .from('email_optouts')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'active')
        .gte('date_added', today.toISOString());

      if (error) {
        console.error('Error getting today\'s opt-outs:', error);
        return 0;
      }

      return count || 0;
    } catch (error) {
      console.error('Unexpected error getting today\'s opt-outs:', error);
      return 0;
    }
  }

  /**
   * Get opt-ins added today
   */
  async getOptInsAddedToday(): Promise<number> {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const { count, error } = await this.supabase
        .from('email_optins')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'active')
        .gte('date_added', today.toISOString());

      if (error) {
        console.error('Error getting today\'s opt-ins:', error);
        return 0;
      }

      return count || 0;
    } catch (error) {
      console.error('Unexpected error getting today\'s opt-ins:', error);
      return 0;
    }
  }
}
