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
      daily_stats: {
        Row: {
          created_at: string
          date: string
          habits_completed: number | null
          id: string
          productivity_score: number | null
          tasks_completed: number | null
          updated_at: string
          user_id: string
          xp_earned: number | null
        }
        Insert: {
          created_at?: string
          date: string
          habits_completed?: number | null
          id?: string
          productivity_score?: number | null
          tasks_completed?: number | null
          updated_at?: string
          user_id: string
          xp_earned?: number | null
        }
        Update: {
          created_at?: string
          date?: string
          habits_completed?: number | null
          id?: string
          productivity_score?: number | null
          tasks_completed?: number | null
          updated_at?: string
          user_id?: string
          xp_earned?: number | null
        }
        Relationships: []
      }
      focus_sessions: {
        Row: {
          completed_at: string
          duration_min: number
          id: string
          task_id: string | null
          user_id: string
        }
        Insert: {
          completed_at?: string
          duration_min: number
          id?: string
          task_id?: string | null
          user_id: string
        }
        Update: {
          completed_at?: string
          duration_min?: number
          id?: string
          task_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "focus_sessions_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      habit_checkins: {
        Row: {
          created_at: string
          date: string
          habit_id: string
          id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          date: string
          habit_id: string
          id?: string
          user_id: string
        }
        Update: {
          created_at?: string
          date?: string
          habit_id?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "habit_checkins_habit_id_fkey"
            columns: ["habit_id"]
            isOneToOne: false
            referencedRelation: "habits"
            referencedColumns: ["id"]
          },
        ]
      }
      habits: {
        Row: {
          archived_at: string | null
          category: string | null
          color: string
          created_at: string
          emoji: string
          id: string
          name: string
          target_per_week: number
          updated_at: string
          user_id: string
        }
        Insert: {
          archived_at?: string | null
          category?: string | null
          color?: string
          created_at?: string
          emoji?: string
          id?: string
          name: string
          target_per_week?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          archived_at?: string | null
          category?: string | null
          color?: string
          created_at?: string
          emoji?: string
          id?: string
          name?: string
          target_per_week?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      health_logs: {
        Row: {
          created_at: string
          date: string
          id: string
          mood: number | null
          sleep_hours: number | null
          steps: number
          updated_at: string
          user_id: string
          water_ml: number
          workouts: number
        }
        Insert: {
          created_at?: string
          date: string
          id?: string
          mood?: number | null
          sleep_hours?: number | null
          steps?: number
          updated_at?: string
          user_id: string
          water_ml?: number
          workouts?: number
        }
        Update: {
          created_at?: string
          date?: string
          id?: string
          mood?: number | null
          sleep_hours?: number | null
          steps?: number
          updated_at?: string
          user_id?: string
          water_ml?: number
          workouts?: number
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          daily_focus_target_min: number
          display_name: string
          id: string
          onboarded_at: string | null
          primary_goal: string | null
          theme: string
          total_xp: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          daily_focus_target_min?: number
          display_name?: string
          id?: string
          onboarded_at?: string | null
          primary_goal?: string | null
          theme?: string
          total_xp?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          daily_focus_target_min?: number
          display_name?: string
          id?: string
          onboarded_at?: string | null
          primary_goal?: string | null
          theme?: string
          total_xp?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      tasks: {
        Row: {
          category: string
          completed: boolean
          completed_at: string | null
          created_at: string
          due_date: string | null
          duration_min: number
          id: string
          notes: string | null
          priority: string
          title: string
          updated_at: string
          user_id: string
          xp: number
        }
        Insert: {
          category?: string
          completed?: boolean
          completed_at?: string | null
          created_at?: string
          due_date?: string | null
          duration_min?: number
          id?: string
          notes?: string | null
          priority?: string
          title: string
          updated_at?: string
          user_id: string
          xp?: number
        }
        Update: {
          category?: string
          completed?: boolean
          completed_at?: string | null
          created_at?: string
          due_date?: string | null
          duration_min?: number
          id?: string
          notes?: string | null
          priority?: string
          title?: string
          updated_at?: string
          user_id?: string
          xp?: number
        }
        Relationships: []
      }
      xp_events: {
        Row: {
          amount: number
          at: string
          branch: string
          id: string
          reason: string
          source_type: string
          user_id: string
        }
        Insert: {
          amount: number
          at?: string
          branch: string
          id?: string
          reason: string
          source_type: string
          user_id: string
        }
        Update: {
          amount?: number
          at?: string
          branch?: string
          id?: string
          reason?: string
          source_type?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      checkin_habit: {
        Args: {
          p_habit_id: string
          p_date: string
        }
        Returns: Json
      }
      complete_task: {
        Args: {
          p_task_id: string
        }
        Returns: Json
      }
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
