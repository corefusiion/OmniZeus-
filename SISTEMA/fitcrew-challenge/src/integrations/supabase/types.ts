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
      absences: {
        Row: {
          absence_date: string
          challenge_id: string
          created_at: string
          id: string
          penalty_pts: number
          post_id: string | null
          user_id: string
        }
        Insert: {
          absence_date: string
          challenge_id: string
          created_at?: string
          id?: string
          penalty_pts?: number
          post_id?: string | null
          user_id: string
        }
        Update: {
          absence_date?: string
          challenge_id?: string
          created_at?: string
          id?: string
          penalty_pts?: number
          post_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "absences_challenge_id_fkey"
            columns: ["challenge_id"]
            isOneToOne: false
            referencedRelation: "challenges"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "absences_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      affiliate_earnings_log: {
        Row: {
          admin_id: string
          commission_amount: number
          created_at: string
          gross_amount: number
          id: string
          referred_user_id: string
          source_type: string
          stripe_session_id: string | null
        }
        Insert: {
          admin_id: string
          commission_amount: number
          created_at?: string
          gross_amount: number
          id?: string
          referred_user_id: string
          source_type: string
          stripe_session_id?: string | null
        }
        Update: {
          admin_id?: string
          commission_amount?: number
          created_at?: string
          gross_amount?: number
          id?: string
          referred_user_id?: string
          source_type?: string
          stripe_session_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "affiliate_earnings_log_admin_id_fkey"
            columns: ["admin_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "affiliate_earnings_log_referred_user_id_fkey"
            columns: ["referred_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_coach_messages: {
        Row: {
          content: string
          created_at: string
          id: string
          image_path: string | null
          role: string
          tokens_used: number | null
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          image_path?: string | null
          role: string
          tokens_used?: number | null
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          image_path?: string | null
          role?: string
          tokens_used?: number | null
          user_id?: string
        }
        Relationships: []
      }
      ai_moderation_queue: {
        Row: {
          body: string
          created_at: string
          id: string
          kind: string
          media_url: string | null
          metadata: Json | null
          moderated_at: string | null
          moderated_by: string | null
          published_comment_id: string | null
          published_post_id: string | null
          status: string
          target_post_id: string | null
          updated_at: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          kind: string
          media_url?: string | null
          metadata?: Json | null
          moderated_at?: string | null
          moderated_by?: string | null
          published_comment_id?: string | null
          published_post_id?: string | null
          status?: string
          target_post_id?: string | null
          updated_at?: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          kind?: string
          media_url?: string | null
          metadata?: Json | null
          moderated_at?: string | null
          moderated_by?: string | null
          published_comment_id?: string | null
          published_post_id?: string | null
          status?: string
          target_post_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_moderation_queue_published_comment_id_fkey"
            columns: ["published_comment_id"]
            isOneToOne: false
            referencedRelation: "post_comments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_moderation_queue_published_post_id_fkey"
            columns: ["published_post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_moderation_queue_target_post_id_fkey"
            columns: ["target_post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_schedule_config: {
        Row: {
          created_at: string
          cron_expression: string
          id: string
          is_active: boolean
          kind: string
          last_run_at: string | null
          name: string
          prompt: string
          requires_approval: boolean
          updated_at: string
        }
        Insert: {
          created_at?: string
          cron_expression: string
          id?: string
          is_active?: boolean
          kind: string
          last_run_at?: string | null
          name: string
          prompt: string
          requires_approval?: boolean
          updated_at?: string
        }
        Update: {
          created_at?: string
          cron_expression?: string
          id?: string
          is_active?: boolean
          kind?: string
          last_run_at?: string | null
          name?: string
          prompt?: string
          requires_approval?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      ai_settings: {
        Row: {
          api_key: string | null
          created_at: string
          id: boolean
          image_model_name: string | null
          model_name: string
          provider: string
          tavily_api_key: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          api_key?: string | null
          created_at?: string
          id?: boolean
          image_model_name?: string | null
          model_name?: string
          provider?: string
          tavily_api_key?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          api_key?: string | null
          created_at?: string
          id?: boolean
          image_model_name?: string | null
          model_name?: string
          provider?: string
          tavily_api_key?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      ai_usage_logs: {
        Row: {
          created_at: string
          id: string
          usage_type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          usage_type: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          usage_type?: string
          user_id?: string
        }
        Relationships: []
      }
      badges: {
        Row: {
          created_at: string
          criteria: Json
          description: string
          icon: string
          id: string
          name: string
          slug: string
        }
        Insert: {
          created_at?: string
          criteria?: Json
          description: string
          icon: string
          id?: string
          name: string
          slug: string
        }
        Update: {
          created_at?: string
          criteria?: Json
          description?: string
          icon?: string
          id?: string
          name?: string
          slug?: string
        }
        Relationships: []
      }
      banned_words: {
        Row: {
          active: boolean
          created_at: string
          severity: number
          word: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          severity?: number
          word: string
        }
        Update: {
          active?: boolean
          created_at?: string
          severity?: number
          word?: string
        }
        Relationships: []
      }
      body_composition_goals: {
        Row: {
          bmi: number | null
          body_type_key: string | null
          created_at: string
          fat_delta_kg: number | null
          id: string
          ideal_weight_kg: number | null
          metric_id: string | null
          muscle_delta_kg: number | null
          narrative: string | null
          user_id: string
          weight_delta_kg: number | null
        }
        Insert: {
          bmi?: number | null
          body_type_key?: string | null
          created_at?: string
          fat_delta_kg?: number | null
          id?: string
          ideal_weight_kg?: number | null
          metric_id?: string | null
          muscle_delta_kg?: number | null
          narrative?: string | null
          user_id: string
          weight_delta_kg?: number | null
        }
        Update: {
          bmi?: number | null
          body_type_key?: string | null
          created_at?: string
          fat_delta_kg?: number | null
          id?: string
          ideal_weight_kg?: number | null
          metric_id?: string | null
          muscle_delta_kg?: number | null
          narrative?: string | null
          user_id?: string
          weight_delta_kg?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "body_composition_goals_metric_id_fkey"
            columns: ["metric_id"]
            isOneToOne: false
            referencedRelation: "body_metrics_history"
            referencedColumns: ["id"]
          },
        ]
      }
      body_metrics_history: {
        Row: {
          ai_notes: Json | null
          bmi: number | null
          bmr: number | null
          body_fat_pct: number | null
          body_type: string | null
          challenge_id: string | null
          created_at: string
          height_cm: number | null
          id: string
          metabolic_age: number | null
          mood: string | null
          muscle_mass_pct: number | null
          note: string | null
          photo_front_path: string | null
          photo_side_path: string | null
          recorded_at: string
          sex: Database["public"]["Enums"]["sex_enum"] | null
          shared_with_challenge: boolean
          source: string
          user_id: string
          visceral_fat: number | null
          waist_cm: number | null
          water_pct: number | null
          week_of: string | null
          weight_kg: number
        }
        Insert: {
          ai_notes?: Json | null
          bmi?: number | null
          bmr?: number | null
          body_fat_pct?: number | null
          body_type?: string | null
          challenge_id?: string | null
          created_at?: string
          height_cm?: number | null
          id?: string
          metabolic_age?: number | null
          mood?: string | null
          muscle_mass_pct?: number | null
          note?: string | null
          photo_front_path?: string | null
          photo_side_path?: string | null
          recorded_at?: string
          sex?: Database["public"]["Enums"]["sex_enum"] | null
          shared_with_challenge?: boolean
          source?: string
          user_id: string
          visceral_fat?: number | null
          waist_cm?: number | null
          water_pct?: number | null
          week_of?: string | null
          weight_kg: number
        }
        Update: {
          ai_notes?: Json | null
          bmi?: number | null
          bmr?: number | null
          body_fat_pct?: number | null
          body_type?: string | null
          challenge_id?: string | null
          created_at?: string
          height_cm?: number | null
          id?: string
          metabolic_age?: number | null
          mood?: string | null
          muscle_mass_pct?: number | null
          note?: string | null
          photo_front_path?: string | null
          photo_side_path?: string | null
          recorded_at?: string
          sex?: Database["public"]["Enums"]["sex_enum"] | null
          shared_with_challenge?: boolean
          source?: string
          user_id?: string
          visceral_fat?: number | null
          waist_cm?: number | null
          water_pct?: number | null
          week_of?: string | null
          weight_kg?: number
        }
        Relationships: [
          {
            foreignKeyName: "body_metrics_history_challenge_id_fkey"
            columns: ["challenge_id"]
            isOneToOne: false
            referencedRelation: "challenges"
            referencedColumns: ["id"]
          },
        ]
      }
      challenge_members: {
        Row: {
          bonus_points: number
          challenge_id: string
          current_streak: number
          forgiveness_tickets: number
          joined_at: string
          last_checkin_date: string | null
          last_pause_at: string | null
          last_weigh_in_week: string | null
          longest_streak: number
          longest_weigh_in_streak: number
          pause_reason: string | null
          paused_from: string | null
          paused_until: string | null
          role: string
          user_id: string
          weigh_in_streak: number
        }
        Insert: {
          bonus_points?: number
          challenge_id: string
          current_streak?: number
          forgiveness_tickets?: number
          joined_at?: string
          last_checkin_date?: string | null
          last_pause_at?: string | null
          last_weigh_in_week?: string | null
          longest_streak?: number
          longest_weigh_in_streak?: number
          pause_reason?: string | null
          paused_from?: string | null
          paused_until?: string | null
          role: string
          user_id: string
          weigh_in_streak?: number
        }
        Update: {
          bonus_points?: number
          challenge_id?: string
          current_streak?: number
          forgiveness_tickets?: number
          joined_at?: string
          last_checkin_date?: string | null
          last_pause_at?: string | null
          last_weigh_in_week?: string | null
          longest_streak?: number
          longest_weigh_in_streak?: number
          pause_reason?: string | null
          paused_from?: string | null
          paused_until?: string | null
          role?: string
          user_id?: string
          weigh_in_streak?: number
        }
        Relationships: [
          {
            foreignKeyName: "challenge_members_challenge_id_fkey"
            columns: ["challenge_id"]
            isOneToOne: false
            referencedRelation: "challenges"
            referencedColumns: ["id"]
          },
        ]
      }
      challenge_messages: {
        Row: {
          body: string | null
          challenge_id: string
          checkin_id: string | null
          created_at: string
          deleted_at: string | null
          edited_at: string | null
          id: string
          image_url: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          body?: string | null
          challenge_id: string
          checkin_id?: string | null
          created_at?: string
          deleted_at?: string | null
          edited_at?: string | null
          id?: string
          image_url?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          body?: string | null
          challenge_id?: string
          checkin_id?: string | null
          created_at?: string
          deleted_at?: string | null
          edited_at?: string | null
          id?: string
          image_url?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "challenge_messages_challenge_id_fkey"
            columns: ["challenge_id"]
            isOneToOne: false
            referencedRelation: "challenges"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "challenge_messages_checkin_id_fkey"
            columns: ["checkin_id"]
            isOneToOne: false
            referencedRelation: "checkins"
            referencedColumns: ["id"]
          },
        ]
      }
      challenge_participants: {
        Row: {
          challenge_id: string
          joined_at: string
          paid: boolean
          user_id: string
        }
        Insert: {
          challenge_id: string
          joined_at?: string
          paid?: boolean
          user_id: string
        }
        Update: {
          challenge_id?: string
          joined_at?: string
          paid?: boolean
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "challenge_participants_challenge_id_fkey"
            columns: ["challenge_id"]
            isOneToOne: false
            referencedRelation: "challenges"
            referencedColumns: ["id"]
          },
        ]
      }
      challenge_stories: {
        Row: {
          author_id: string
          caption: string | null
          challenge_id: string
          created_at: string
          expires_at: string
          id: string
          media_kind: string
          media_url: string
        }
        Insert: {
          author_id: string
          caption?: string | null
          challenge_id: string
          created_at?: string
          expires_at?: string
          id?: string
          media_kind: string
          media_url: string
        }
        Update: {
          author_id?: string
          caption?: string | null
          challenge_id?: string
          created_at?: string
          expires_at?: string
          id?: string
          media_kind?: string
          media_url?: string
        }
        Relationships: [
          {
            foreignKeyName: "challenge_stories_challenge_id_fkey"
            columns: ["challenge_id"]
            isOneToOne: false
            referencedRelation: "challenges"
            referencedColumns: ["id"]
          },
        ]
      }
      challenges: {
        Row: {
          absence_penalty_pts: number
          banner_generations_used: number
          banner_url: string | null
          checkin_cooldown_min: number
          city: string | null
          closed_at: string | null
          created_at: string
          created_by: string | null
          currency: string
          description: string | null
          duration_bonus_cap_pct: number
          duration_bonus_step_min: number
          ends_at: string
          entry_fee: number
          id: string
          invite_code: string | null
          invite_enabled: boolean
          is_active: boolean
          is_pro: boolean
          is_public: boolean
          max_days_per_week: number
          member_count: number
          member_limit: number
          name: string
          owner_id: string | null
          prize_split: Json
          reactivated_to_id: string | null
          reactivation_requested: boolean
          reactivation_requested_at: string | null
          reactivation_requested_by: string | null
          starts_at: string
          status: string
          streak_bonus_points: number
          tiebreak_duration_cap_min: number
          tiebreakers: Json
          updated_at: string
          weigh_in_day_of_week: number
          weigh_in_enabled: boolean
        }
        Insert: {
          absence_penalty_pts?: number
          banner_generations_used?: number
          banner_url?: string | null
          checkin_cooldown_min?: number
          city?: string | null
          closed_at?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          description?: string | null
          duration_bonus_cap_pct?: number
          duration_bonus_step_min?: number
          ends_at: string
          entry_fee?: number
          id?: string
          invite_code?: string | null
          invite_enabled?: boolean
          is_active?: boolean
          is_pro?: boolean
          is_public?: boolean
          max_days_per_week?: number
          member_count?: number
          member_limit?: number
          name: string
          owner_id?: string | null
          prize_split?: Json
          reactivated_to_id?: string | null
          reactivation_requested?: boolean
          reactivation_requested_at?: string | null
          reactivation_requested_by?: string | null
          starts_at: string
          status?: string
          streak_bonus_points?: number
          tiebreak_duration_cap_min?: number
          tiebreakers?: Json
          updated_at?: string
          weigh_in_day_of_week?: number
          weigh_in_enabled?: boolean
        }
        Update: {
          absence_penalty_pts?: number
          banner_generations_used?: number
          banner_url?: string | null
          checkin_cooldown_min?: number
          city?: string | null
          closed_at?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          description?: string | null
          duration_bonus_cap_pct?: number
          duration_bonus_step_min?: number
          ends_at?: string
          entry_fee?: number
          id?: string
          invite_code?: string | null
          invite_enabled?: boolean
          is_active?: boolean
          is_pro?: boolean
          is_public?: boolean
          max_days_per_week?: number
          member_count?: number
          member_limit?: number
          name?: string
          owner_id?: string | null
          prize_split?: Json
          reactivated_to_id?: string | null
          reactivation_requested?: boolean
          reactivation_requested_at?: string | null
          reactivation_requested_by?: string | null
          starts_at?: string
          status?: string
          streak_bonus_points?: number
          tiebreak_duration_cap_min?: number
          tiebreakers?: Json
          updated_at?: string
          weigh_in_day_of_week?: number
          weigh_in_enabled?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "challenges_reactivated_to_id_fkey"
            columns: ["reactivated_to_id"]
            isOneToOne: false
            referencedRelation: "challenges"
            referencedColumns: ["id"]
          },
        ]
      }
      checkin_comments: {
        Row: {
          body: string
          checkin_id: string
          created_at: string
          flagged_terms: string[] | null
          id: string
          is_bot: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          body: string
          checkin_id: string
          created_at?: string
          flagged_terms?: string[] | null
          id?: string
          is_bot?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          body?: string
          checkin_id?: string
          created_at?: string
          flagged_terms?: string[] | null
          id?: string
          is_bot?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "checkin_comments_checkin_id_fkey"
            columns: ["checkin_id"]
            isOneToOne: false
            referencedRelation: "checkins"
            referencedColumns: ["id"]
          },
        ]
      }
      checkin_moderation_audit: {
        Row: {
          action: string
          actor_id: string | null
          challenge_id: string
          checkin_id: string
          created_at: string
          id: string
          notes: string | null
          reasons: string[]
          reasons_text: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          challenge_id: string
          checkin_id: string
          created_at?: string
          id?: string
          notes?: string | null
          reasons?: string[]
          reasons_text?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          challenge_id?: string
          checkin_id?: string
          created_at?: string
          id?: string
          notes?: string | null
          reasons?: string[]
          reasons_text?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "checkin_moderation_audit_challenge_id_fkey"
            columns: ["challenge_id"]
            isOneToOne: false
            referencedRelation: "challenges"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checkin_moderation_audit_checkin_id_fkey"
            columns: ["checkin_id"]
            isOneToOne: false
            referencedRelation: "checkins"
            referencedColumns: ["id"]
          },
        ]
      }
      checkin_reactions: {
        Row: {
          checkin_id: string
          created_at: string
          emoji: string
          id: string
          user_id: string
        }
        Insert: {
          checkin_id: string
          created_at?: string
          emoji: string
          id?: string
          user_id: string
        }
        Update: {
          checkin_id?: string
          created_at?: string
          emoji?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "checkin_reactions_checkin_id_fkey"
            columns: ["checkin_id"]
            isOneToOne: false
            referencedRelation: "checkins"
            referencedColumns: ["id"]
          },
        ]
      }
      checkin_reports: {
        Row: {
          challenge_id: string
          checkin_id: string
          created_at: string
          id: string
          reason: string
          reporter_id: string
          resolved_at: string | null
          resolved_by: string | null
          resolver_notes: string | null
          status: string
        }
        Insert: {
          challenge_id: string
          checkin_id: string
          created_at?: string
          id?: string
          reason: string
          reporter_id: string
          resolved_at?: string | null
          resolved_by?: string | null
          resolver_notes?: string | null
          status?: string
        }
        Update: {
          challenge_id?: string
          checkin_id?: string
          created_at?: string
          id?: string
          reason?: string
          reporter_id?: string
          resolved_at?: string | null
          resolved_by?: string | null
          resolver_notes?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "checkin_reports_challenge_id_fkey"
            columns: ["challenge_id"]
            isOneToOne: false
            referencedRelation: "challenges"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checkin_reports_checkin_id_fkey"
            columns: ["checkin_id"]
            isOneToOne: false
            referencedRelation: "checkins"
            referencedColumns: ["id"]
          },
        ]
      }
      checkins: {
        Row: {
          ai_notes: string | null
          ai_validated: string
          batch_id: string | null
          caption: string | null
          challenge_id: string
          created_at: string
          duration_min: number
          exercise_type_id: string
          external_id: string | null
          id: string
          location_accuracy_m: number | null
          location_address: string | null
          location_lat: number | null
          location_lng: number | null
          location_name: string | null
          location_source: string | null
          occurred_on: string
          over_limit: boolean
          photo_flag_codes: string[]
          photo_flag_reason: string | null
          photo_flagged: boolean
          photo_source: Database["public"]["Enums"]["photo_source"]
          photo_taken_at: string | null
          photo_url: string | null
          points_awarded: number
          points_base: number
          points_duration_bonus: number
          points_reason: string | null
          points_streak_bonus: number
          source: Database["public"]["Enums"]["checkin_source"]
          started_at_local: string | null
          updated_at: string
          used_daily_pose: boolean
          user_id: string
        }
        Insert: {
          ai_notes?: string | null
          ai_validated?: string
          batch_id?: string | null
          caption?: string | null
          challenge_id: string
          created_at?: string
          duration_min: number
          exercise_type_id: string
          external_id?: string | null
          id?: string
          location_accuracy_m?: number | null
          location_address?: string | null
          location_lat?: number | null
          location_lng?: number | null
          location_name?: string | null
          location_source?: string | null
          occurred_on?: string
          over_limit?: boolean
          photo_flag_codes?: string[]
          photo_flag_reason?: string | null
          photo_flagged?: boolean
          photo_source?: Database["public"]["Enums"]["photo_source"]
          photo_taken_at?: string | null
          photo_url?: string | null
          points_awarded?: number
          points_base?: number
          points_duration_bonus?: number
          points_reason?: string | null
          points_streak_bonus?: number
          source?: Database["public"]["Enums"]["checkin_source"]
          started_at_local?: string | null
          updated_at?: string
          used_daily_pose?: boolean
          user_id: string
        }
        Update: {
          ai_notes?: string | null
          ai_validated?: string
          batch_id?: string | null
          caption?: string | null
          challenge_id?: string
          created_at?: string
          duration_min?: number
          exercise_type_id?: string
          external_id?: string | null
          id?: string
          location_accuracy_m?: number | null
          location_address?: string | null
          location_lat?: number | null
          location_lng?: number | null
          location_name?: string | null
          location_source?: string | null
          occurred_on?: string
          over_limit?: boolean
          photo_flag_codes?: string[]
          photo_flag_reason?: string | null
          photo_flagged?: boolean
          photo_source?: Database["public"]["Enums"]["photo_source"]
          photo_taken_at?: string | null
          photo_url?: string | null
          points_awarded?: number
          points_base?: number
          points_duration_bonus?: number
          points_reason?: string | null
          points_streak_bonus?: number
          source?: Database["public"]["Enums"]["checkin_source"]
          started_at_local?: string | null
          updated_at?: string
          used_daily_pose?: boolean
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "checkins_challenge_id_fkey"
            columns: ["challenge_id"]
            isOneToOne: false
            referencedRelation: "challenges"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checkins_exercise_type_id_fkey"
            columns: ["exercise_type_id"]
            isOneToOne: false
            referencedRelation: "exercise_types"
            referencedColumns: ["id"]
          },
        ]
      }
      daily_poses: {
        Row: {
          challenge_id: string
          chosen_by_user_id: string
          created_at: string
          date: string
          id: string
          pose_emoji: string
          pose_key: string
          pose_name: string
        }
        Insert: {
          challenge_id: string
          chosen_by_user_id: string
          created_at?: string
          date: string
          id?: string
          pose_emoji: string
          pose_key: string
          pose_name: string
        }
        Update: {
          challenge_id?: string
          chosen_by_user_id?: string
          created_at?: string
          date?: string
          id?: string
          pose_emoji?: string
          pose_key?: string
          pose_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "daily_poses_challenge_id_fkey"
            columns: ["challenge_id"]
            isOneToOne: false
            referencedRelation: "challenges"
            referencedColumns: ["id"]
          },
        ]
      }
      duels: {
        Row: {
          accepted_at: string | null
          challenge_id: string
          challenger_id: string
          challenger_points: number | null
          created_at: string
          id: string
          opponent_id: string
          opponent_points: number | null
          points_transferred: number
          resolved_at: string | null
          stake_points: number
          status: string
          tied: boolean
          updated_at: string
          week_start: string
          winner_id: string | null
        }
        Insert: {
          accepted_at?: string | null
          challenge_id: string
          challenger_id: string
          challenger_points?: number | null
          created_at?: string
          id?: string
          opponent_id: string
          opponent_points?: number | null
          points_transferred?: number
          resolved_at?: string | null
          stake_points: number
          status?: string
          tied?: boolean
          updated_at?: string
          week_start: string
          winner_id?: string | null
        }
        Update: {
          accepted_at?: string | null
          challenge_id?: string
          challenger_id?: string
          challenger_points?: number | null
          created_at?: string
          id?: string
          opponent_id?: string
          opponent_points?: number | null
          points_transferred?: number
          resolved_at?: string | null
          stake_points?: number
          status?: string
          tied?: boolean
          updated_at?: string
          week_start?: string
          winner_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "duels_challenge_id_fkey"
            columns: ["challenge_id"]
            isOneToOne: false
            referencedRelation: "challenges"
            referencedColumns: ["id"]
          },
        ]
      }
      exercise_presets: {
        Row: {
          category: string
          created_at: string
          icon: string | null
          id: string
          name: string
          slug: string
          sort_order: number
          suggested_min_minutes: number
          suggested_points: number
          updated_at: string
        }
        Insert: {
          category: string
          created_at?: string
          icon?: string | null
          id?: string
          name: string
          slug: string
          sort_order?: number
          suggested_min_minutes?: number
          suggested_points?: number
          updated_at?: string
        }
        Update: {
          category?: string
          created_at?: string
          icon?: string | null
          id?: string
          name?: string
          slug?: string
          sort_order?: number
          suggested_min_minutes?: number
          suggested_points?: number
          updated_at?: string
        }
        Relationships: []
      }
      exercise_types: {
        Row: {
          challenge_id: string
          created_at: string
          icon: string | null
          id: string
          min_minutes: number
          name: string
          points: number
          sort_order: number
          updated_at: string
        }
        Insert: {
          challenge_id: string
          created_at?: string
          icon?: string | null
          id?: string
          min_minutes?: number
          name: string
          points?: number
          sort_order?: number
          updated_at?: string
        }
        Update: {
          challenge_id?: string
          created_at?: string
          icon?: string | null
          id?: string
          min_minutes?: number
          name?: string
          points?: number
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "exercise_types_challenge_id_fkey"
            columns: ["challenge_id"]
            isOneToOne: false
            referencedRelation: "challenges"
            referencedColumns: ["id"]
          },
        ]
      }
      fitcoin_transactions: {
        Row: {
          created_at: string
          delta: number
          id: string
          reason: string
          stripe_session_id: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          delta: number
          id?: string
          reason: string
          stripe_session_id?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          delta?: number
          id?: string
          reason?: string
          stripe_session_id?: string | null
          user_id?: string
        }
        Relationships: []
      }
      follows: {
        Row: {
          created_at: string
          follower_id: string
          following_id: string
          id: string
        }
        Insert: {
          created_at?: string
          follower_id: string
          following_id: string
          id?: string
        }
        Update: {
          created_at?: string
          follower_id?: string
          following_id?: string
          id?: string
        }
        Relationships: []
      }
      invite_requests: {
        Row: {
          created_at: string
          email: string
          id: string
          invite_id: string | null
          message: string | null
          name: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          invite_id?: string | null
          message?: string | null
          name?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          invite_id?: string | null
          message?: string | null
          name?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "invite_requests_invite_id_fkey"
            columns: ["invite_id"]
            isOneToOne: false
            referencedRelation: "invites"
            referencedColumns: ["id"]
          },
        ]
      }
      invites: {
        Row: {
          code: string
          created_at: string
          created_by: string | null
          expires_at: string | null
          id: string
          is_used: boolean
          updated_at: string
          used_at: string | null
          used_by: string | null
        }
        Insert: {
          code: string
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          id?: string
          is_used?: boolean
          updated_at?: string
          used_at?: string | null
          used_by?: string | null
        }
        Update: {
          code?: string
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          id?: string
          is_used?: boolean
          updated_at?: string
          used_at?: string | null
          used_by?: string | null
        }
        Relationships: []
      }
      meal_logs: {
        Row: {
          calories: number
          carbs_g: number
          created_at: string
          fat_g: number
          food_description: string
          id: string
          image_url: string | null
          meal_type: string
          occurred_on: string
          protein_g: number
          skipped: boolean
          source: string
          updated_at: string
          user_id: string
        }
        Insert: {
          calories?: number
          carbs_g?: number
          created_at?: string
          fat_g?: number
          food_description: string
          id?: string
          image_url?: string | null
          meal_type: string
          occurred_on?: string
          protein_g?: number
          skipped?: boolean
          source?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          calories?: number
          carbs_g?: number
          created_at?: string
          fat_g?: number
          food_description?: string
          id?: string
          image_url?: string | null
          meal_type?: string
          occurred_on?: string
          protein_g?: number
          skipped?: boolean
          source?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      mentions: {
        Row: {
          author_id: string
          created_at: string
          id: string
          mentioned_user_id: string
          source_id: string
          source_type: string
        }
        Insert: {
          author_id: string
          created_at?: string
          id?: string
          mentioned_user_id: string
          source_id: string
          source_type: string
        }
        Update: {
          author_id?: string
          created_at?: string
          id?: string
          mentioned_user_id?: string
          source_id?: string
          source_type?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          actor_id: string | null
          body: string | null
          created_at: string
          id: string
          kind: string
          link: string | null
          read_at: string | null
          source_id: string | null
          source_type: string | null
          title: string
          user_id: string
        }
        Insert: {
          actor_id?: string | null
          body?: string | null
          created_at?: string
          id?: string
          kind: string
          link?: string | null
          read_at?: string | null
          source_id?: string | null
          source_type?: string | null
          title: string
          user_id: string
        }
        Update: {
          actor_id?: string | null
          body?: string | null
          created_at?: string
          id?: string
          kind?: string
          link?: string | null
          read_at?: string | null
          source_id?: string | null
          source_type?: string | null
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      platform_settings: {
        Row: {
          access_mode: string
          id: boolean
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          access_mode?: string
          id?: boolean
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          access_mode?: string
          id?: boolean
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      pokes: {
        Row: {
          challenge_id: string
          created_at: string
          id: string
          poker_id: string
          post_id: string | null
          roast_text: string
          target_id: string
        }
        Insert: {
          challenge_id: string
          created_at?: string
          id?: string
          poker_id: string
          post_id?: string | null
          roast_text: string
          target_id: string
        }
        Update: {
          challenge_id?: string
          created_at?: string
          id?: string
          poker_id?: string
          post_id?: string | null
          roast_text?: string
          target_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pokes_challenge_id_fkey"
            columns: ["challenge_id"]
            isOneToOne: false
            referencedRelation: "challenges"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pokes_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      post_comments: {
        Row: {
          body: string
          created_at: string
          flagged_terms: string[] | null
          id: string
          is_bot: boolean
          post_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          body: string
          created_at?: string
          flagged_terms?: string[] | null
          id?: string
          is_bot?: boolean
          post_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          body?: string
          created_at?: string
          flagged_terms?: string[] | null
          id?: string
          is_bot?: boolean
          post_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_comments_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      post_reactions: {
        Row: {
          created_at: string
          emoji: string
          id: string
          post_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          emoji: string
          id?: string
          post_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          emoji?: string
          id?: string
          post_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_reactions_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      posts: {
        Row: {
          body: string
          challenge_id: string | null
          created_at: string
          id: string
          is_system: boolean
          media_url: string | null
          system_kind: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          body: string
          challenge_id?: string | null
          created_at?: string
          id?: string
          is_system?: boolean
          media_url?: string | null
          system_kind?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          body?: string
          challenge_id?: string | null
          created_at?: string
          id?: string
          is_system?: boolean
          media_url?: string | null
          system_kind?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "posts_challenge_id_fkey"
            columns: ["challenge_id"]
            isOneToOne: false
            referencedRelation: "challenges"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          affiliate_balance: number
          avatar_border_until: string | null
          avatar_url: string | null
          bio: string | null
          blocked_user_ids: string[]
          created_at: string
          display_name: string
          equipped_border: string
          equipped_border_until: string | null
          equipped_title: string
          equipped_title_until: string | null
          favorite_sport: string | null
          fitcoins_balance: number
          height_cm: number | null
          id: string
          instagram_handle: string | null
          is_bot: boolean
          is_pro: boolean
          location: string | null
          metrics_updated_at: string | null
          notification_prefs: Json
          pro_until: string | null
          referred_by_admin_id: string | null
          sex: Database["public"]["Enums"]["sex_enum"] | null
          share_composition: boolean
          stripe_customer_id: string | null
          tiktok_handle: string | null
          twitter_handle: string | null
          unlocked_emojis: string[]
          updated_at: string
          username: string | null
          username_updated_at: string | null
          weekly_goal: number
          weight_kg: number | null
        }
        Insert: {
          affiliate_balance?: number
          avatar_border_until?: string | null
          avatar_url?: string | null
          bio?: string | null
          blocked_user_ids?: string[]
          created_at?: string
          display_name: string
          equipped_border?: string
          equipped_border_until?: string | null
          equipped_title?: string
          equipped_title_until?: string | null
          favorite_sport?: string | null
          fitcoins_balance?: number
          height_cm?: number | null
          id: string
          instagram_handle?: string | null
          is_bot?: boolean
          is_pro?: boolean
          location?: string | null
          metrics_updated_at?: string | null
          notification_prefs?: Json
          pro_until?: string | null
          referred_by_admin_id?: string | null
          sex?: Database["public"]["Enums"]["sex_enum"] | null
          share_composition?: boolean
          stripe_customer_id?: string | null
          tiktok_handle?: string | null
          twitter_handle?: string | null
          unlocked_emojis?: string[]
          updated_at?: string
          username?: string | null
          username_updated_at?: string | null
          weekly_goal?: number
          weight_kg?: number | null
        }
        Update: {
          affiliate_balance?: number
          avatar_border_until?: string | null
          avatar_url?: string | null
          bio?: string | null
          blocked_user_ids?: string[]
          created_at?: string
          display_name?: string
          equipped_border?: string
          equipped_border_until?: string | null
          equipped_title?: string
          equipped_title_until?: string | null
          favorite_sport?: string | null
          fitcoins_balance?: number
          height_cm?: number | null
          id?: string
          instagram_handle?: string | null
          is_bot?: boolean
          is_pro?: boolean
          location?: string | null
          metrics_updated_at?: string | null
          notification_prefs?: Json
          pro_until?: string | null
          referred_by_admin_id?: string | null
          sex?: Database["public"]["Enums"]["sex_enum"] | null
          share_composition?: boolean
          stripe_customer_id?: string | null
          tiktok_handle?: string | null
          twitter_handle?: string | null
          unlocked_emojis?: string[]
          updated_at?: string
          username?: string | null
          username_updated_at?: string | null
          weekly_goal?: number
          weight_kg?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_referred_by_admin_id_fkey"
            columns: ["referred_by_admin_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      reactivation_requests: {
        Row: {
          challenge_id: string
          created_at: string
          created_by: string | null
          decided_at: string | null
          decided_by: string | null
          id: string
          requested_end_date: string
          requested_start_date: string
          requester_email: string
          requester_name: string
          requester_whatsapp: string
          status: string
          updated_at: string
        }
        Insert: {
          challenge_id: string
          created_at?: string
          created_by?: string | null
          decided_at?: string | null
          decided_by?: string | null
          id?: string
          requested_end_date: string
          requested_start_date: string
          requester_email: string
          requester_name: string
          requester_whatsapp: string
          status?: string
          updated_at?: string
        }
        Update: {
          challenge_id?: string
          created_at?: string
          created_by?: string | null
          decided_at?: string | null
          decided_by?: string | null
          id?: string
          requested_end_date?: string
          requested_start_date?: string
          requester_email?: string
          requester_name?: string
          requester_whatsapp?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "reactivation_requests_challenge_id_fkey"
            columns: ["challenge_id"]
            isOneToOne: false
            referencedRelation: "challenges"
            referencedColumns: ["id"]
          },
        ]
      }
      roulette_spins: {
        Row: {
          challenge_id: string
          created_at: string
          eligible: boolean
          id: string
          points_awarded: number
          prize_key: string | null
          prize_label: string | null
          prize_tier: string | null
          spun_at: string | null
          user_id: string
          week_start: string
        }
        Insert: {
          challenge_id: string
          created_at?: string
          eligible: boolean
          id?: string
          points_awarded?: number
          prize_key?: string | null
          prize_label?: string | null
          prize_tier?: string | null
          spun_at?: string | null
          user_id: string
          week_start: string
        }
        Update: {
          challenge_id?: string
          created_at?: string
          eligible?: boolean
          id?: string
          points_awarded?: number
          prize_key?: string | null
          prize_label?: string | null
          prize_tier?: string | null
          spun_at?: string | null
          user_id?: string
          week_start?: string
        }
        Relationships: [
          {
            foreignKeyName: "roulette_spins_challenge_id_fkey"
            columns: ["challenge_id"]
            isOneToOne: false
            referencedRelation: "challenges"
            referencedColumns: ["id"]
          },
        ]
      }
      stripe_events: {
        Row: {
          id: string
          payload: Json
          processed_at: string | null
          received_at: string
          type: string
        }
        Insert: {
          id: string
          payload: Json
          processed_at?: string | null
          received_at?: string
          type: string
        }
        Update: {
          id?: string
          payload?: Json
          processed_at?: string | null
          received_at?: string
          type?: string
        }
        Relationships: []
      }
      user_badges: {
        Row: {
          badge_id: string
          challenge_id: string | null
          earned_at: string
          id: string
          user_id: string
        }
        Insert: {
          badge_id: string
          challenge_id?: string | null
          earned_at?: string
          id?: string
          user_id: string
        }
        Update: {
          badge_id?: string
          challenge_id?: string | null
          earned_at?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_badges_badge_id_fkey"
            columns: ["badge_id"]
            isOneToOne: false
            referencedRelation: "badges"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_badges_challenge_id_fkey"
            columns: ["challenge_id"]
            isOneToOne: false
            referencedRelation: "challenges"
            referencedColumns: ["id"]
          },
        ]
      }
      user_contacts: {
        Row: {
          created_at: string
          email: string | null
          phone: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          phone?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          email?: string | null
          phone?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      user_warnings: {
        Row: {
          created_at: string
          id: string
          source_id: string
          source_type: string
          terms: string[]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          source_id: string
          source_type: string
          terms: string[]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          source_id?: string
          source_type?: string
          terms?: string[]
          user_id?: string
        }
        Relationships: []
      }
      withdraw_requests: {
        Row: {
          amount: number
          created_at: string
          id: string
          notes: string | null
          paid_at: string | null
          paid_by: string | null
          pix_key: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          notes?: string | null
          paid_at?: string | null
          paid_by?: string | null
          pix_key: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          notes?: string | null
          paid_at?: string | null
          paid_by?: string | null
          pix_key?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "withdraw_requests_paid_by_fkey"
            columns: ["paid_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "withdraw_requests_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      ai_usage_count_month: {
        Args: { _kind: string; _user_id: string }
        Returns: number
      }
      ai_usage_count_today: {
        Args: { _kind: string; _user_id: string }
        Returns: number
      }
      award_badge: {
        Args: { _challenge_id?: string; _slug: string; _user_id: string }
        Returns: boolean
      }
      close_expired_challenges: { Args: never; Returns: number }
      credit_affiliate_commission: {
        Args: {
          _gross_amount: number
          _payer_id: string
          _source_type: string
          _stripe_session: string
        }
        Returns: number
      }
      credit_fitcoins: {
        Args: {
          _amount: number
          _reason: string
          _stripe_session?: string
          _user_id: string
        }
        Returns: number
      }
      generate_invite_code: { Args: never; Returns: string }
      get_active_ai_config: {
        Args: never
        Returns: {
          api_key: string
          image_model_name: string
          model_name: string
          provider: string
          tavily_api_key: string
        }[]
      }
      get_challenge_by_invite: {
        Args: { _code: string }
        Returns: {
          description: string
          ends_at: string
          id: string
          is_active: boolean
          name: string
          starts_at: string
        }[]
      }
      grant_pro: { Args: { _days: number; _user_id: string }; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_challenge_admin: {
        Args: { _challenge_id: string; _user_id: string }
        Returns: boolean
      }
      is_challenge_member: {
        Args: { _challenge_id: string; _user_id: string }
        Returns: boolean
      }
      is_invite_available: { Args: { _code: string }; Returns: boolean }
      is_super_admin: { Args: { _user_id: string }; Returns: boolean }
      is_username_available: { Args: { _username: string }; Returns: boolean }
      join_challenge_by_invite: { Args: { _code: string }; Returns: string }
      leaderboard_top_v1: {
        Args: { _challenge_id: string; _limit?: number }
        Returns: {
          avatar_url: string
          counted_days: number
          display_name: string
          total_points: number
          user_id: string
          username: string
        }[]
      }
      list_challenge_members_v2: {
        Args: { _challenge_id: string }
        Returns: {
          avatar_url: string
          display_name: string
          user_id: string
          username: string
        }[]
      }
      mark_withdraw_paid: { Args: { _id: string }; Returns: undefined }
      recalc_streak: {
        Args: { _challenge_id: string; _user_id: string }
        Returns: undefined
      }
      recalc_weigh_in_streak: {
        Args: { _challenge_id: string; _user_id: string }
        Returns: undefined
      }
      register_poke: {
        Args: { _challenge_id: string; _roast: string; _target_id: string }
        Returns: {
          coach_id: string
          post_id: string
        }[]
      }
      request_withdraw: { Args: { _pix_key: string }; Returns: string }
      revoke_pro: { Args: { _user_id: string }; Returns: undefined }
      spend_fitcoins: {
        Args: { _amount: number; _reason: string; _user_id: string }
        Returns: boolean
      }
      was_perfect_last_week: {
        Args: { _challenge_id: string; _user_id: string }
        Returns: {
          counted_days: number
          eligible: boolean
          required_days: number
          week_start: string
        }[]
      }
      weekly_counted_days: {
        Args: { _challenge_id: string; _on: string; _user_id: string }
        Returns: number
      }
    }
    Enums: {
      app_role: "admin" | "member" | "super_admin"
      checkin_source: "manual" | "strava" | "health"
      photo_source: "camera" | "gallery" | "unknown"
      sex_enum: "M" | "F"
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
      app_role: ["admin", "member", "super_admin"],
      checkin_source: ["manual", "strava", "health"],
      photo_source: ["camera", "gallery", "unknown"],
      sex_enum: ["M", "F"],
    },
  },
} as const
