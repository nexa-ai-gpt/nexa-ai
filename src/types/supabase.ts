export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      connected_accounts: {
        Row: {
          id: string;
          user_id: string;
          provider: string;
          nango_connection_id: string;
          account_email: string | null;
          account_display_name: string | null;
          scopes: string[] | null;
          status: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          provider: string;
          nango_connection_id: string;
          account_email?: string | null;
          account_display_name?: string | null;
          scopes?: string[] | null;
          status?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<
          Omit<
            Database["public"]["Tables"]["connected_accounts"]["Insert"],
            "user_id" | "nango_connection_id" | "provider"
          >
        >;
      };
      oauth_states: {
        Row: {
          id: string;
          user_id: string;
          provider: string;
          nonce: string;
          connection_id: string | null;
          redirect_to: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          provider: string;
          nonce: string;
          connection_id?: string | null;
          redirect_to?: string | null;
          created_at?: string;
        };
        Update: Partial<
          Omit<
            Database["public"]["Tables"]["oauth_states"]["Insert"],
            "user_id" | "provider" | "nonce"
          >
        >;
      };
      notes: {
        Row: {
          id: string;
          user_id: string;
          title: string;
          content: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          title?: string;
          content?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          title?: string;
          content?: Json;
          updated_at?: string;
        };
      };
      library_documents: {
        Row: {
          id: string;
          user_id: string;
          title: string;
          content: string;
          file_type: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          title: string;
          content: string;
          file_type?: string;
          created_at?: string;
        };
        Update: {
          title?: string;
          content?: string;
        };
      };
      library_chunks: {
        Row: {
          id: string;
          document_id: string;
          user_id: string;
          content: string;
          embedding: number[] | null;
          chunk_index: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          document_id: string;
          user_id: string;
          content: string;
          embedding?: number[] | null;
          chunk_index: number;
          created_at?: string;
        };
        Update: {
          embedding?: number[] | null;
        };
      };
    };
    Views: Record<string, never>;
    Functions: {
      search_library_chunks: {
        Args: {
          query_embedding: number[];
          match_user_id: string;
          match_count?: number;
        };
        Returns: Array<{
          id: string;
          document_id: string;
          content: string;
          similarity: number;
        }>;
      };
    };
    Enums: Record<string, never>;
  };
}
