export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          full_name: string | null;
          role: "coach" | "trainee";
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          full_name?: string | null;
          role?: "coach" | "trainee";
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          full_name?: string | null;
          role?: "coach" | "trainee";
          updated_at?: string;
        };
        Relationships: [];
      };
      clients: {
        Row: {
          id: string;
          coach_id: string;
          client_user_id: string | null;
          name: string;
          email: string | null;
          age: number | null;
          goal: string | null;
          notes: string | null;
          status: "active" | "paused" | "archived";
          peer_activity_sharing_enabled: boolean;
          invited_at: string | null;
          invitation_accepted_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          coach_id: string;
          client_user_id?: string | null;
          name: string;
          email?: string | null;
          age?: number | null;
          goal?: string | null;
          notes?: string | null;
          status?: "active" | "paused" | "archived";
          peer_activity_sharing_enabled?: boolean;
          invited_at?: string | null;
          invitation_accepted_at?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["clients"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "clients_coach_id_fkey";
            columns: ["coach_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          }
        ];
      };
      exercises: {
        Row: {
          id: string;
          coach_id: string;
          name: string;
          category: string | null;
          difficulty: number;
          thumbnail_url: string | null;
          video_url: string | null;
          equipment: string | null;
          movement_pattern: string | null;
          primary_muscles: string[];
          archived_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          coach_id: string;
          name: string;
          category?: string | null;
          difficulty?: number;
          thumbnail_url?: string | null;
          video_url?: string | null;
          equipment?: string | null;
          movement_pattern?: string | null;
          primary_muscles?: string[];
          archived_at?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["exercises"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "exercises_coach_id_fkey";
            columns: ["coach_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          }
        ];
      };
      workout_routines: {
        Row: {
          id: string;
          coach_id: string;
          name: string;
          description: string | null;
          routine_type: "circuit" | "individual" | "gym";
          default_cycles: number;
          archived_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          coach_id: string;
          name: string;
          description?: string | null;
          routine_type?: "circuit" | "individual" | "gym";
          default_cycles?: number;
          archived_at?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["workout_routines"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "workout_routines_coach_id_fkey";
            columns: ["coach_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          }
        ];
      };
      routine_exercises: {
        Row: {
          id: string;
          routine_id: string;
          exercise_id: string;
          position: number;
          sets: number;
          reps: string;
          rest_seconds: number | null;
          notes: string | null;
          created_at: string;
        };
        Insert: {
          routine_id: string;
          exercise_id: string;
          position?: number;
          sets?: number;
          reps: string;
          rest_seconds?: number | null;
          notes?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["routine_exercises"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "routine_exercises_exercise_id_fkey";
            columns: ["exercise_id"];
            isOneToOne: false;
            referencedRelation: "exercises";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "routine_exercises_routine_id_fkey";
            columns: ["routine_id"];
            isOneToOne: false;
            referencedRelation: "workout_routines";
            referencedColumns: ["id"];
          }
        ];
      };
      client_routines: {
        Row: {
          id: string;
          coach_id: string;
          client_id: string;
          routine_id: string;
          assigned_at: string;
          status: "active" | "completed" | "paused";
          notes: string | null;
        };
        Insert: {
          coach_id: string;
          client_id: string;
          routine_id: string;
          status?: "active" | "completed" | "paused";
          notes?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["client_routines"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "client_routines_client_id_fkey";
            columns: ["client_id"];
            isOneToOne: false;
            referencedRelation: "clients";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "client_routines_routine_id_fkey";
            columns: ["routine_id"];
            isOneToOne: false;
            referencedRelation: "workout_routines";
            referencedColumns: ["id"];
          }
        ];
      };
      workout_logs: {
        Row: {
          id: string;
          coach_id: string;
          client_id: string;
          routine_id: string | null;
          trained_on: string;
          notes: string | null;
          duration_minutes: number | null;
          created_at: string;
        };
        Insert: {
          coach_id: string;
          client_id: string;
          routine_id?: string | null;
          trained_on: string;
          notes?: string | null;
          duration_minutes?: number | null;
        };
        Update: Partial<Database["public"]["Tables"]["workout_logs"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "workout_logs_client_id_fkey";
            columns: ["client_id"];
            isOneToOne: false;
            referencedRelation: "clients";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "workout_logs_routine_id_fkey";
            columns: ["routine_id"];
            isOneToOne: false;
            referencedRelation: "workout_routines";
            referencedColumns: ["id"];
          }
        ];
      };
      activities: {
        Row: {
          id: string;
          coach_id: string;
          name: string;
          description: string | null;
          thumbnail_url: string | null;
          tracked_metrics: Database["public"]["Enums"]["activity_metric"][];
          required_metrics: Database["public"]["Enums"]["activity_metric"][];
          default_targets: Json;
          archived_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          coach_id: string;
          name: string;
          description?: string | null;
          thumbnail_url?: string | null;
          tracked_metrics?: Database["public"]["Enums"]["activity_metric"][];
          required_metrics?: Database["public"]["Enums"]["activity_metric"][];
          default_targets?: Json;
          archived_at?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["activities"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "activities_coach_id_fkey";
            columns: ["coach_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          }
        ];
      };
      client_activities: {
        Row: {
          id: string;
          coach_id: string;
          client_id: string;
          activity_id: string;
          assignment_mode: Database["public"]["Enums"]["activity_assignment_mode"];
          planned_for: string | null;
          tracked_metrics: Database["public"]["Enums"]["activity_metric"][];
          required_metrics: Database["public"]["Enums"]["activity_metric"][];
          targets: Json;
          assigned_at: string;
          status: "active" | "completed" | "paused";
          notes: string | null;
        };
        Insert: {
          coach_id: string;
          client_id: string;
          activity_id: string;
          assignment_mode?: Database["public"]["Enums"]["activity_assignment_mode"];
          planned_for?: string | null;
          tracked_metrics?: Database["public"]["Enums"]["activity_metric"][];
          required_metrics?: Database["public"]["Enums"]["activity_metric"][];
          targets?: Json;
          status?: "active" | "completed" | "paused";
          notes?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["client_activities"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "client_activities_client_id_fkey";
            columns: ["client_id"];
            isOneToOne: false;
            referencedRelation: "clients";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "client_activities_activity_id_fkey";
            columns: ["activity_id"];
            isOneToOne: false;
            referencedRelation: "activities";
            referencedColumns: ["id"];
          }
        ];
      };
      activity_logs: {
        Row: {
          id: string;
          coach_id: string;
          client_id: string;
          activity_id: string;
          assignment_id: string | null;
          performed_on: string;
          duration_minutes: number | null;
          distance_km: number | null;
          elevation_gain_m: number | null;
          calories_burned: number | null;
          perceived_intensity: number | null;
          notes: string | null;
          created_at: string;
        };
        Insert: {
          coach_id: string;
          client_id: string;
          activity_id: string;
          assignment_id?: string | null;
          performed_on: string;
          duration_minutes?: number | null;
          distance_km?: number | null;
          elevation_gain_m?: number | null;
          calories_burned?: number | null;
          perceived_intensity?: number | null;
          notes?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["activity_logs"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "activity_logs_client_id_fkey";
            columns: ["client_id"];
            isOneToOne: false;
            referencedRelation: "clients";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "activity_logs_activity_id_fkey";
            columns: ["activity_id"];
            isOneToOne: false;
            referencedRelation: "activities";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "activity_logs_assignment_id_fkey";
            columns: ["assignment_id"];
            isOneToOne: false;
            referencedRelation: "client_activities";
            referencedColumns: ["id"];
          }
        ];
      };
      body_progress_entries: {
        Row: {
          id: string;
          coach_id: string;
          client_id: string;
          recorded_on: string;
          body_weight: number;
          body_fat_percentage: number | null;
          muscle_mass_percentage: number | null;
          waist: number | null;
          chest: number | null;
          arms: number | null;
          legs: number | null;
          notes: string | null;
          recorded_by: string | null;
          created_at: string;
        };
        Insert: {
          coach_id: string;
          client_id: string;
          recorded_on: string;
          body_weight: number;
          body_fat_percentage?: number | null;
          muscle_mass_percentage?: number | null;
          waist?: number | null;
          chest?: number | null;
          arms?: number | null;
          legs?: number | null;
          notes?: string | null;
          recorded_by?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["body_progress_entries"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "body_progress_entries_client_id_fkey";
            columns: ["client_id"];
            isOneToOne: false;
            referencedRelation: "clients";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "body_progress_entries_recorded_by_fkey";
            columns: ["recorded_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          }
        ];
      };
    };
    Views: {};
    Functions: {
      get_trainee_social_feed: {
        Args: Record<string, never>;
        Returns: {
          client_id: string;
          name: string;
          is_viewer: boolean;
          sharing_enabled: boolean;
          activity_visible: boolean;
          current_streak_weeks: number | null;
          trained_this_week: boolean | null;
          recent_trainings: Json;
        }[];
      };
      set_peer_activity_sharing: {
        Args: {
          target_enabled: boolean;
        };
        Returns: boolean;
      };
      create_assigned_activity_log: {
        Args: {
          target_assignment_id: string;
          target_performed_on: string;
          target_duration_minutes?: number | null;
          target_distance_km?: number | null;
          target_elevation_gain_m?: number | null;
          target_calories_burned?: number | null;
          target_perceived_intensity?: number | null;
          target_notes?: string | null;
        };
        Returns: string;
      };
    };
    Enums: {
      client_status: "active" | "paused" | "archived";
      assignment_status: "active" | "completed" | "paused";
      account_role: "coach" | "trainee";
      activity_metric:
        | "duration_minutes"
        | "distance_km"
        | "elevation_gain_m"
        | "calories_burned"
        | "perceived_intensity";
      activity_assignment_mode: "repeatable" | "one_time";
    };
    CompositeTypes: {};
  };
};
