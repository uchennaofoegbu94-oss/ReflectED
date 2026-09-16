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
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
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
  public: {
    Tables: {
      academic_sessions: {
        Row: {
          created_at: string
          end_date: string
          id: string
          is_active: boolean | null
          name: string
          school_id: string | null
          start_date: string
        }
        Insert: {
          created_at?: string
          end_date: string
          id?: string
          is_active?: boolean | null
          name: string
          school_id?: string | null
          start_date: string
        }
        Update: {
          created_at?: string
          end_date?: string
          id?: string
          is_active?: boolean | null
          name?: string
          school_id?: string | null
          start_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "academic_sessions_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      assessment_scores: {
        Row: {
          ca1: number | null
          ca2: number | null
          ca3: number | null
          created_at: string
          entered_by: string | null
          exam: number | null
          grade: string | null
          id: string
          remarks: string | null
          school_id: string | null
          student_id: string
          subject_id: string
          term_id: string
          total: number | null
          updated_at: string
        }
        Insert: {
          ca1?: number | null
          ca2?: number | null
          ca3?: number | null
          created_at?: string
          entered_by?: string | null
          exam?: number | null
          grade?: string | null
          id?: string
          remarks?: string | null
          school_id?: string | null
          student_id: string
          subject_id: string
          term_id: string
          total?: number | null
          updated_at?: string
        }
        Update: {
          ca1?: number | null
          ca2?: number | null
          ca3?: number | null
          created_at?: string
          entered_by?: string | null
          exam?: number | null
          grade?: string | null
          id?: string
          remarks?: string | null
          school_id?: string | null
          student_id?: string
          subject_id?: string
          term_id?: string
          total?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "assessment_scores_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assessment_scores_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assessment_scores_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assessment_scores_term_id_fkey"
            columns: ["term_id"]
            isOneToOne: false
            referencedRelation: "terms"
            referencedColumns: ["id"]
          },
        ]
      }
      assessment_scores_tracker: {
        Row: {
          academic_session_id: string | null
          assessment_id: string
          assessment_type: string
          created_at: string | null
          id: string
          percentage: number | null
          recorded_at: string | null
          recorded_by: string | null
          school_id: string | null
          score: number
          student_id: string
          term_id: string | null
          total_marks: number
          updated_at: string | null
        }
        Insert: {
          academic_session_id?: string | null
          assessment_id: string
          assessment_type: string
          created_at?: string | null
          id?: string
          percentage?: number | null
          recorded_at?: string | null
          recorded_by?: string | null
          school_id?: string | null
          score?: number
          student_id: string
          term_id?: string | null
          total_marks?: number
          updated_at?: string | null
        }
        Update: {
          academic_session_id?: string | null
          assessment_id?: string
          assessment_type?: string
          created_at?: string | null
          id?: string
          percentage?: number | null
          recorded_at?: string | null
          recorded_by?: string | null
          school_id?: string | null
          score?: number
          student_id?: string
          term_id?: string | null
          total_marks?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "assessment_scores_tracker_academic_session_id_fkey"
            columns: ["academic_session_id"]
            isOneToOne: false
            referencedRelation: "academic_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assessment_scores_tracker_recorded_by_fkey"
            columns: ["recorded_by"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assessment_scores_tracker_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assessment_scores_tracker_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assessment_scores_tracker_term_id_fkey"
            columns: ["term_id"]
            isOneToOne: false
            referencedRelation: "terms"
            referencedColumns: ["id"]
          },
        ]
      }
      assignment_notifications: {
        Row: {
          created_at: string | null
          id: string
          is_read: boolean | null
          message: string
          notification_type: string
          reference_id: string
          reference_type: string
          school_id: string | null
          title: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_read?: boolean | null
          message: string
          notification_type: string
          reference_id: string
          reference_type: string
          school_id?: string | null
          title: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          is_read?: boolean | null
          message?: string
          notification_type?: string
          reference_id?: string
          reference_type?: string
          school_id?: string | null
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "assignment_notifications_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      assignments: {
        Row: {
          allow_late_submission: boolean | null
          allowed_file_types: Json | null
          assignment_type: Database["public"]["Enums"]["assignment_type"] | null
          broadsheet_field_id: string | null
          classroom_id: string
          content_type:
            | Database["public"]["Enums"]["assignment_content_type"]
            | null
          created_at: string
          created_by: string
          due_date: string | null
          due_time: string | null
          id: string
          instructions: string | null
          is_archived: boolean
          is_deleted: boolean | null
          is_locked: boolean
          late_penalty_percent: number | null
          points: number | null
          rubric: Json | null
          school_id: string | null
          status: Database["public"]["Enums"]["assignment_status"] | null
          title: string
          topic: string | null
          total_marks: number | null
          updated_at: string
        }
        Insert: {
          allow_late_submission?: boolean | null
          allowed_file_types?: Json | null
          assignment_type?:
            | Database["public"]["Enums"]["assignment_type"]
            | null
          broadsheet_field_id?: string | null
          classroom_id: string
          content_type?:
            | Database["public"]["Enums"]["assignment_content_type"]
            | null
          created_at?: string
          created_by: string
          due_date?: string | null
          due_time?: string | null
          id?: string
          instructions?: string | null
          is_archived?: boolean
          is_deleted?: boolean | null
          is_locked?: boolean
          late_penalty_percent?: number | null
          points?: number | null
          rubric?: Json | null
          school_id?: string | null
          status?: Database["public"]["Enums"]["assignment_status"] | null
          title: string
          topic?: string | null
          total_marks?: number | null
          updated_at?: string
        }
        Update: {
          allow_late_submission?: boolean | null
          allowed_file_types?: Json | null
          assignment_type?:
            | Database["public"]["Enums"]["assignment_type"]
            | null
          broadsheet_field_id?: string | null
          classroom_id?: string
          content_type?:
            | Database["public"]["Enums"]["assignment_content_type"]
            | null
          created_at?: string
          created_by?: string
          due_date?: string | null
          due_time?: string | null
          id?: string
          instructions?: string | null
          is_archived?: boolean
          is_deleted?: boolean | null
          is_locked?: boolean
          late_penalty_percent?: number | null
          points?: number | null
          rubric?: Json | null
          school_id?: string | null
          status?: Database["public"]["Enums"]["assignment_status"] | null
          title?: string
          topic?: string | null
          total_marks?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "assignments_broadsheet_field_id_fkey"
            columns: ["broadsheet_field_id"]
            isOneToOne: false
            referencedRelation: "broadsheet_fields"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assignments_classroom_id_fkey"
            columns: ["classroom_id"]
            isOneToOne: false
            referencedRelation: "classrooms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assignments_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      attachments: {
        Row: {
          assignment_id: string | null
          created_at: string
          id: string
          name: string
          post_id: string | null
          school_id: string | null
          size_bytes: number | null
          submission_id: string | null
          type: Database["public"]["Enums"]["attachment_type"]
          url: string
        }
        Insert: {
          assignment_id?: string | null
          created_at?: string
          id?: string
          name: string
          post_id?: string | null
          school_id?: string | null
          size_bytes?: number | null
          submission_id?: string | null
          type: Database["public"]["Enums"]["attachment_type"]
          url: string
        }
        Update: {
          assignment_id?: string | null
          created_at?: string
          id?: string
          name?: string
          post_id?: string | null
          school_id?: string | null
          size_bytes?: number | null
          submission_id?: string | null
          type?: Database["public"]["Enums"]["attachment_type"]
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "attachments_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "stream_posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attachments_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_attachments_assignment"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "assignments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_attachments_submission"
            columns: ["submission_id"]
            isOneToOne: false
            referencedRelation: "submissions"
            referencedColumns: ["id"]
          },
        ]
      }
      attendance_audit: {
        Row: {
          action: string
          created_at: string
          id: string
          new_value: Json | null
          old_value: Json | null
          performed_by: string | null
          reason: string | null
          record_id: string | null
          school_id: string
          session_id: string | null
          student_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          id?: string
          new_value?: Json | null
          old_value?: Json | null
          performed_by?: string | null
          reason?: string | null
          record_id?: string | null
          school_id: string
          session_id?: string | null
          student_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          id?: string
          new_value?: Json | null
          old_value?: Json | null
          performed_by?: string | null
          reason?: string | null
          record_id?: string | null
          school_id?: string
          session_id?: string | null
          student_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "attendance_audit_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      attendance_parameters: {
        Row: {
          excused_reasons: Json | null
          id: string
          late_after_minutes: number
          school_id: string | null
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          excused_reasons?: Json | null
          id?: string
          late_after_minutes?: number
          school_id?: string | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          excused_reasons?: Json | null
          id?: string
          late_after_minutes?: number
          school_id?: string | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "attendance_parameters_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      attendance_records: {
        Row: {
          created_at: string
          date: string
          id: string
          marked_by: string | null
          method: string
          notes: string | null
          period: number | null
          school_id: string | null
          session_id: string | null
          status: Database["public"]["Enums"]["attendance_status"]
          student_id: string
        }
        Insert: {
          created_at?: string
          date?: string
          id?: string
          marked_by?: string | null
          method?: string
          notes?: string | null
          period?: number | null
          school_id?: string | null
          session_id?: string | null
          status: Database["public"]["Enums"]["attendance_status"]
          student_id: string
        }
        Update: {
          created_at?: string
          date?: string
          id?: string
          marked_by?: string | null
          method?: string
          notes?: string | null
          period?: number | null
          school_id?: string | null
          session_id?: string | null
          status?: Database["public"]["Enums"]["attendance_status"]
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "attendance_records_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_records_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "attendance_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_records_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      attendance_sessions: {
        Row: {
          class_id: string | null
          created_at: string
          created_by: string | null
          date: string
          id: string
          locked_at: string | null
          locked_by: string | null
          notes: string | null
          period: number | null
          school_id: string
          status: string
          submitted_at: string | null
          submitted_by: string | null
          updated_at: string
        }
        Insert: {
          class_id?: string | null
          created_at?: string
          created_by?: string | null
          date: string
          id?: string
          locked_at?: string | null
          locked_by?: string | null
          notes?: string | null
          period?: number | null
          school_id: string
          status?: string
          submitted_at?: string | null
          submitted_by?: string | null
          updated_at?: string
        }
        Update: {
          class_id?: string | null
          created_at?: string
          created_by?: string | null
          date?: string
          id?: string
          locked_at?: string | null
          locked_by?: string | null
          notes?: string | null
          period?: number | null
          school_id?: string
          status?: string
          submitted_at?: string | null
          submitted_by?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "attendance_sessions_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "class_arms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_sessions_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_log: {
        Row: {
          action: string
          created_at: string
          details: Json | null
          entity_id: string | null
          entity_type: string
          id: string
          ip_address: string | null
          school_id: string | null
          user_id: string
          user_name: string | null
        }
        Insert: {
          action: string
          created_at?: string
          details?: Json | null
          entity_id?: string | null
          entity_type: string
          id?: string
          ip_address?: string | null
          school_id?: string | null
          user_id: string
          user_name?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          details?: Json | null
          entity_id?: string | null
          entity_type?: string
          id?: string
          ip_address?: string | null
          school_id?: string | null
          user_id?: string
          user_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_log_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      behavioral_traits: {
        Row: {
          created_at: string
          domain: Database["public"]["Enums"]["behavioral_domain"]
          id: string
          is_active: boolean
          name: string
          school_id: string
          trait_order: number
        }
        Insert: {
          created_at?: string
          domain: Database["public"]["Enums"]["behavioral_domain"]
          id?: string
          is_active?: boolean
          name: string
          school_id: string
          trait_order?: number
        }
        Update: {
          created_at?: string
          domain?: Database["public"]["Enums"]["behavioral_domain"]
          id?: string
          is_active?: boolean
          name?: string
          school_id?: string
          trait_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "behavioral_traits_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      broadsheet_field_mappings: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          is_default: boolean
          name: string
          school_id: string
          source_field_ids: string[]
          target_column: string | null
          target_field_id: string | null
          target_max: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          is_default?: boolean
          name: string
          school_id: string
          source_field_ids?: string[]
          target_column?: string | null
          target_field_id?: string | null
          target_max?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          is_default?: boolean
          name?: string
          school_id?: string
          source_field_ids?: string[]
          target_column?: string | null
          target_field_id?: string | null
          target_max?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "broadsheet_field_mappings_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "broadsheet_field_mappings_target_field_id_fkey"
            columns: ["target_field_id"]
            isOneToOne: false
            referencedRelation: "broadsheet_fields"
            referencedColumns: ["id"]
          },
        ]
      }
      broadsheet_field_scores: {
        Row: {
          created_at: string | null
          entered_by: string | null
          field_id: string
          id: string
          school_id: string | null
          score: number | null
          source_id: string | null
          source_type: string | null
          student_id: string
          subject_id: string | null
          term_id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          entered_by?: string | null
          field_id: string
          id?: string
          school_id?: string | null
          score?: number | null
          source_id?: string | null
          source_type?: string | null
          student_id: string
          subject_id?: string | null
          term_id: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          entered_by?: string | null
          field_id?: string
          id?: string
          school_id?: string | null
          score?: number | null
          source_id?: string | null
          source_type?: string | null
          student_id?: string
          subject_id?: string | null
          term_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "broadsheet_field_scores_field_id_fkey"
            columns: ["field_id"]
            isOneToOne: false
            referencedRelation: "broadsheet_fields"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "broadsheet_field_scores_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "broadsheet_field_scores_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "broadsheet_field_scores_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "broadsheet_field_scores_term_id_fkey"
            columns: ["term_id"]
            isOneToOne: false
            referencedRelation: "terms"
            referencedColumns: ["id"]
          },
        ]
      }
      broadsheet_fields: {
        Row: {
          computation_key: string | null
          created_at: string | null
          created_by: string | null
          description: string | null
          entry_mode: string
          field_order: number | null
          field_scope: string
          formula_operation: string | null
          formula_source_field_ids: string[] | null
          id: string
          is_active: boolean | null
          is_computed: boolean
          is_grade_source: boolean
          is_locked: boolean
          legacy_ca_slot: string | null
          max_points: number
          name: string
          pipeline_stage: string
          push_target_field_id: string | null
          school_id: string | null
          show_on_report_card: boolean
          updated_at: string | null
        }
        Insert: {
          computation_key?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          entry_mode?: string
          field_order?: number | null
          field_scope?: string
          formula_operation?: string | null
          formula_source_field_ids?: string[] | null
          id?: string
          is_active?: boolean | null
          is_computed?: boolean
          is_grade_source?: boolean
          is_locked?: boolean
          legacy_ca_slot?: string | null
          max_points?: number
          name: string
          pipeline_stage?: string
          push_target_field_id?: string | null
          school_id?: string | null
          show_on_report_card?: boolean
          updated_at?: string | null
        }
        Update: {
          computation_key?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          entry_mode?: string
          field_order?: number | null
          field_scope?: string
          formula_operation?: string | null
          formula_source_field_ids?: string[] | null
          id?: string
          is_active?: boolean | null
          is_computed?: boolean
          is_grade_source?: boolean
          is_locked?: boolean
          legacy_ca_slot?: string | null
          max_points?: number
          name?: string
          pipeline_stage?: string
          push_target_field_id?: string | null
          school_id?: string | null
          show_on_report_card?: boolean
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "broadsheet_fields_push_target_field_id_fkey"
            columns: ["push_target_field_id"]
            isOneToOne: false
            referencedRelation: "broadsheet_fields"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "broadsheet_fields_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      class_arms: {
        Row: {
          arm: string
          class_teacher_id: string | null
          created_at: string
          id: string
          level: Database["public"]["Enums"]["class_level"]
          name: string
          school_id: string | null
        }
        Insert: {
          arm: string
          class_teacher_id?: string | null
          created_at?: string
          id?: string
          level: Database["public"]["Enums"]["class_level"]
          name: string
          school_id?: string | null
        }
        Update: {
          arm?: string
          class_teacher_id?: string | null
          created_at?: string
          id?: string
          level?: Database["public"]["Enums"]["class_level"]
          name?: string
          school_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "class_arms_class_teacher_id_fkey"
            columns: ["class_teacher_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "class_arms_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      class_subjects: {
        Row: {
          class_id: string
          id: string
          school_id: string | null
          subject_id: string
          teacher_id: string | null
        }
        Insert: {
          class_id: string
          id?: string
          school_id?: string | null
          subject_id: string
          teacher_id?: string | null
        }
        Update: {
          class_id?: string
          id?: string
          school_id?: string | null
          subject_id?: string
          teacher_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "class_subjects_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "class_arms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "class_subjects_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "class_subjects_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "class_subjects_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
        ]
      }
      classroom_co_teachers: {
        Row: {
          added_at: string
          added_by: string
          classroom_id: string
          id: string
          school_id: string | null
          teacher_id: string
        }
        Insert: {
          added_at?: string
          added_by: string
          classroom_id: string
          id?: string
          school_id?: string | null
          teacher_id: string
        }
        Update: {
          added_at?: string
          added_by?: string
          classroom_id?: string
          id?: string
          school_id?: string | null
          teacher_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "classroom_co_teachers_classroom_id_fkey"
            columns: ["classroom_id"]
            isOneToOne: false
            referencedRelation: "classrooms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "classroom_co_teachers_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      classroom_materials: {
        Row: {
          classroom_id: string
          created_at: string
          description: string | null
          file_name: string | null
          file_size: number | null
          file_type: string | null
          file_url: string | null
          id: string
          link_url: string | null
          school_id: string | null
          title: string
          topic: string | null
          updated_at: string
          uploaded_by: string
        }
        Insert: {
          classroom_id: string
          created_at?: string
          description?: string | null
          file_name?: string | null
          file_size?: number | null
          file_type?: string | null
          file_url?: string | null
          id?: string
          link_url?: string | null
          school_id?: string | null
          title: string
          topic?: string | null
          updated_at?: string
          uploaded_by: string
        }
        Update: {
          classroom_id?: string
          created_at?: string
          description?: string | null
          file_name?: string | null
          file_size?: number | null
          file_type?: string | null
          file_url?: string | null
          id?: string
          link_url?: string | null
          school_id?: string | null
          title?: string
          topic?: string | null
          updated_at?: string
          uploaded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "classroom_materials_classroom_id_fkey"
            columns: ["classroom_id"]
            isOneToOne: false
            referencedRelation: "classrooms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "classroom_materials_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      classroom_members: {
        Row: {
          classroom_id: string
          id: string
          joined_at: string
          school_id: string | null
          student_id: string
        }
        Insert: {
          classroom_id: string
          id?: string
          joined_at?: string
          school_id?: string | null
          student_id: string
        }
        Update: {
          classroom_id?: string
          id?: string
          joined_at?: string
          school_id?: string | null
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "classroom_members_classroom_id_fkey"
            columns: ["classroom_id"]
            isOneToOne: false
            referencedRelation: "classrooms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "classroom_members_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "classroom_members_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      classroom_syllabus: {
        Row: {
          activities: string | null
          classroom_id: string
          content: string | null
          created_at: string
          created_by: string
          id: string
          objectives: string | null
          resources: string | null
          school_id: string | null
          title: string
          topic: string | null
          updated_at: string
          week_number: number | null
        }
        Insert: {
          activities?: string | null
          classroom_id: string
          content?: string | null
          created_at?: string
          created_by: string
          id?: string
          objectives?: string | null
          resources?: string | null
          school_id?: string | null
          title: string
          topic?: string | null
          updated_at?: string
          week_number?: number | null
        }
        Update: {
          activities?: string | null
          classroom_id?: string
          content?: string | null
          created_at?: string
          created_by?: string
          id?: string
          objectives?: string | null
          resources?: string | null
          school_id?: string | null
          title?: string
          topic?: string | null
          updated_at?: string
          week_number?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "classroom_syllabus_classroom_id_fkey"
            columns: ["classroom_id"]
            isOneToOne: false
            referencedRelation: "classrooms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "classroom_syllabus_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      classrooms: {
        Row: {
          banner_color: string | null
          banner_image_url: string | null
          class_id: string | null
          code: string
          created_at: string
          description: string | null
          id: string
          is_archived: boolean | null
          name: string
          school_id: string | null
          subject_id: string | null
          teacher_id: string
        }
        Insert: {
          banner_color?: string | null
          banner_image_url?: string | null
          class_id?: string | null
          code: string
          created_at?: string
          description?: string | null
          id?: string
          is_archived?: boolean | null
          name: string
          school_id?: string | null
          subject_id?: string | null
          teacher_id: string
        }
        Update: {
          banner_color?: string | null
          banner_image_url?: string | null
          class_id?: string | null
          code?: string
          created_at?: string
          description?: string | null
          id?: string
          is_archived?: boolean | null
          name?: string
          school_id?: string | null
          subject_id?: string | null
          teacher_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "classrooms_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "class_arms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "classrooms_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "classrooms_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "classrooms_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
        ]
      }
      event_participants: {
        Row: {
          event_id: string
          id: string
          joined_at: string
          school_id: string | null
          student_id: string
        }
        Insert: {
          event_id: string
          id?: string
          joined_at?: string
          school_id?: string | null
          student_id: string
        }
        Update: {
          event_id?: string
          id?: string
          joined_at?: string
          school_id?: string | null
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_participants_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_participants_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_participants_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      event_supporters: {
        Row: {
          event_id: string
          id: string
          joined_at: string
          notes: string | null
          school_id: string | null
          support_type: string | null
          user_id: string
        }
        Insert: {
          event_id: string
          id?: string
          joined_at?: string
          notes?: string | null
          school_id?: string | null
          support_type?: string | null
          user_id: string
        }
        Update: {
          event_id?: string
          id?: string
          joined_at?: string
          notes?: string | null
          school_id?: string | null
          support_type?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_supporters_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_supporters_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      events: {
        Row: {
          coordinator_id: string
          created_at: string
          created_by: string
          description: string | null
          event_date: string
          event_time: string | null
          id: string
          is_active: boolean | null
          location: string | null
          school_id: string | null
          title: string
          type: string
          updated_at: string
        }
        Insert: {
          coordinator_id: string
          created_at?: string
          created_by: string
          description?: string | null
          event_date: string
          event_time?: string | null
          id?: string
          is_active?: boolean | null
          location?: string | null
          school_id?: string | null
          title: string
          type?: string
          updated_at?: string
        }
        Update: {
          coordinator_id?: string
          created_at?: string
          created_by?: string
          description?: string | null
          event_date?: string
          event_time?: string | null
          id?: string
          is_active?: boolean | null
          location?: string | null
          school_id?: string | null
          title?: string
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "events_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      fee_structures: {
        Row: {
          amount: number
          class_id: string | null
          created_at: string
          description: string
          id: string
          is_mandatory: boolean | null
          school_id: string | null
          term_id: string | null
        }
        Insert: {
          amount: number
          class_id?: string | null
          created_at?: string
          description: string
          id?: string
          is_mandatory?: boolean | null
          school_id?: string | null
          term_id?: string | null
        }
        Update: {
          amount?: number
          class_id?: string | null
          created_at?: string
          description?: string
          id?: string
          is_mandatory?: boolean | null
          school_id?: string | null
          term_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fee_structures_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "class_arms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fee_structures_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fee_structures_term_id_fkey"
            columns: ["term_id"]
            isOneToOne: false
            referencedRelation: "terms"
            referencedColumns: ["id"]
          },
        ]
      }
      grading_rubrics: {
        Row: {
          classroom_id: string | null
          created_at: string | null
          created_by: string
          criteria: Json
          description: string | null
          id: string
          is_template: boolean | null
          school_id: string | null
          title: string
          total_points: number
          updated_at: string | null
        }
        Insert: {
          classroom_id?: string | null
          created_at?: string | null
          created_by: string
          criteria?: Json
          description?: string | null
          id?: string
          is_template?: boolean | null
          school_id?: string | null
          title: string
          total_points?: number
          updated_at?: string | null
        }
        Update: {
          classroom_id?: string | null
          created_at?: string | null
          created_by?: string
          criteria?: Json
          description?: string | null
          id?: string
          is_template?: boolean | null
          school_id?: string | null
          title?: string
          total_points?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "grading_rubrics_classroom_id_fkey"
            columns: ["classroom_id"]
            isOneToOne: false
            referencedRelation: "classrooms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "grading_rubrics_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "grading_rubrics_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      grading_scales: {
        Row: {
          created_at: string
          grade: string
          id: string
          max_score: number
          min_score: number
          remark: string
          school_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          grade: string
          id?: string
          max_score: number
          min_score: number
          remark: string
          school_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          grade?: string
          id?: string
          max_score?: number
          min_score?: number
          remark?: string
          school_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "grading_scales_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      library_books: {
        Row: {
          added_by: string | null
          author: string | null
          available_copies: number | null
          category: string | null
          created_at: string
          file_url: string | null
          id: string
          isbn: string | null
          resource_type: string
          school_id: string
          title: string
          total_copies: number | null
        }
        Insert: {
          added_by?: string | null
          author?: string | null
          available_copies?: number | null
          category?: string | null
          created_at?: string
          file_url?: string | null
          id?: string
          isbn?: string | null
          resource_type?: string
          school_id: string
          title: string
          total_copies?: number | null
        }
        Update: {
          added_by?: string | null
          author?: string | null
          available_copies?: number | null
          category?: string | null
          created_at?: string
          file_url?: string | null
          id?: string
          isbn?: string | null
          resource_type?: string
          school_id?: string
          title?: string
          total_copies?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "library_books_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      library_loans: {
        Row: {
          book_id: string
          borrowed_at: string
          created_at: string
          due_date: string
          id: string
          issued_by: string | null
          returned_at: string | null
          school_id: string
          staff_id: string | null
          student_id: string | null
        }
        Insert: {
          book_id: string
          borrowed_at?: string
          created_at?: string
          due_date: string
          id?: string
          issued_by?: string | null
          returned_at?: string | null
          school_id: string
          staff_id?: string | null
          student_id?: string | null
        }
        Update: {
          book_id?: string
          borrowed_at?: string
          created_at?: string
          due_date?: string
          id?: string
          issued_by?: string | null
          returned_at?: string | null
          school_id?: string
          staff_id?: string | null
          student_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "library_loans_book_id_fkey"
            columns: ["book_id"]
            isOneToOne: false
            referencedRelation: "library_books"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "library_loans_issued_by_fkey"
            columns: ["issued_by"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "library_loans_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "library_loans_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "library_loans_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      live_class_sessions: {
        Row: {
          classroom_id: string
          created_at: string
          created_by: string
          description: string | null
          duration_minutes: number | null
          id: string
          meeting_link: string | null
          scheduled_at: string
          school_id: string | null
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          classroom_id: string
          created_at?: string
          created_by: string
          description?: string | null
          duration_minutes?: number | null
          id?: string
          meeting_link?: string | null
          scheduled_at: string
          school_id?: string | null
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          classroom_id?: string
          created_at?: string
          created_by?: string
          description?: string | null
          duration_minutes?: number | null
          id?: string
          meeting_link?: string | null
          scheduled_at?: string
          school_id?: string | null
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "live_class_sessions_classroom_id_fkey"
            columns: ["classroom_id"]
            isOneToOne: false
            referencedRelation: "classrooms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "live_class_sessions_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      login_history: {
        Row: {
          id: string
          ip_address: string | null
          login_at: string
          school_id: string | null
          success: boolean
          user_agent: string | null
          user_id: string
        }
        Insert: {
          id?: string
          ip_address?: string | null
          login_at?: string
          school_id?: string | null
          success?: boolean
          user_agent?: string | null
          user_id: string
        }
        Update: {
          id?: string
          ip_address?: string | null
          login_at?: string
          school_id?: string | null
          success?: boolean
          user_agent?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "login_history_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      message_recipients: {
        Row: {
          created_at: string
          id: string
          is_archived: boolean | null
          is_read: boolean | null
          message_id: string
          read_at: string | null
          recipient_id: string
          school_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          is_archived?: boolean | null
          is_read?: boolean | null
          message_id: string
          read_at?: string | null
          recipient_id: string
          school_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          is_archived?: boolean | null
          is_read?: boolean | null
          message_id?: string
          read_at?: string | null
          recipient_id?: string
          school_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "message_recipients_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "message_recipients_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          content: string
          created_at: string
          id: string
          is_broadcast: boolean | null
          parent_id: string | null
          priority: string | null
          school_id: string | null
          sender_id: string
          subject: string
          target_roles: string[] | null
          updated_at: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          is_broadcast?: boolean | null
          parent_id?: string | null
          priority?: string | null
          school_id?: string | null
          sender_id: string
          subject: string
          target_roles?: string[] | null
          updated_at?: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          is_broadcast?: boolean | null
          parent_id?: string | null
          priority?: string | null
          school_id?: string | null
          sender_id?: string
          subject?: string
          target_roles?: string[] | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          created_at: string
          id: string
          is_read: boolean | null
          link: string | null
          message: string
          school_id: string | null
          title: string
          type: Database["public"]["Enums"]["notification_type"] | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_read?: boolean | null
          link?: string | null
          message: string
          school_id?: string | null
          title: string
          type?: Database["public"]["Enums"]["notification_type"] | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_read?: boolean | null
          link?: string | null
          message?: string
          school_id?: string | null
          title?: string
          type?: Database["public"]["Enums"]["notification_type"] | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      parent_notifications: {
        Row: {
          child_id: string
          created_at: string
          id: string
          is_read: boolean | null
          message: string
          notification_type: string
          parent_id: string
          reference_id: string | null
          school_id: string | null
        }
        Insert: {
          child_id: string
          created_at?: string
          id?: string
          is_read?: boolean | null
          message: string
          notification_type: string
          parent_id: string
          reference_id?: string | null
          school_id?: string | null
        }
        Update: {
          child_id?: string
          created_at?: string
          id?: string
          is_read?: boolean | null
          message?: string
          notification_type?: string
          parent_id?: string
          reference_id?: string | null
          school_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "parent_notifications_child_id_fkey"
            columns: ["child_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "parent_notifications_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount: number
          created_at: string
          fee_id: string
          id: string
          method: Database["public"]["Enums"]["payment_method"]
          notes: string | null
          payment_date: string
          receipt_number: string | null
          recorded_by: string | null
          school_id: string | null
          status: Database["public"]["Enums"]["payment_status"] | null
          student_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          fee_id: string
          id?: string
          method: Database["public"]["Enums"]["payment_method"]
          notes?: string | null
          payment_date?: string
          receipt_number?: string | null
          recorded_by?: string | null
          school_id?: string | null
          status?: Database["public"]["Enums"]["payment_status"] | null
          student_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          fee_id?: string
          id?: string
          method?: Database["public"]["Enums"]["payment_method"]
          notes?: string | null
          payment_date?: string
          receipt_number?: string | null
          recorded_by?: string | null
          school_id?: string | null
          status?: Database["public"]["Enums"]["payment_status"] | null
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_fee_id_fkey"
            columns: ["fee_id"]
            isOneToOne: false
            referencedRelation: "fee_structures"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      permission_grants: {
        Row: {
          granted_at: string
          granted_by: string | null
          id: string
          permission: Database["public"]["Enums"]["permission_key"]
          school_id: string
          staff_id: string
        }
        Insert: {
          granted_at?: string
          granted_by?: string | null
          id?: string
          permission: Database["public"]["Enums"]["permission_key"]
          school_id: string
          staff_id: string
        }
        Update: {
          granted_at?: string
          granted_by?: string | null
          id?: string
          permission?: Database["public"]["Enums"]["permission_key"]
          school_id?: string
          staff_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "permission_grants_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "permission_grants_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
        ]
      }
      pipeline_stage_locks: {
        Row: {
          id: string
          locked: boolean
          locked_at: string | null
          locked_by: string | null
          pipeline_stage: string
          school_id: string
        }
        Insert: {
          id?: string
          locked?: boolean
          locked_at?: string | null
          locked_by?: string | null
          pipeline_stage: string
          school_id: string
        }
        Update: {
          id?: string
          locked?: boolean
          locked_at?: string | null
          locked_by?: string | null
          pipeline_stage?: string
          school_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pipeline_stage_locks_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_announcements: {
        Row: {
          announcement_type: string
          content: string
          created_at: string
          created_by: string
          ends_at: string | null
          id: string
          is_active: boolean
          priority: string
          starts_at: string | null
          title: string
          updated_at: string
        }
        Insert: {
          announcement_type?: string
          content: string
          created_at?: string
          created_by: string
          ends_at?: string | null
          id?: string
          is_active?: boolean
          priority?: string
          starts_at?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          announcement_type?: string
          content?: string
          created_at?: string
          created_by?: string
          ends_at?: string | null
          id?: string
          is_active?: boolean
          priority?: string
          starts_at?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      platform_settings: {
        Row: {
          id: boolean
          maintenance_message: string | null
          maintenance_mode: boolean
          self_service_signup_enabled: boolean
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          id?: boolean
          maintenance_message?: string | null
          maintenance_mode?: boolean
          self_service_signup_enabled?: boolean
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          id?: boolean
          maintenance_message?: string | null
          maintenance_mode?: boolean
          self_service_signup_enabled?: boolean
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      post_comments: {
        Row: {
          author_id: string
          content: string
          created_at: string
          id: string
          post_id: string
          school_id: string | null
        }
        Insert: {
          author_id: string
          content: string
          created_at?: string
          id?: string
          post_id: string
          school_id?: string | null
        }
        Update: {
          author_id?: string
          content?: string
          created_at?: string
          id?: string
          post_id?: string
          school_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "post_comments_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "stream_posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "post_comments_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string | null
          full_name: string
          id: string
          phone: string | null
          school_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name: string
          id?: string
          phone?: string | null
          school_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string
          id?: string
          phone?: string | null
          school_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      quiz_answers: {
        Row: {
          answer: Json | null
          attempt_id: string
          created_at: string
          feedback: string | null
          id: string
          is_correct: boolean | null
          points_earned: number | null
          question_id: string
          school_id: string | null
          student_id: string | null
        }
        Insert: {
          answer?: Json | null
          attempt_id: string
          created_at?: string
          feedback?: string | null
          id?: string
          is_correct?: boolean | null
          points_earned?: number | null
          question_id: string
          school_id?: string | null
          student_id?: string | null
        }
        Update: {
          answer?: Json | null
          attempt_id?: string
          created_at?: string
          feedback?: string | null
          id?: string
          is_correct?: boolean | null
          points_earned?: number | null
          question_id?: string
          school_id?: string | null
          student_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "quiz_answers_attempt_id_fkey"
            columns: ["attempt_id"]
            isOneToOne: false
            referencedRelation: "quiz_attempts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quiz_answers_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "quiz_questions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quiz_answers_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quiz_answers_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      quiz_attempts: {
        Row: {
          auto_score: number | null
          feedback: string | null
          graded_at: string | null
          graded_by: string | null
          id: string
          is_graded: boolean | null
          manual_score: number | null
          quiz_id: string
          school_id: string | null
          started_at: string
          student_id: string
          submitted_at: string | null
          total_score: number | null
        }
        Insert: {
          auto_score?: number | null
          feedback?: string | null
          graded_at?: string | null
          graded_by?: string | null
          id?: string
          is_graded?: boolean | null
          manual_score?: number | null
          quiz_id: string
          school_id?: string | null
          started_at?: string
          student_id: string
          submitted_at?: string | null
          total_score?: number | null
        }
        Update: {
          auto_score?: number | null
          feedback?: string | null
          graded_at?: string | null
          graded_by?: string | null
          id?: string
          is_graded?: boolean | null
          manual_score?: number | null
          quiz_id?: string
          school_id?: string | null
          started_at?: string
          student_id?: string
          submitted_at?: string | null
          total_score?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "quiz_attempts_quiz_id_fkey"
            columns: ["quiz_id"]
            isOneToOne: false
            referencedRelation: "quizzes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quiz_attempts_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quiz_attempts_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      quiz_questions: {
        Row: {
          correct_answer: Json | null
          created_at: string
          display_order: number | null
          grading_rubric: string | null
          id: string
          marks: number | null
          options: Json | null
          order_index: number
          points: number
          question_text: string
          question_type: Database["public"]["Enums"]["question_type"]
          quiz_id: string
          school_id: string | null
        }
        Insert: {
          correct_answer?: Json | null
          created_at?: string
          display_order?: number | null
          grading_rubric?: string | null
          id?: string
          marks?: number | null
          options?: Json | null
          order_index?: number
          points?: number
          question_text: string
          question_type?: Database["public"]["Enums"]["question_type"]
          quiz_id: string
          school_id?: string | null
        }
        Update: {
          correct_answer?: Json | null
          created_at?: string
          display_order?: number | null
          grading_rubric?: string | null
          id?: string
          marks?: number | null
          options?: Json | null
          order_index?: number
          points?: number
          question_text?: string
          question_type?: Database["public"]["Enums"]["question_type"]
          quiz_id?: string
          school_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "quiz_questions_quiz_id_fkey"
            columns: ["quiz_id"]
            isOneToOne: false
            referencedRelation: "quizzes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quiz_questions_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      quizzes: {
        Row: {
          allow_review: boolean | null
          allowed_file_types: Json | null
          assignment_id: string | null
          auto_grade: boolean | null
          broadsheet_field_id: string | null
          classroom_id: string
          content_type:
            | Database["public"]["Enums"]["assignment_content_type"]
            | null
          created_at: string
          created_by: string
          description: string | null
          duration_minutes: number | null
          ends_at: string | null
          id: string
          is_active: boolean | null
          is_archived: boolean
          is_deleted: boolean | null
          is_locked: boolean
          passing_score: number | null
          quiz_type: Database["public"]["Enums"]["quiz_type"]
          scheduled_at: string | null
          school_id: string | null
          shuffle_options: boolean | null
          shuffle_questions: boolean | null
          starts_at: string | null
          teacher_id: string | null
          title: string
          total_marks: number | null
          total_points: number | null
          updated_at: string
        }
        Insert: {
          allow_review?: boolean | null
          allowed_file_types?: Json | null
          assignment_id?: string | null
          auto_grade?: boolean | null
          broadsheet_field_id?: string | null
          classroom_id: string
          content_type?:
            | Database["public"]["Enums"]["assignment_content_type"]
            | null
          created_at?: string
          created_by: string
          description?: string | null
          duration_minutes?: number | null
          ends_at?: string | null
          id?: string
          is_active?: boolean | null
          is_archived?: boolean
          is_deleted?: boolean | null
          is_locked?: boolean
          passing_score?: number | null
          quiz_type?: Database["public"]["Enums"]["quiz_type"]
          scheduled_at?: string | null
          school_id?: string | null
          shuffle_options?: boolean | null
          shuffle_questions?: boolean | null
          starts_at?: string | null
          teacher_id?: string | null
          title: string
          total_marks?: number | null
          total_points?: number | null
          updated_at?: string
        }
        Update: {
          allow_review?: boolean | null
          allowed_file_types?: Json | null
          assignment_id?: string | null
          auto_grade?: boolean | null
          broadsheet_field_id?: string | null
          classroom_id?: string
          content_type?:
            | Database["public"]["Enums"]["assignment_content_type"]
            | null
          created_at?: string
          created_by?: string
          description?: string | null
          duration_minutes?: number | null
          ends_at?: string | null
          id?: string
          is_active?: boolean | null
          is_archived?: boolean
          is_deleted?: boolean | null
          is_locked?: boolean
          passing_score?: number | null
          quiz_type?: Database["public"]["Enums"]["quiz_type"]
          scheduled_at?: string | null
          school_id?: string | null
          shuffle_options?: boolean | null
          shuffle_questions?: boolean | null
          starts_at?: string | null
          teacher_id?: string | null
          title?: string
          total_marks?: number | null
          total_points?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "quizzes_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "assignments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quizzes_broadsheet_field_id_fkey"
            columns: ["broadsheet_field_id"]
            isOneToOne: false
            referencedRelation: "broadsheet_fields"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quizzes_classroom_id_fkey"
            columns: ["classroom_id"]
            isOneToOne: false
            referencedRelation: "classrooms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quizzes_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quizzes_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
        ]
      }
      report_downloads: {
        Row: {
          created_at: string
          document_type: string
          downloaded_by: string | null
          id: string
          school_id: string
          student_id: string
        }
        Insert: {
          created_at?: string
          document_type?: string
          downloaded_by?: string | null
          id?: string
          school_id: string
          student_id: string
        }
        Update: {
          created_at?: string
          document_type?: string
          downloaded_by?: string | null
          id?: string
          school_id?: string
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "report_downloads_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "report_downloads_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      result_transcripts: {
        Row: {
          average_score: number | null
          class_size: number | null
          class_teacher_remarks: string | null
          generated_at: string
          generated_by: string | null
          id: string
          position: number | null
          principal_remarks: string | null
          school_id: string | null
          session_id: string
          student_id: string
          term_id: string
          total_score: number | null
          total_subjects: number | null
        }
        Insert: {
          average_score?: number | null
          class_size?: number | null
          class_teacher_remarks?: string | null
          generated_at?: string
          generated_by?: string | null
          id?: string
          position?: number | null
          principal_remarks?: string | null
          school_id?: string | null
          session_id: string
          student_id: string
          term_id: string
          total_score?: number | null
          total_subjects?: number | null
        }
        Update: {
          average_score?: number | null
          class_size?: number | null
          class_teacher_remarks?: string | null
          generated_at?: string
          generated_by?: string | null
          id?: string
          position?: number | null
          principal_remarks?: string | null
          school_id?: string | null
          session_id?: string
          student_id?: string
          term_id?: string
          total_score?: number | null
          total_subjects?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "result_transcripts_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "result_transcripts_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "academic_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "result_transcripts_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "result_transcripts_term_id_fkey"
            columns: ["term_id"]
            isOneToOne: false
            referencedRelation: "terms"
            referencedColumns: ["id"]
          },
        ]
      }
      role_definitions: {
        Row: {
          category: string
          created_at: string
          created_by: string | null
          id: string
          is_system: boolean
          key: string
          label: string
          school_id: string | null
        }
        Insert: {
          category: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_system?: boolean
          key: string
          label: string
          school_id?: string | null
        }
        Update: {
          category?: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_system?: boolean
          key?: string
          label?: string
          school_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "role_definitions_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      school_announcements: {
        Row: {
          announcement_type: string
          content: string
          created_at: string
          created_by: string
          ends_at: string | null
          id: string
          is_active: boolean
          priority: string
          school_id: string
          starts_at: string | null
          title: string
          updated_at: string
        }
        Insert: {
          announcement_type?: string
          content: string
          created_at?: string
          created_by: string
          ends_at?: string | null
          id?: string
          is_active?: boolean
          priority?: string
          school_id: string
          starts_at?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          announcement_type?: string
          content?: string
          created_at?: string
          created_by?: string
          ends_at?: string | null
          id?: string
          is_active?: boolean
          priority?: string
          school_id?: string
          starts_at?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "school_announcements_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      school_expenses: {
        Row: {
          amount: number
          approved_by: string | null
          category: string
          created_at: string
          description: string
          id: string
          notes: string | null
          paid_to: string | null
          payment_date: string
          receipt_number: string | null
          recorded_by: string | null
          school_id: string | null
          status: string
          updated_at: string
        }
        Insert: {
          amount: number
          approved_by?: string | null
          category?: string
          created_at?: string
          description: string
          id?: string
          notes?: string | null
          paid_to?: string | null
          payment_date?: string
          receipt_number?: string | null
          recorded_by?: string | null
          school_id?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          amount?: number
          approved_by?: string | null
          category?: string
          created_at?: string
          description?: string
          id?: string
          notes?: string | null
          paid_to?: string | null
          payment_date?: string
          receipt_number?: string | null
          recorded_by?: string | null
          school_id?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "school_expenses_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      school_feature_flags: {
        Row: {
          created_at: string
          id: string
          is_enabled: boolean
          module_name: string
          school_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_enabled?: boolean
          module_name: string
          school_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_enabled?: boolean
          module_name?: string
          school_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "school_feature_flags_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      school_settings: {
        Row: {
          id: string
          key: string
          school_id: string | null
          updated_at: string | null
          updated_by: string | null
          value: Json
        }
        Insert: {
          id?: string
          key: string
          school_id?: string | null
          updated_at?: string | null
          updated_by?: string | null
          value?: Json
        }
        Update: {
          id?: string
          key?: string
          school_id?: string | null
          updated_at?: string | null
          updated_by?: string | null
          value?: Json
        }
        Relationships: [
          {
            foreignKeyName: "school_settings_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      school_subscriptions: {
        Row: {
          id: string
          notes: string | null
          school_id: string
          status: Database["public"]["Enums"]["subscription_status"]
          tier: Database["public"]["Enums"]["subscription_tier"]
          trial_ends_at: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          id?: string
          notes?: string | null
          school_id: string
          status?: Database["public"]["Enums"]["subscription_status"]
          tier?: Database["public"]["Enums"]["subscription_tier"]
          trial_ends_at?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          id?: string
          notes?: string | null
          school_id?: string
          status?: Database["public"]["Enums"]["subscription_status"]
          tier?: Database["public"]["Enums"]["subscription_tier"]
          trial_ends_at?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "school_subscriptions_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: true
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      schools: {
        Row: {
          address: string | null
          created_at: string
          created_by: string | null
          email: string | null
          id: string
          is_active: boolean
          logo_url: string | null
          name: string
          phone: string | null
          principal_signature_url: string | null
          school_code: string
          school_stamp_url: string | null
          tagline: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          id?: string
          is_active?: boolean
          logo_url?: string | null
          name: string
          phone?: string | null
          principal_signature_url?: string | null
          school_code: string
          school_stamp_url?: string | null
          tagline?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          id?: string
          is_active?: boolean
          logo_url?: string | null
          name?: string
          phone?: string | null
          principal_signature_url?: string | null
          school_code?: string
          school_stamp_url?: string | null
          tagline?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      special_roles: {
        Row: {
          assigned_at: string
          assigned_by: string
          class_id: string | null
          custom_role_name: string | null
          id: string
          is_active: boolean | null
          notes: string | null
          role_type: Database["public"]["Enums"]["special_role_type"]
          school_id: string | null
          session_id: string | null
          staff_id: string | null
          student_id: string | null
        }
        Insert: {
          assigned_at?: string
          assigned_by: string
          class_id?: string | null
          custom_role_name?: string | null
          id?: string
          is_active?: boolean | null
          notes?: string | null
          role_type: Database["public"]["Enums"]["special_role_type"]
          school_id?: string | null
          session_id?: string | null
          staff_id?: string | null
          student_id?: string | null
        }
        Update: {
          assigned_at?: string
          assigned_by?: string
          class_id?: string | null
          custom_role_name?: string | null
          id?: string
          is_active?: boolean | null
          notes?: string | null
          role_type?: Database["public"]["Enums"]["special_role_type"]
          school_id?: string | null
          session_id?: string | null
          staff_id?: string | null
          student_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "special_roles_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "class_arms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "special_roles_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "special_roles_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "academic_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "special_roles_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "special_roles_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      staff: {
        Row: {
          avatar_url: string | null
          can_post_announcements: boolean
          created_at: string
          date_of_birth: string | null
          email: string
          employee_id: string
          employment_date: string | null
          employment_status: string
          first_name: string
          gender: string
          id: string
          last_name: string
          middle_name: string | null
          phone: string | null
          qualification: string | null
          school_id: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          avatar_url?: string | null
          can_post_announcements?: boolean
          created_at?: string
          date_of_birth?: string | null
          email: string
          employee_id: string
          employment_date?: string | null
          employment_status?: string
          first_name: string
          gender: string
          id?: string
          last_name: string
          middle_name?: string | null
          phone?: string | null
          qualification?: string | null
          school_id?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          avatar_url?: string | null
          can_post_announcements?: boolean
          created_at?: string
          date_of_birth?: string | null
          email?: string
          employee_id?: string
          employment_date?: string | null
          employment_status?: string
          first_name?: string
          gender?: string
          id?: string
          last_name?: string
          middle_name?: string | null
          phone?: string | null
          qualification?: string | null
          school_id?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "staff_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_clock_records: {
        Row: {
          clock_in: string
          clock_out: string | null
          created_at: string | null
          date: string
          id: string
          method: string | null
          school_id: string | null
          staff_id: string
        }
        Insert: {
          clock_in?: string
          clock_out?: string | null
          created_at?: string | null
          date?: string
          id?: string
          method?: string | null
          school_id?: string | null
          staff_id: string
        }
        Update: {
          clock_in?: string
          clock_out?: string | null
          created_at?: string | null
          date?: string
          id?: string
          method?: string | null
          school_id?: string | null
          staff_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "staff_clock_records_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_clock_records_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
        ]
      }
      stream_posts: {
        Row: {
          author_id: string
          classroom_id: string
          content: string
          created_at: string
          id: string
          is_pinned: boolean | null
          school_id: string | null
          updated_at: string
        }
        Insert: {
          author_id: string
          classroom_id: string
          content: string
          created_at?: string
          id?: string
          is_pinned?: boolean | null
          school_id?: string | null
          updated_at?: string
        }
        Update: {
          author_id?: string
          classroom_id?: string
          content?: string
          created_at?: string
          id?: string
          is_pinned?: boolean | null
          school_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "stream_posts_classroom_id_fkey"
            columns: ["classroom_id"]
            isOneToOne: false
            referencedRelation: "classrooms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stream_posts_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      student_behavioral_ratings: {
        Row: {
          created_at: string
          id: string
          rated_by: string | null
          rating: number
          school_id: string
          student_id: string
          term_id: string
          trait_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          rated_by?: string | null
          rating: number
          school_id: string
          student_id: string
          term_id: string
          trait_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          rated_by?: string | null
          rating?: number
          school_id?: string
          student_id?: string
          term_id?: string
          trait_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "student_behavioral_ratings_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_behavioral_ratings_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_behavioral_ratings_term_id_fkey"
            columns: ["term_id"]
            isOneToOne: false
            referencedRelation: "terms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_behavioral_ratings_trait_id_fkey"
            columns: ["trait_id"]
            isOneToOne: false
            referencedRelation: "behavioral_traits"
            referencedColumns: ["id"]
          },
        ]
      }
      student_fees: {
        Row: {
          auto_generated: boolean
          created_at: string
          created_by: string | null
          custom_amount: number | null
          fee_structure_id: string
          id: string
          school_id: string
          student_id: string
          updated_at: string
          waived: boolean
          waived_reason: string | null
        }
        Insert: {
          auto_generated?: boolean
          created_at?: string
          created_by?: string | null
          custom_amount?: number | null
          fee_structure_id: string
          id?: string
          school_id: string
          student_id: string
          updated_at?: string
          waived?: boolean
          waived_reason?: string | null
        }
        Update: {
          auto_generated?: boolean
          created_at?: string
          created_by?: string | null
          custom_amount?: number | null
          fee_structure_id?: string
          id?: string
          school_id?: string
          student_id?: string
          updated_at?: string
          waived?: boolean
          waived_reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "student_fees_fee_structure_id_fkey"
            columns: ["fee_structure_id"]
            isOneToOne: false
            referencedRelation: "fee_structures"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_fees_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_fees_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      students: {
        Row: {
          admission_number: string
          avatar_url: string | null
          class_id: string | null
          created_at: string
          date_of_birth: string | null
          enrollment_date: string | null
          enrollment_status:
            | Database["public"]["Enums"]["enrollment_status"]
            | null
          first_name: string
          gender: Database["public"]["Enums"]["gender_type"]
          id: string
          last_name: string
          middle_name: string | null
          parent_id: string | null
          school_id: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          admission_number: string
          avatar_url?: string | null
          class_id?: string | null
          created_at?: string
          date_of_birth?: string | null
          enrollment_date?: string | null
          enrollment_status?:
            | Database["public"]["Enums"]["enrollment_status"]
            | null
          first_name: string
          gender: Database["public"]["Enums"]["gender_type"]
          id?: string
          last_name: string
          middle_name?: string | null
          parent_id?: string | null
          school_id?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          admission_number?: string
          avatar_url?: string | null
          class_id?: string | null
          created_at?: string
          date_of_birth?: string | null
          enrollment_date?: string | null
          enrollment_status?:
            | Database["public"]["Enums"]["enrollment_status"]
            | null
          first_name?: string
          gender?: Database["public"]["Enums"]["gender_type"]
          id?: string
          last_name?: string
          middle_name?: string | null
          parent_id?: string | null
          school_id?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "students_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "class_arms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "students_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      subjects: {
        Row: {
          code: string
          created_at: string
          description: string | null
          id: string
          name: string
          school_id: string | null
        }
        Insert: {
          code: string
          created_at?: string
          description?: string | null
          id?: string
          name: string
          school_id?: string | null
        }
        Update: {
          code?: string
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          school_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "subjects_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      submissions: {
        Row: {
          assignment_id: string | null
          content: string | null
          feedback: string | null
          file_url: string | null
          grade: number | null
          graded_at: string | null
          graded_by: string | null
          graded_by_staff: string | null
          id: string
          is_late: boolean | null
          quiz_id: string | null
          school_id: string | null
          status: Database["public"]["Enums"]["submission_status"] | null
          student_id: string
          submitted_at: string
          submitted_content: string | null
        }
        Insert: {
          assignment_id?: string | null
          content?: string | null
          feedback?: string | null
          file_url?: string | null
          grade?: number | null
          graded_at?: string | null
          graded_by?: string | null
          graded_by_staff?: string | null
          id?: string
          is_late?: boolean | null
          quiz_id?: string | null
          school_id?: string | null
          status?: Database["public"]["Enums"]["submission_status"] | null
          student_id: string
          submitted_at?: string
          submitted_content?: string | null
        }
        Update: {
          assignment_id?: string | null
          content?: string | null
          feedback?: string | null
          file_url?: string | null
          grade?: number | null
          graded_at?: string | null
          graded_by?: string | null
          graded_by_staff?: string | null
          id?: string
          is_late?: boolean | null
          quiz_id?: string | null
          school_id?: string | null
          status?: Database["public"]["Enums"]["submission_status"] | null
          student_id?: string
          submitted_at?: string
          submitted_content?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "submissions_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "assignments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "submissions_graded_by_staff_fkey"
            columns: ["graded_by_staff"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "submissions_quiz_id_fkey"
            columns: ["quiz_id"]
            isOneToOne: false
            referencedRelation: "quizzes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "submissions_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "submissions_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      super_admins: {
        Row: {
          created_at: string
          id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      support_tickets: {
        Row: {
          assigned_to: string | null
          category: string | null
          created_at: string
          description: string
          id: string
          priority: string
          resolution_notes: string | null
          school_id: string | null
          status: string
          subject: string
          submitted_by: string
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          category?: string | null
          created_at?: string
          description: string
          id?: string
          priority?: string
          resolution_notes?: string | null
          school_id?: string | null
          status?: string
          subject: string
          submitted_by: string
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          category?: string | null
          created_at?: string
          description?: string
          id?: string
          priority?: string
          resolution_notes?: string | null
          school_id?: string | null
          status?: string
          subject?: string
          submitted_by?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_tickets_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      terms: {
        Row: {
          created_at: string
          end_date: string
          id: string
          is_active: boolean | null
          name: string
          school_id: string | null
          session_id: string
          start_date: string
          term_number: number
        }
        Insert: {
          created_at?: string
          end_date: string
          id?: string
          is_active?: boolean | null
          name: string
          school_id?: string | null
          session_id: string
          start_date: string
          term_number: number
        }
        Update: {
          created_at?: string
          end_date?: string
          id?: string
          is_active?: boolean | null
          name?: string
          school_id?: string | null
          session_id?: string
          start_date?: string
          term_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "terms_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "terms_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "academic_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      timetable_slots: {
        Row: {
          class_id: string
          created_at: string
          day_of_week: number
          end_time: string
          id: string
          is_active: boolean | null
          room_number: string | null
          school_id: string | null
          start_time: string
          subject_id: string
          teacher_id: string | null
          term_id: string | null
          updated_at: string
        }
        Insert: {
          class_id: string
          created_at?: string
          day_of_week: number
          end_time: string
          id?: string
          is_active?: boolean | null
          room_number?: string | null
          school_id?: string | null
          start_time: string
          subject_id: string
          teacher_id?: string | null
          term_id?: string | null
          updated_at?: string
        }
        Update: {
          class_id?: string
          created_at?: string
          day_of_week?: number
          end_time?: string
          id?: string
          is_active?: boolean | null
          room_number?: string | null
          school_id?: string | null
          start_time?: string
          subject_id?: string
          teacher_id?: string | null
          term_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "timetable_slots_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "class_arms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "timetable_slots_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "timetable_slots_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "timetable_slots_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "timetable_slots_term_id_fkey"
            columns: ["term_id"]
            isOneToOne: false
            referencedRelation: "terms"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          approval_status: string
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          school_id: string | null
          user_id: string
        }
        Insert: {
          approval_status?: string
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          school_id?: string | null
          user_id: string
        }
        Update: {
          approval_status?: string
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          school_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      attendance_already_marked: {
        Args: { _date: string; _period: number; _student_id: string }
        Returns: boolean
      }
      attendance_record_class_id: {
        Args: { _session_id: string; _student_id: string }
        Returns: string
      }
      attendance_session_locked: {
        Args: { _session_id: string }
        Returns: boolean
      }
      can_manage_library: { Args: { _user_id: string }; Returns: boolean }
      can_manage_score_for: {
        Args: { _student_id: string; _subject_id: string }
        Returns: boolean
      }
      cascade_remove_pipeline_source: {
        Args: { _source_id: string; _source_type: string }
        Returns: undefined
      }
      compute_grade_for_school: {
        Args: { _school_id: string; _score: number }
        Returns: {
          grade: string
          remark: string
        }[]
      }
      delete_broadsheet_field_cascade: {
        Args: { _field_id: string }
        Returns: undefined
      }
      ensure_default_behavioral_traits: {
        Args: { p_school_id: string }
        Returns: undefined
      }
      find_classroom_by_code: {
        Args: { _code: string }
        Returns: {
          class_id: string
          id: string
          name: string
          school_id: string
        }[]
      }
      find_school_by_code: {
        Args: { _code: string }
        Returns: {
          id: string
          logo_url: string
          name: string
        }[]
      }
      get_broadsheet_field_references: {
        Args: { _field_id: string }
        Returns: {
          computed_field_names: string[]
          mapping_names: string[]
        }[]
      }
      get_my_staff_id: { Args: never; Returns: string }
      get_user_role: {
        Args: { _user_id: string }
        Returns: Database["public"]["Enums"]["app_role"]
      }
      get_user_school_id: { Args: { _user_id: string }; Returns: string }
      has_permission: {
        Args: {
          _permission: Database["public"]["Enums"]["permission_key"]
          _user_id: string
        }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_classroom_co_teacher: {
        Args: { _classroom_id: string }
        Returns: boolean
      }
      is_classroom_member: { Args: { _classroom_id: string }; Returns: boolean }
      is_classroom_owner: { Args: { _classroom_id: string }; Returns: boolean }
      is_form_teacher_of_class: {
        Args: { _class_id: string }
        Returns: boolean
      }
      is_librarian: { Args: { _user_id: string }; Returns: boolean }
      is_staff: { Args: { _user_id: string }; Returns: boolean }
      is_super_admin: { Args: { _user_id: string }; Returns: boolean }
      link_child_to_parent: {
        Args: { p_admission_number: string }
        Returns: string
      }
      promote_to_super_admin: { Args: { _user_id: string }; Returns: undefined }
      recompute_class_transcripts: {
        Args: { p_class_id: string; p_generated_by?: string; p_term_id: string }
        Returns: undefined
      }
      recompute_field_now: { Args: { _field_id: string }; Returns: undefined }
      recompute_final_totals_for: {
        Args: { _school_id: string; _student_id: string; _term_id: string }
        Returns: undefined
      }
      recompute_one_computed_field: {
        Args: {
          _field_id: string
          _formula_operation: string
          _formula_source_field_ids: string[]
          _student_id: string
          _subject_id: string
          _term_id: string
        }
        Returns: undefined
      }
      recompute_transcripts_for_field: {
        Args: { p_field_id: string; p_generated_by?: string }
        Returns: undefined
      }
      review_signup: {
        Args: {
          _decision: string
          _new_role?: Database["public"]["Enums"]["app_role"]
          _target_user_id: string
        }
        Returns: undefined
      }
      same_school: { Args: { _school_id: string }; Returns: boolean }
      teaches_in_class: { Args: { _class_id: string }; Returns: boolean }
      teaches_subject_in_class: {
        Args: { _class_id: string; _subject_id: string }
        Returns: boolean
      }
      unlink_child_from_parent: {
        Args: { p_student_id: string }
        Returns: undefined
      }
    }
    Enums: {
      app_role:
        | "admin"
        | "principal"
        | "teacher"
        | "student"
        | "parent"
        | "accountant"
      assignment_content_type: "typed" | "cbt" | "upload"
      assignment_status: "draft" | "published" | "scheduled"
      assignment_type:
        | "holiday"
        | "mid_term"
        | "weekend"
        | "weekly"
        | "practical"
        | "project"
        | "daily"
        | "practice"
      attachment_type: "file" | "link" | "video" | "image"
      attendance_status: "present" | "absent" | "late" | "excused"
      behavioral_domain: "affective" | "psychomotor"
      class_level: "primary" | "junior_secondary" | "senior_secondary"
      enrollment_status: "active" | "graduated" | "transferred" | "suspended"
      gender_type: "male" | "female"
      notification_type: "info" | "warning" | "success" | "alert"
      payment_method: "cash" | "bank_transfer" | "pos" | "online"
      payment_status: "pending" | "confirmed" | "failed"
      permission_key:
        | "manage_staff"
        | "manage_announcements"
        | "manage_fees"
        | "view_audit_log"
        | "manage_school_settings"
        | "generate_reports"
        | "unlock_attendance"
        | "manage_special_roles"
        | "view_all_timetables"
      question_type: "multiple_choice" | "true_false" | "essay" | "short_answer"
      quiz_type:
        | "resumption"
        | "mid_term"
        | "weekly_test"
        | "end_of_term_exam"
        | "practice"
        | "weekly"
        | "end_term"
      special_role_type:
        | "form_teacher"
        | "games_master"
        | "dean_of_studies"
        | "head_of_department"
        | "exam_officer"
        | "guidance_counselor"
        | "librarian"
        | "ict_coordinator"
        | "head_prefect"
        | "assistant_head_prefect"
        | "class_prefect"
        | "sports_prefect"
        | "library_prefect"
        | "health_prefect"
        | "social_prefect"
        | "labour_prefect"
        | "vice_principal"
        | "duty_marshall"
        | "music_social_coordinator"
        | "utilities_prefect"
        | "regulator"
        | "assistant_regulator"
        | "senior_prefect"
        | "deputy_senior_prefect"
        | "teacher_assistant"
        | "drum_major"
        | "laboratories_prefect"
      submission_status: "submitted" | "graded" | "returned"
      subscription_status: "trialing" | "active" | "past_due" | "cancelled"
      subscription_tier: "trial" | "basic" | "pro" | "enterprise"
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      app_role: [
        "admin",
        "principal",
        "teacher",
        "student",
        "parent",
        "accountant",
      ],
      assignment_content_type: ["typed", "cbt", "upload"],
      assignment_status: ["draft", "published", "scheduled"],
      assignment_type: [
        "holiday",
        "mid_term",
        "weekend",
        "weekly",
        "practical",
        "project",
        "daily",
        "practice",
      ],
      attachment_type: ["file", "link", "video", "image"],
      attendance_status: ["present", "absent", "late", "excused"],
      behavioral_domain: ["affective", "psychomotor"],
      class_level: ["primary", "junior_secondary", "senior_secondary"],
      enrollment_status: ["active", "graduated", "transferred", "suspended"],
      gender_type: ["male", "female"],
      notification_type: ["info", "warning", "success", "alert"],
      payment_method: ["cash", "bank_transfer", "pos", "online"],
      payment_status: ["pending", "confirmed", "failed"],
      permission_key: [
        "manage_staff",
        "manage_announcements",
        "manage_fees",
        "view_audit_log",
        "manage_school_settings",
        "generate_reports",
        "unlock_attendance",
        "manage_special_roles",
        "view_all_timetables",
      ],
      question_type: ["multiple_choice", "true_false", "essay", "short_answer"],
      quiz_type: [
        "resumption",
        "mid_term",
        "weekly_test",
        "end_of_term_exam",
        "practice",
        "weekly",
        "end_term",
      ],
      special_role_type: [
        "form_teacher",
        "games_master",
        "dean_of_studies",
        "head_of_department",
        "exam_officer",
        "guidance_counselor",
        "librarian",
        "ict_coordinator",
        "head_prefect",
        "assistant_head_prefect",
        "class_prefect",
        "sports_prefect",
        "library_prefect",
        "health_prefect",
        "social_prefect",
        "labour_prefect",
        "vice_principal",
        "duty_marshall",
        "music_social_coordinator",
        "utilities_prefect",
        "regulator",
        "assistant_regulator",
        "senior_prefect",
        "deputy_senior_prefect",
        "teacher_assistant",
        "drum_major",
        "laboratories_prefect",
      ],
      submission_status: ["submitted", "graded", "returned"],
      subscription_status: ["trialing", "active", "past_due", "cancelled"],
      subscription_tier: ["trial", "basic", "pro", "enterprise"],
    },
  },
} as const
