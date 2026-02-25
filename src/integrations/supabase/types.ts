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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      announcements: {
        Row: {
          button_text: string | null
          content: string | null
          created_at: string | null
          id: number
          is_active: boolean | null
          link: string | null
          title: string | null
        }
        Insert: {
          button_text?: string | null
          content?: string | null
          created_at?: string | null
          id?: number
          is_active?: boolean | null
          link?: string | null
          title?: string | null
        }
        Update: {
          button_text?: string | null
          content?: string | null
          created_at?: string | null
          id?: number
          is_active?: boolean | null
          link?: string | null
          title?: string | null
        }
        Relationships: []
      }
      game_sessions: {
        Row: {
          buzzer: Json | null
          buzzer_locked: boolean | null
          color_set_index: number | null
          created_at: string | null
          golden_letter: string | null
          hexagons: Json | null
          host_name: string | null
          id: string
          is_active: boolean | null
          is_swapped: boolean | null
          last_activity: string | null
          letters_order: string[] | null
          party_mode: boolean | null
          session_code: string
          teams: Json | null
          winning_path: Json | null
        }
        Insert: {
          buzzer?: Json | null
          buzzer_locked?: boolean | null
          color_set_index?: number | null
          created_at?: string | null
          golden_letter?: string | null
          hexagons?: Json | null
          host_name?: string | null
          id?: string
          is_active?: boolean | null
          is_swapped?: boolean | null
          last_activity?: string | null
          letters_order?: string[] | null
          party_mode?: boolean | null
          session_code: string
          teams?: Json | null
          winning_path?: Json | null
        }
        Update: {
          buzzer?: Json | null
          buzzer_locked?: boolean | null
          color_set_index?: number | null
          created_at?: string | null
          golden_letter?: string | null
          hexagons?: Json | null
          host_name?: string | null
          id?: string
          is_active?: boolean | null
          is_swapped?: boolean | null
          last_activity?: string | null
          letters_order?: string[] | null
          party_mode?: boolean | null
          session_code?: string
          teams?: Json | null
          winning_path?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "game_sessions_session_code_fkey"
            columns: ["session_code"]
            isOneToOne: true
            referencedRelation: "subscription_codes"
            referencedColumns: ["code"]
          },
        ]
      }
      general_questions: {
        Row: {
          answer: string
          created_at: string | null
          id: number
          lang: string | null
          letter: string
          question: string
        }
        Insert: {
          answer: string
          created_at?: string | null
          id?: number
          lang?: string | null
          letter: string
          question: string
        }
        Update: {
          answer?: string
          created_at?: string | null
          id?: number
          lang?: string | null
          letter?: string
          question?: string
        }
        Relationships: []
      }
      session_players: {
        Row: {
          created_at: string | null
          id: string
          is_connected: boolean | null
          last_seen: string | null
          player_name: string
          role: Database["public"]["Enums"]["player_role"]
          session_id: string | null
          team: string | null
          token: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_connected?: boolean | null
          last_seen?: string | null
          player_name: string
          role: Database["public"]["Enums"]["player_role"]
          session_id?: string | null
          team?: string | null
          token?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          is_connected?: boolean | null
          last_seen?: string | null
          player_name?: string
          role?: Database["public"]["Enums"]["player_role"]
          session_id?: string | null
          team?: string | null
          token?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "session_players_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "game_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      session_questions: {
        Row: {
          answer: string
          created_at: string | null
          id: number
          letter: string
          question: string
          session_code: string
        }
        Insert: {
          answer: string
          created_at?: string | null
          id?: number
          letter: string
          question: string
          session_code: string
        }
        Update: {
          answer?: string
          created_at?: string | null
          id?: number
          letter?: string
          question?: string
          session_code?: string
        }
        Relationships: []
      }
      subscription_codes: {
        Row: {
          code: string
          created_at: string | null
          id: string
          is_admin: boolean | null
        }
        Insert: {
          code: string
          created_at?: string | null
          id?: string
          is_admin?: boolean | null
        }
        Update: {
          code?: string
          created_at?: string | null
          id?: string
          is_admin?: boolean | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      claim_buzzer: {
        Args: { p_player_name: string; p_session_id: string; p_team: string }
        Returns: {
          already_claimed_by: string
          success: boolean
        }[]
      }
      register_host: {
        Args: { p_player_name: string; p_session_code: string; p_token: string }
        Returns: {
          error_message: string
          existing_host_name: string
          player_id: string
          success: boolean
        }[]
      }
      reset_buzzer: {
        Args: { p_is_timeout?: boolean; p_session_id: string }
        Returns: undefined
      }
      safe_check_code: {
        Args: { p_code: string }
        Returns: {
          code_exists: boolean
          code_value: string
        }[]
      }
    }
    Enums: {
      player_role: "host" | "contestant" | "display"
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
    Enums: {
      player_role: ["host", "contestant", "display"],
    },
  },
} as const
