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
      books: {
        Row: {
          id: string;
          title: string;
          subject: string;
          grade: string;
          source_type: "nkp_pdf" | "nkp_lesson_page" | "uploaded_pdf";
          source_uri: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          title: string;
          subject: string;
          grade: string;
          source_type: "nkp_pdf" | "nkp_lesson_page" | "uploaded_pdf";
          source_uri: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          title?: string;
          subject?: string;
          grade?: string;
          source_type?: "nkp_pdf" | "nkp_lesson_page" | "uploaded_pdf";
          source_uri?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      book_assets: {
        Row: {
          id: string;
          book_id: string;
          asset_type: "image";
          url: string;
          label: string | null;
          sort_order: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          book_id: string;
          asset_type?: "image";
          url: string;
          label?: string | null;
          sort_order?: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          book_id?: string;
          asset_type?: "image";
          url?: string;
          label?: string | null;
          sort_order?: number;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "book_assets_book_id_fkey";
            columns: ["book_id"];
            isOneToOne: false;
            referencedRelation: "books";
            referencedColumns: ["id"];
          },
        ];
      };
      children: {
        Row: {
          id: string;
          name: string;
          birth_year: number;
          grade: number | null;
          active: boolean;
          parent_notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          birth_year: number;
          grade?: number | null;
          active?: boolean;
          parent_notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          birth_year?: number;
          grade?: number | null;
          active?: boolean;
          parent_notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      child_curriculum_subjects: {
        Row: {
          id: string;
          child_id: string;
          subject_id: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          child_id: string;
          subject_id: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          child_id?: string;
          subject_id?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "child_curriculum_subjects_child_id_fkey";
            columns: ["child_id"];
            isOneToOne: false;
            referencedRelation: "children";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "child_curriculum_subjects_subject_id_fkey";
            columns: ["subject_id"];
            isOneToOne: false;
            referencedRelation: "curriculum_subjects";
            referencedColumns: ["id"];
          },
        ];
      };
      curriculum_source_links: {
        Row: {
          id: string;
          label: string | null;
          source_type: "nkp_pdf" | "nkp_lesson_page" | "uploaded_pdf";
          url: string;
          active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          label?: string | null;
          source_type: "nkp_pdf" | "nkp_lesson_page" | "uploaded_pdf";
          url: string;
          active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          label?: string | null;
          source_type?: "nkp_pdf" | "nkp_lesson_page" | "uploaded_pdf";
          url?: string;
          active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      curriculum_subjects: {
        Row: {
          child_id: string | null;
          id: string;
          grade: number;
          name: string;
          sort_order: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          child_id?: string | null;
          id?: string;
          grade: number;
          name: string;
          sort_order?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          child_id?: string | null;
          id?: string;
          grade?: number;
          name?: string;
          sort_order?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "curriculum_subjects_child_id_fkey";
            columns: ["child_id"];
            isOneToOne: false;
            referencedRelation: "children";
            referencedColumns: ["id"];
          },
        ];
      };
      curriculum_subblock_links: {
        Row: {
          id: string;
          subblock_id: string;
          source_link_id: string;
          sort_order: number;
          content_hint: string | null;
          include_pattern: string | null;
          exclude_pattern: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          subblock_id: string;
          source_link_id: string;
          sort_order?: number;
          content_hint?: string | null;
          include_pattern?: string | null;
          exclude_pattern?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          subblock_id?: string;
          source_link_id?: string;
          sort_order?: number;
          content_hint?: string | null;
          include_pattern?: string | null;
          exclude_pattern?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "curriculum_subblock_links_source_link_id_fkey";
            columns: ["source_link_id"];
            isOneToOne: false;
            referencedRelation: "curriculum_source_links";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "curriculum_subblock_links_subblock_id_fkey";
            columns: ["subblock_id"];
            isOneToOne: false;
            referencedRelation: "curriculum_subblocks";
            referencedColumns: ["id"];
          },
        ];
      };
      curriculum_subblocks: {
        Row: {
          id: string;
          topic_id: string;
          title: string;
          sort_order: number;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          topic_id: string;
          title: string;
          sort_order?: number;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          topic_id?: string;
          title?: string;
          sort_order?: number;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "curriculum_subblocks_topic_id_fkey";
            columns: ["topic_id"];
            isOneToOne: false;
            referencedRelation: "curriculum_topics";
            referencedColumns: ["id"];
          },
        ];
      };
      curriculum_topics: {
        Row: {
          id: string;
          subject_id: string;
          title: string;
          sort_order: number;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          subject_id: string;
          title: string;
          sort_order?: number;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          subject_id?: string;
          title?: string;
          sort_order?: number;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "curriculum_topics_subject_id_fkey";
            columns: ["subject_id"];
            isOneToOne: false;
            referencedRelation: "curriculum_subjects";
            referencedColumns: ["id"];
          },
        ];
      };
      book_progress: {
        Row: {
          id: string;
          child_name: string;
          book_id: string;
          status: "not_started" | "in_progress" | "completed" | "needs_review";
          completed_at: string | null;
          quiz_score: number | null;
          quiz_total: number | null;
          quiz_completed_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          child_name: string;
          book_id: string;
          status?: "not_started" | "in_progress" | "completed" | "needs_review";
          completed_at?: string | null;
          quiz_score?: number | null;
          quiz_total?: number | null;
          quiz_completed_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          child_name?: string;
          book_id?: string;
          status?: "not_started" | "in_progress" | "completed" | "needs_review";
          completed_at?: string | null;
          quiz_score?: number | null;
          quiz_total?: number | null;
          quiz_completed_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "book_progress_book_id_fkey";
            columns: ["book_id"];
            isOneToOne: false;
            referencedRelation: "books";
            referencedColumns: ["id"];
          },
        ];
      };
      lessons: {
        Row: {
          id: string;
          book_id: string;
          title: string;
          chapter: string;
          lesson_order: number;
          goal: string;
          status: "queued" | "extracting" | "structuring" | "completed" | "failed";
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          book_id: string;
          title: string;
          chapter: string;
          lesson_order: number;
          goal: string;
          status: "queued" | "extracting" | "structuring" | "completed" | "failed";
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          book_id?: string;
          title?: string;
          chapter?: string;
          lesson_order?: number;
          goal?: string;
          status?: "queued" | "extracting" | "structuring" | "completed" | "failed";
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "lessons_book_id_fkey";
            columns: ["book_id"];
            isOneToOne: false;
            referencedRelation: "books";
            referencedColumns: ["id"];
          },
        ];
      };
      lesson_chunks: {
        Row: {
          id: string;
          lesson_id: string;
          page_from: number;
          page_to: number;
          raw_text: string;
          cleaned_text: string;
          embedding: number[] | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          lesson_id: string;
          page_from: number;
          page_to: number;
          raw_text: string;
          cleaned_text: string;
          embedding?: number[] | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          lesson_id?: string;
          page_from?: number;
          page_to?: number;
          raw_text?: string;
          cleaned_text?: string;
          embedding?: number[] | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "lesson_chunks_lesson_id_fkey";
            columns: ["lesson_id"];
            isOneToOne: false;
            referencedRelation: "lessons";
            referencedColumns: ["id"];
          },
        ];
      };
      lesson_summaries: {
        Row: {
          id: string;
          lesson_id: string;
          type: "short_summary" | "child_friendly_explanation" | "key_points";
          content: string;
          source_mode: "legacy" | "knowledge_base";
          grounding_score: number;
          factuality_score: number;
          approved: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          lesson_id: string;
          type: "short_summary" | "child_friendly_explanation" | "key_points";
          content: string;
          source_mode?: "legacy" | "knowledge_base";
          grounding_score: number;
          factuality_score: number;
          approved?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          lesson_id?: string;
          type?: "short_summary" | "child_friendly_explanation" | "key_points";
          content?: string;
          source_mode?: "legacy" | "knowledge_base";
          grounding_score?: number;
          factuality_score?: number;
          approved?: boolean;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "lesson_summaries_lesson_id_fkey";
            columns: ["lesson_id"];
            isOneToOne: false;
            referencedRelation: "lessons";
            referencedColumns: ["id"];
          },
        ];
      };
      lesson_summary_reviews: {
        Row: {
          id: string;
          lesson_id: string;
          summary_type: "short_summary" | "key_points";
          source_mode: "legacy" | "knowledge_base";
          quality_score: number;
          factuality_score: number;
          issues: string[];
          improvement_notes: string[];
          corrected_content: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          lesson_id: string;
          summary_type: "short_summary" | "key_points";
          source_mode?: "legacy" | "knowledge_base";
          quality_score?: number;
          factuality_score?: number;
          issues?: string[];
          improvement_notes?: string[];
          corrected_content: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          lesson_id?: string;
          summary_type?: "short_summary" | "key_points";
          source_mode?: "legacy" | "knowledge_base";
          quality_score?: number;
          factuality_score?: number;
          issues?: string[];
          improvement_notes?: string[];
          corrected_content?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "lesson_summary_reviews_lesson_id_fkey";
            columns: ["lesson_id"];
            isOneToOne: false;
            referencedRelation: "lessons";
            referencedColumns: ["id"];
          },
        ];
      };
      subject_knowledge_bases: {
        Row: {
          id: string;
          child_id: string;
          subject_id: string;
          status: "empty" | "processing" | "ready" | "failed";
          provider: "openai_vector_store";
          vector_store_id: string | null;
          last_built_at: string | null;
          error_message: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          child_id: string;
          subject_id: string;
          status?: "empty" | "processing" | "ready" | "failed";
          provider?: "openai_vector_store";
          vector_store_id?: string | null;
          last_built_at?: string | null;
          error_message?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          child_id?: string;
          subject_id?: string;
          status?: "empty" | "processing" | "ready" | "failed";
          provider?: "openai_vector_store";
          vector_store_id?: string | null;
          last_built_at?: string | null;
          error_message?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "subject_knowledge_bases_child_id_fkey";
            columns: ["child_id"];
            isOneToOne: false;
            referencedRelation: "children";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "subject_knowledge_bases_subject_id_fkey";
            columns: ["subject_id"];
            isOneToOne: false;
            referencedRelation: "curriculum_subjects";
            referencedColumns: ["id"];
          },
        ];
      };
      subject_knowledge_files: {
        Row: {
          id: string;
          knowledge_base_id: string;
          storage_path: string;
          file_name: string;
          mime_type: string;
          file_size_bytes: number | null;
          openai_file_id: string | null;
          processing_status: "uploaded" | "processing" | "ready" | "failed";
          page_count: number | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          knowledge_base_id: string;
          storage_path: string;
          file_name: string;
          mime_type: string;
          file_size_bytes?: number | null;
          openai_file_id?: string | null;
          processing_status?: "uploaded" | "processing" | "ready" | "failed";
          page_count?: number | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          knowledge_base_id?: string;
          storage_path?: string;
          file_name?: string;
          mime_type?: string;
          file_size_bytes?: number | null;
          openai_file_id?: string | null;
          processing_status?: "uploaded" | "processing" | "ready" | "failed";
          page_count?: number | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "subject_knowledge_files_knowledge_base_id_fkey";
            columns: ["knowledge_base_id"];
            isOneToOne: false;
            referencedRelation: "subject_knowledge_bases";
            referencedColumns: ["id"];
          },
        ];
      };
      subject_knowledge_segments: {
        Row: {
          id: string;
          knowledge_base_id: string;
          file_id: string;
          page_number: number;
          segment_type: "content" | "exercise" | "noise" | "source_note";
          raw_text: string;
          cleaned_text: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          knowledge_base_id: string;
          file_id: string;
          page_number: number;
          segment_type?: "content" | "exercise" | "noise" | "source_note";
          raw_text: string;
          cleaned_text: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          knowledge_base_id?: string;
          file_id?: string;
          page_number?: number;
          segment_type?: "content" | "exercise" | "noise" | "source_note";
          raw_text?: string;
          cleaned_text?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "subject_knowledge_segments_file_id_fkey";
            columns: ["file_id"];
            isOneToOne: false;
            referencedRelation: "subject_knowledge_files";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "subject_knowledge_segments_knowledge_base_id_fkey";
            columns: ["knowledge_base_id"];
            isOneToOne: false;
            referencedRelation: "subject_knowledge_bases";
            referencedColumns: ["id"];
          },
        ];
      };
      summary_jobs: {
        Row: {
          id: string;
          child_name: string | null;
          subject: string | null;
          topic_title: string | null;
          source_group_label: string | null;
          vector_store_id: string | null;
          lesson_id: string | null;
          status: "queued" | "extracting" | "structuring" | "completed" | "failed";
          requested_at: string;
          started_at: string | null;
          finished_at: string | null;
          result_count: number;
          error_message: string | null;
        };
        Insert: {
          id?: string;
          child_name?: string | null;
          subject?: string | null;
          topic_title?: string | null;
          source_group_label?: string | null;
          vector_store_id?: string | null;
          lesson_id?: string | null;
          status?: "queued" | "extracting" | "structuring" | "completed" | "failed";
          requested_at?: string;
          started_at?: string | null;
          finished_at?: string | null;
          result_count?: number;
          error_message?: string | null;
        };
        Update: {
          id?: string;
          child_name?: string | null;
          subject?: string | null;
          topic_title?: string | null;
          source_group_label?: string | null;
          vector_store_id?: string | null;
          lesson_id?: string | null;
          status?: "queued" | "extracting" | "structuring" | "completed" | "failed";
          requested_at?: string;
          started_at?: string | null;
          finished_at?: string | null;
          result_count?: number;
          error_message?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "summary_jobs_lesson_id_fkey";
            columns: ["lesson_id"];
            isOneToOne: false;
            referencedRelation: "lessons";
            referencedColumns: ["id"];
          },
        ];
      };
      ingest_jobs: {
        Row: {
          id: string;
          book_id: string;
          status: "queued" | "extracting" | "structuring" | "completed" | "failed";
          requested_at: string;
          started_at: string | null;
          finished_at: string | null;
          error_message: string | null;
        };
        Insert: {
          id?: string;
          book_id: string;
          status: "queued" | "extracting" | "structuring" | "completed" | "failed";
          requested_at?: string;
          started_at?: string | null;
          finished_at?: string | null;
          error_message?: string | null;
        };
        Update: {
          id?: string;
          book_id?: string;
          status?: "queued" | "extracting" | "structuring" | "completed" | "failed";
          requested_at?: string;
          started_at?: string | null;
          finished_at?: string | null;
          error_message?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "ingest_jobs_book_id_fkey";
            columns: ["book_id"];
            isOneToOne: false;
            referencedRelation: "books";
            referencedColumns: ["id"];
          },
        ];
      };
      quiz_items: {
        Row: {
          id: string;
          lesson_id: string;
          question: string;
          options_json: Json;
          correct_answer: string;
          explanation: string;
          source_quote: string;
          source_page: number;
          grounding_score: number;
          factuality_score: number;
          approved: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          lesson_id: string;
          question: string;
          options_json: Json;
          correct_answer: string;
          explanation: string;
          source_quote: string;
          source_page: number;
          grounding_score: number;
          factuality_score: number;
          approved?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          lesson_id?: string;
          question?: string;
          options_json?: Json;
          correct_answer?: string;
          explanation?: string;
          source_quote?: string;
          source_page?: number;
          grounding_score?: number;
          factuality_score?: number;
          approved?: boolean;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "quiz_items_lesson_id_fkey";
            columns: ["lesson_id"];
            isOneToOne: false;
            referencedRelation: "lessons";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: {
      source_type: "nkp_pdf" | "nkp_lesson_page" | "uploaded_pdf";
      lesson_summary_type:
        | "short_summary"
        | "child_friendly_explanation"
        | "key_points";
      lesson_progress_status:
        | "not_started"
        | "in_progress"
        | "completed"
        | "needs_review";
      ingest_job_status:
        | "queued"
        | "extracting"
        | "structuring"
        | "completed"
        | "failed";
    };
    CompositeTypes: Record<string, never>;
  };
};
