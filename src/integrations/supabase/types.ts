export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      brand_settings: {
        Row: {
          body_font: string
          created_at: string
          id: number
          refaq_logo: string
          title_font: string
          updated_at: string
          wathiq_logo: string
        }
        Insert: {
          body_font?: string
          created_at?: string
          id?: number
          refaq_logo?: string
          title_font?: string
          updated_at?: string
          wathiq_logo?: string
        }
        Update: {
          body_font?: string
          created_at?: string
          id?: number
          refaq_logo?: string
          title_font?: string
          updated_at?: string
          wathiq_logo?: string
        }
        Relationships: []
      }
      categories: {
        Row: {
          created_at: string
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      category_memberships: {
        Row: {
          category_id: string
          created_at: string
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          category_id: string
          created_at?: string
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          category_id?: string
          created_at?: string
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "category_memberships_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "category_memberships_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      content_categories: {
        Row: {
          category_id: string
          content_id: string
          created_at: string
          updated_at: string
        }
        Insert: {
          category_id: string
          content_id: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          category_id?: string
          content_id?: string
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "content_categories_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_categories_content_id_fkey"
            columns: ["content_id"]
            isOneToOne: false
            referencedRelation: "content_items"
            referencedColumns: ["id"]
          },
        ]
      }
      content_files: {
        Row: {
          content_id: string
          created_at: string
          file_name: string
          id: string
          object_path: string
          updated_at: string
        }
        Insert: {
          content_id: string
          created_at?: string
          file_name: string
          id?: string
          object_path: string
          updated_at?: string
        }
        Update: {
          content_id?: string
          created_at?: string
          file_name?: string
          id?: string
          object_path?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "content_files_content_id_fkey"
            columns: ["content_id"]
            isOneToOne: false
            referencedRelation: "content_items"
            referencedColumns: ["id"]
          },
        ]
      }
      content_groups: {
        Row: {
          content_id: string
          created_at: string
          group_id: string
          updated_at: string
        }
        Insert: {
          content_id: string
          created_at?: string
          group_id: string
          updated_at?: string
        }
        Update: {
          content_id?: string
          created_at?: string
          group_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "content_groups_content_id_fkey"
            columns: ["content_id"]
            isOneToOne: false
            referencedRelation: "content_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_groups_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
        ]
      }
      content_items: {
        Row: {
          audience: Database["public"]["Enums"]["content_audience"]
          body: string
          created_at: string
          document_date: string | null
          document_type_id: string | null
          id: string
          issuer: string
          kind: string
          published: boolean
          status: Database["public"]["Enums"]["document_status"]
          summary: string
          title: string
          updated_at: string
        }
        Insert: {
          audience?: Database["public"]["Enums"]["content_audience"]
          body?: string
          created_at?: string
          document_date?: string | null
          document_type_id?: string | null
          id?: string
          issuer?: string
          kind: string
          published?: boolean
          status?: Database["public"]["Enums"]["document_status"]
          summary?: string
          title: string
          updated_at?: string
        }
        Update: {
          audience?: Database["public"]["Enums"]["content_audience"]
          body?: string
          created_at?: string
          document_date?: string | null
          document_type_id?: string | null
          id?: string
          issuer?: string
          kind?: string
          published?: boolean
          status?: Database["public"]["Enums"]["document_status"]
          summary?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "content_items_document_type_id_fkey"
            columns: ["document_type_id"]
            isOneToOne: false
            referencedRelation: "document_types"
            referencedColumns: ["id"]
          },
        ]
      }
      content_tags: {
        Row: {
          content_id: string
          created_at: string
          tag_id: string
        }
        Insert: {
          content_id: string
          created_at?: string
          tag_id: string
        }
        Update: {
          content_id?: string
          created_at?: string
          tag_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "content_tags_content_id_fkey"
            columns: ["content_id"]
            isOneToOne: false
            referencedRelation: "content_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_tags_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "tags"
            referencedColumns: ["id"]
          },
        ]
      }
      content_topics: {
        Row: {
          content_id: string
          created_at: string
          topic_id: string
        }
        Insert: {
          content_id: string
          created_at?: string
          topic_id: string
        }
        Update: {
          content_id?: string
          created_at?: string
          topic_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "content_topics_content_id_fkey"
            columns: ["content_id"]
            isOneToOne: false
            referencedRelation: "content_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_topics_topic_id_fkey"
            columns: ["topic_id"]
            isOneToOne: false
            referencedRelation: "knowledge_topics"
            referencedColumns: ["id"]
          },
        ]
      }
      document_events: {
        Row: {
          content_id: string
          created_at: string
          event: string
          format_id: string | null
          id: string
          request_key: string | null
          user_id: string | null
        }
        Insert: {
          content_id: string
          created_at?: string
          event: string
          format_id?: string | null
          id?: string
          request_key?: string | null
          user_id?: string | null
        }
        Update: {
          content_id?: string
          created_at?: string
          event?: string
          format_id?: string | null
          id?: string
          request_key?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "document_events_content_id_fkey"
            columns: ["content_id"]
            isOneToOne: false
            referencedRelation: "content_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_events_format_id_fkey"
            columns: ["format_id"]
            isOneToOne: false
            referencedRelation: "document_formats"
            referencedColumns: ["id"]
          },
        ]
      }
      document_formats: {
        Row: {
          content_id: string
          created_at: string
          drive_file_id: string
          format: string
          id: string
          label: string
          updated_at: string
          verified_at: string | null
          verified_mime: string | null
          verified_size: number | null
          verify_details: Json
          verify_status: string
        }
        Insert: {
          content_id: string
          created_at?: string
          drive_file_id: string
          format: string
          id?: string
          label?: string
          updated_at?: string
          verified_at?: string | null
          verified_mime?: string | null
          verified_size?: number | null
          verify_details?: Json
          verify_status?: string
        }
        Update: {
          content_id?: string
          created_at?: string
          drive_file_id?: string
          format?: string
          id?: string
          label?: string
          updated_at?: string
          verified_at?: string | null
          verified_mime?: string | null
          verified_size?: number | null
          verify_details?: Json
          verify_status?: string
        }
        Relationships: [
          {
            foreignKeyName: "document_formats_content_id_fkey"
            columns: ["content_id"]
            isOneToOne: false
            referencedRelation: "content_items"
            referencedColumns: ["id"]
          },
        ]
      }
      document_types: {
        Row: {
          created_at: string
          description: string
          hidden: boolean
          id: string
          name: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string
          hidden?: boolean
          id?: string
          name: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string
          hidden?: boolean
          id?: string
          name?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      employee_access: {
        Row: {
          created_at: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "employee_access_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      group_memberships: {
        Row: {
          created_at: string
          group_id: string
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          group_id: string
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          group_id?: string
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "group_memberships_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_memberships_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      groups: {
        Row: {
          created_at: string
          description: string
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      knowledge_topics: {
        Row: {
          created_at: string
          description: string
          hidden: boolean
          icon: string
          id: string
          name: string
          parent_id: string | null
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string
          hidden?: boolean
          icon?: string
          id?: string
          name: string
          parent_id?: string | null
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string
          hidden?: boolean
          icon?: string
          id?: string
          name?: string
          parent_id?: string | null
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "knowledge_topics_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "knowledge_topics"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          email: string
          full_name: string
          id: string
          job_title: string
          mobile: string
          organization: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          email?: string
          full_name?: string
          id: string
          job_title?: string
          mobile?: string
          organization?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string
          full_name?: string
          id?: string
          job_title?: string
          mobile?: string
          organization?: string
          updated_at?: string
        }
        Relationships: []
      }
      role_audit_log: {
        Row: {
          actor_id: string | null
          actor_source: string
          created_at: string
          database_executor: string | null
          id: string
          new_role: Database["public"]["Enums"]["app_role"] | null
          old_role: Database["public"]["Enums"]["app_role"] | null
          target_user: string
        }
        Insert: {
          actor_id?: string | null
          actor_source: string
          created_at?: string
          database_executor?: string | null
          id?: string
          new_role?: Database["public"]["Enums"]["app_role"] | null
          old_role?: Database["public"]["Enums"]["app_role"] | null
          target_user: string
        }
        Update: {
          actor_id?: string | null
          actor_source?: string
          created_at?: string
          database_executor?: string | null
          id?: string
          new_role?: Database["public"]["Enums"]["app_role"] | null
          old_role?: Database["public"]["Enums"]["app_role"] | null
          target_user?: string
        }
        Relationships: []
      }
      tags: {
        Row: {
          created_at: string
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      document_format_kinds: { Args: { doc: string }; Returns: string[] }
      document_usage_totals: {
        Args: { docs: string[] }
        Returns: {
          content_id: string
          download_requests: number
          format_downloads: Json
          views: number
        }[]
      }
      get_admin_directory: {
        Args: never
        Returns: {
          eligible: boolean
          email: string
          full_name: string
          is_admin: boolean
          user_id: string
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_staff: { Args: never; Returns: boolean }
      record_document_usage: {
        Args: {
          action: string
          actor: string
          doc: string
          fmt: string
          key: string
        }
        Returns: boolean
      }
      related_documents: {
        Args: { doc: string; lim?: number }
        Returns: {
          document_type_id: string
          formats: string[]
          id: string
          summary: string
          title: string
          updated_at: string
        }[]
      }
      save_document: {
        Args: {
          category_ids: string[]
          doc_id: string
          doc_summary: string
          doc_title: string
          formats: Json
          group_ids: string[]
          new_audience: Database["public"]["Enums"]["content_audience"]
          tag_ids: string[]
          topic_ids: string[]
          type_id: string
        }
        Returns: string
      }
      search_library: {
        Args: {
          fmt?: string
          page?: number
          page_size?: number
          q?: string
          sort?: string
          tag_ids?: string[]
          topic?: string
          type_id?: string
        }
        Returns: {
          document_type_id: string
          formats: string[]
          id: string
          summary: string
          title: string
          topic_ids: string[]
          total: number
          updated_at: string
        }[]
      }
      set_account_role: {
        Args: {
          new_role: Database["public"]["Enums"]["app_role"]
          target_user: string
        }
        Returns: undefined
      }
      set_content_audience: {
        Args: {
          category_ids: string[]
          content_uuid: string
          group_ids: string[]
          new_audience: Database["public"]["Enums"]["content_audience"]
        }
        Returns: undefined
      }
      set_document_status: {
        Args: {
          doc_id: string
          new_status: Database["public"]["Enums"]["document_status"]
        }
        Returns: undefined
      }
      set_employee_access: {
        Args: { enabled: boolean; target_user: string }
        Returns: undefined
      }
      topic_document_counts: {
        Args: never
        Returns: {
          documents: number
          topic_id: string
        }[]
      }
    }
    Enums: {
      app_role: "admin" | "supervisor" | "user"
      content_audience: "everyone" | "registered" | "employees" | "targeted"
      document_status: "draft" | "published" | "archived"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "supervisor", "user"],
      content_audience: ["everyone", "registered", "employees", "targeted"],
      document_status: ["draft", "published", "archived"],
    },
  },
} as const
