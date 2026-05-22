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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      ai_analyses: {
        Row: {
          cache_key: string
          created_at: string
          expires_at: string
          id: string
          kind: string
          payload: Json
        }
        Insert: {
          cache_key: string
          created_at?: string
          expires_at?: string
          id?: string
          kind: string
          payload: Json
        }
        Update: {
          cache_key?: string
          created_at?: string
          expires_at?: string
          id?: string
          kind?: string
          payload?: Json
        }
        Relationships: []
      }
      circle_activity: {
        Row: {
          badges: string[] | null
          comments: number
          customer_id: string
          engagement_score: number
          id: string
          last_active_at: string | null
          posts: number
          reactions: number
        }
        Insert: {
          badges?: string[] | null
          comments?: number
          customer_id: string
          engagement_score?: number
          id?: string
          last_active_at?: string | null
          posts?: number
          reactions?: number
        }
        Update: {
          badges?: string[] | null
          comments?: number
          customer_id?: string
          engagement_score?: number
          id?: string
          last_active_at?: string | null
          posts?: number
          reactions?: number
        }
        Relationships: [
          {
            foreignKeyName: "circle_activity_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: true
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      credentials_config: {
        Row: {
          credentials: Json
          id: string
          updated_at: string
        }
        Insert: {
          credentials?: Json
          id: string
          updated_at?: string
        }
        Update: {
          credentials?: Json
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      customers: {
        Row: {
          avatar_seed: string | null
          boat_type: string | null
          circle_id: string | null
          city: string | null
          country: string | null
          created_at: string
          email: string
          first_order_at: string | null
          id: string
          klaviyo_id: string | null
          last_order_at: string | null
          lat: number | null
          lifetime_value: number
          lng: number | null
          name: string
          shopify_id: string | null
          tags: string[] | null
          total_orders: number
        }
        Insert: {
          avatar_seed?: string | null
          boat_type?: string | null
          circle_id?: string | null
          city?: string | null
          country?: string | null
          created_at?: string
          email: string
          first_order_at?: string | null
          id?: string
          klaviyo_id?: string | null
          last_order_at?: string | null
          lat?: number | null
          lifetime_value?: number
          lng?: number | null
          name: string
          shopify_id?: string | null
          tags?: string[] | null
          total_orders?: number
        }
        Update: {
          avatar_seed?: string | null
          boat_type?: string | null
          circle_id?: string | null
          city?: string | null
          country?: string | null
          created_at?: string
          email?: string
          first_order_at?: string | null
          id?: string
          klaviyo_id?: string | null
          last_order_at?: string | null
          lat?: number | null
          lifetime_value?: number
          lng?: number | null
          name?: string
          shopify_id?: string | null
          tags?: string[] | null
          total_orders?: number
        }
        Relationships: []
      }
      email_events: {
        Row: {
          campaign_name: string | null
          customer_id: string
          event_type: string
          flow_name: string | null
          id: string
          occurred_at: string
        }
        Insert: {
          campaign_name?: string | null
          customer_id: string
          event_type: string
          flow_name?: string | null
          id?: string
          occurred_at?: string
        }
        Update: {
          campaign_name?: string | null
          customer_id?: string
          event_type?: string
          flow_name?: string | null
          id?: string
          occurred_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_events_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      fb_ad_events: {
        Row: {
          ad_set: string | null
          campaign_name: string | null
          customer_id: string
          event_type: string
          id: string
          occurred_at: string
          spend: number | null
        }
        Insert: {
          ad_set?: string | null
          campaign_name?: string | null
          customer_id: string
          event_type: string
          id?: string
          occurred_at?: string
          spend?: number | null
        }
        Update: {
          ad_set?: string | null
          campaign_name?: string | null
          customer_id?: string
          event_type?: string
          id?: string
          occurred_at?: string
          spend?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "fb_ad_events_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      integrations_status: {
        Row: {
          connected: boolean
          id: string
          last_sync_at: string | null
          name: string
          records_synced: number | null
          status_message: string | null
        }
        Insert: {
          connected?: boolean
          id: string
          last_sync_at?: string | null
          name: string
          records_synced?: number | null
          status_message?: string | null
        }
        Update: {
          connected?: boolean
          id?: string
          last_sync_at?: string | null
          name?: string
          records_synced?: number | null
          status_message?: string | null
        }
        Relationships: []
      }
      marketing_actions: {
        Row: {
          assignee: string | null
          channel: string
          created_at: string
          expected_revenue: number | null
          id: string
          launched_at: string | null
          objective: string
          priority: number
          segment_name: string | null
          status: string
          subject_line: string | null
          title: string
        }
        Insert: {
          assignee?: string | null
          channel: string
          created_at?: string
          expected_revenue?: number | null
          id?: string
          launched_at?: string | null
          objective: string
          priority?: number
          segment_name?: string | null
          status?: string
          subject_line?: string | null
          title: string
        }
        Update: {
          assignee?: string | null
          channel?: string
          created_at?: string
          expected_revenue?: number | null
          id?: string
          launched_at?: string | null
          objective?: string
          priority?: number
          segment_name?: string | null
          status?: string
          subject_line?: string | null
          title?: string
        }
        Relationships: []
      }
      orders: {
        Row: {
          created_at: string
          customer_id: string
          discount_used: boolean
          id: string
          line_items: Json
          shopify_order_id: string | null
          total: number
        }
        Insert: {
          created_at?: string
          customer_id: string
          discount_used?: boolean
          id?: string
          line_items?: Json
          shopify_order_id?: string | null
          total: number
        }
        Update: {
          created_at?: string
          customer_id?: string
          discount_used?: boolean
          id?: string
          line_items?: Json
          shopify_order_id?: string | null
          total?: number
        }
        Relationships: [
          {
            foreignKeyName: "orders_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          email: string | null
          full_name: string | null
          id: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
        }
        Update: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
        }
        Relationships: []
      }
      recommendations: {
        Row: {
          angle: string | null
          best_send: string | null
          channel: string
          confidence: number
          created_at: string
          customer_id: string
          id: string
          product_image: string | null
          product_name: string
          reason: string
          status: string
        }
        Insert: {
          angle?: string | null
          best_send?: string | null
          channel: string
          confidence: number
          created_at?: string
          customer_id: string
          id?: string
          product_image?: string | null
          product_name: string
          reason: string
          status?: string
        }
        Update: {
          angle?: string | null
          best_send?: string | null
          channel?: string
          confidence?: number
          created_at?: string
          customer_id?: string
          id?: string
          product_image?: string | null
          product_name?: string
          reason?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "recommendations_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      rfm_scores: {
        Row: {
          calculated_at: string
          churn_risk: number
          customer_id: string
          frequency_score: number
          monetary_score: number
          recency_score: number
          tier: string
          trend: string
        }
        Insert: {
          calculated_at?: string
          churn_risk?: number
          customer_id: string
          frequency_score: number
          monetary_score: number
          recency_score: number
          tier: string
          trend?: string
        }
        Update: {
          calculated_at?: string
          churn_risk?: number
          customer_id?: string
          frequency_score?: number
          monetary_score?: number
          recency_score?: number
          tier?: string
          trend?: string
        }
        Relationships: [
          {
            foreignKeyName: "rfm_scores_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: true
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      segments: {
        Row: {
          avg_ltv: number | null
          created_at: string
          customer_count: number | null
          description: string | null
          id: string
          name: string
          rules: Json
        }
        Insert: {
          avg_ltv?: number | null
          created_at?: string
          customer_count?: number | null
          description?: string | null
          id?: string
          name: string
          rules?: Json
        }
        Update: {
          avg_ltv?: number | null
          created_at?: string
          customer_count?: number | null
          description?: string | null
          id?: string
          name?: string
          rules?: Json
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      refresh_fleet: { Args: never; Returns: Json }
    }
    Enums: {
      [_ in never]: never
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
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
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
