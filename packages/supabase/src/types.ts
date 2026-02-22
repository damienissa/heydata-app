/**
 * Database types for Supabase tables.
 *
 * These are manually defined to match the SQL migrations.
 * In production, regenerate with: supabase gen types typescript --linked > src/types.ts
 */

export interface Database {
  public: {
    Tables: {
      connections: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          db_type: string;
          connection_string: string;
          ssl_enabled: boolean;
          status: string;
          last_tested_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          name: string;
          db_type?: string;
          connection_string: string;
          ssl_enabled?: boolean;
          status?: string;
          last_tested_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          name?: string;
          db_type?: string;
          connection_string?: string;
          ssl_enabled?: boolean;
          status?: string;
          last_tested_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      semantic_layers: {
        Row: {
          id: string;
          connection_id: string;
          metrics: unknown[];
          dimensions: unknown[];
          entities: unknown[];
          raw_schema: unknown | null;
          generated_at: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          connection_id: string;
          metrics?: unknown[];
          dimensions?: unknown[];
          entities?: unknown[];
          raw_schema?: unknown | null;
          generated_at?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          connection_id?: string;
          metrics?: unknown[];
          dimensions?: unknown[];
          entities?: unknown[];
          raw_schema?: unknown | null;
          generated_at?: string;
          created_at?: string;
          updated_at?: string;
        };
      };
      chat_sessions: {
        Row: {
          id: string;
          user_id: string;
          connection_id: string | null;
          title: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          connection_id?: string | null;
          title?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          connection_id?: string | null;
          title?: string;
          created_at?: string;
          updated_at?: string;
        };
      };
      chat_messages: {
        Row: {
          id: string;
          session_id: string;
          role: string;
          content: string;
          tool_results: unknown | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          session_id: string;
          role: string;
          content: string;
          tool_results?: unknown | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          session_id?: string;
          role?: string;
          content?: string;
          tool_results?: unknown | null;
          created_at?: string;
        };
      };
    };
  };
}
