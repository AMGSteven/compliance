import { createClient } from '@supabase/supabase-js';

/**
 * Helper class to initialize the email-related tables in Supabase
 */
export class EmailTableCreator {
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
   * Check if the email_optouts table exists
   */
  async emailOptOutsTableExists(): Promise<boolean> {
    try {
      const { error } = await this.supabase.from('email_optouts').select('id', { count: 'exact', head: true });
      
      // If there's no error, the table exists
      return !error;
    } catch (error) {
      console.error('Error checking if email_optouts table exists:', error);
      return false;
    }
  }

  /**
   * Check if the email_optins table exists
   */
  async emailOptInsTableExists(): Promise<boolean> {
    try {
      const { error } = await this.supabase.from('email_optins').select('id', { count: 'exact', head: true });
      
      // If there's no error, the table exists
      return !error;
    } catch (error) {
      console.error('Error checking if email_optins table exists:', error);
      return false;
    }
  }

  /**
   * Initialize tables if they don't exist
   */
  async initializeTables(): Promise<{
    success: boolean;
    message: string;
  }> {
    try {
      // Check if tables already exist
      const optOutsExists = await this.emailOptOutsTableExists();
      const optInsExists = await this.emailOptInsTableExists();

      if (optOutsExists && optInsExists) {
        return {
          success: true,
          message: 'Email tables already exist'
        };
      }

      console.log('Attempting to create missing email tables...');

      // For Supabase with default policies, we can't create tables through API without admin rights
      // We'll return info to help users understand the situation
      
      return {
        success: false,
        message: 'Email tables do not exist in your Supabase database. Please run the migrations from migrations/create_email_optout_table.sql in your Supabase SQL editor.'
      };
    } catch (error) {
      console.error('Error initializing email tables:', error);
      return {
        success: false,
        message: 'Error initializing email tables. Please check server logs.'
      };
    }
  }
}
