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
          description: string | null;
          difficulty: number;
          thumbnail_url: string | null;
          video_url: string | null;
          equipment: string | null;
          movement_pattern: string | null;
          primary_muscles: string[];
          is_archived: boolean;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          coach_id: string;
          name: string;
          category?: string | null;
          description?: string | null;
          difficulty?: number;
          thumbnail_url?: string | null;
          video_url?: string | null;
          equipment?: string | null;
          movement_pattern?: string | null;
          primary_muscles?: string[];
          is_archived?: boolean;
          notes?: string | null;
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
      exercise_progressions: {
        Row: {
          id: string;
          coach_id: string;
          exercise_id: string;
          related_exercise_id: string;
          relationship: "easier" | "harder";
          created_at: string;
        };
        Insert: {
          coach_id: string;
          exercise_id: string;
          related_exercise_id: string;
          relationship: "easier" | "harder";
        };
        Update: Partial<Database["public"]["Tables"]["exercise_progressions"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "exercise_progressions_exercise_id_fkey";
            columns: ["exercise_id"];
            isOneToOne: false;
            referencedRelation: "exercises";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "exercise_progressions_related_exercise_id_fkey";
            columns: ["related_exercise_id"];
            isOneToOne: false;
            referencedRelation: "exercises";
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
          created_at: string;
          updated_at: string;
        };
        Insert: {
          coach_id: string;
          name: string;
          description?: string | null;
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
          target_weight: string | null;
          rest_seconds: number | null;
          notes: string | null;
          created_at: string;
        };
        Insert: {
          routine_id: string;
          exercise_id: string;
          position?: number;
          sets: number;
          reps: string;
          target_weight?: string | null;
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
          created_at: string;
        };
        Insert: {
          coach_id: string;
          client_id: string;
          routine_id?: string | null;
          trained_on: string;
          notes?: string | null;
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
      body_progress_entries: {
        Row: {
          id: string;
          coach_id: string;
          client_id: string;
          recorded_on: string;
          body_weight: number;
          body_fat_percentage: number | null;
          waist: number | null;
          chest: number | null;
          arms: number | null;
          legs: number | null;
          notes: string | null;
          created_at: string;
        };
        Insert: {
          coach_id: string;
          client_id: string;
          recorded_on: string;
          body_weight: number;
          body_fat_percentage?: number | null;
          waist?: number | null;
          chest?: number | null;
          arms?: number | null;
          legs?: number | null;
          notes?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["body_progress_entries"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "body_progress_entries_client_id_fkey";
            columns: ["client_id"];
            isOneToOne: false;
            referencedRelation: "clients";
            referencedColumns: ["id"];
          }
        ];
      };
    };
    Views: {};
    Functions: {};
    Enums: {
      client_status: "active" | "paused" | "archived";
      assignment_status: "active" | "completed" | "paused";
      account_role: "coach" | "trainee";
    };
    CompositeTypes: {};
  };
};
