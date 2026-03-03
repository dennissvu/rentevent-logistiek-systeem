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
      driver_day_route_stops: {
        Row: {
          assignment_id: string | null
          assigned_vehicles: Json | null
          created_at: string
          drive_time_from_previous: number | null
          estimated_arrival: string | null
          estimated_departure: string | null
          id: string
          load_unload_minutes: number | null
          location_address: string | null
          notes: string | null
          order_id: string
          route_id: string
          sequence_number: number
          stop_type: string
          updated_at: string
        }
        Insert: {
          assignment_id?: string | null
          assigned_vehicles?: Json | null
          created_at?: string
          drive_time_from_previous?: number | null
          estimated_arrival?: string | null
          estimated_departure?: string | null
          id?: string
          load_unload_minutes?: number | null
          location_address?: string | null
          notes?: string | null
          order_id: string
          route_id: string
          sequence_number?: number
          stop_type: string
          updated_at?: string
        }
        Update: {
          assignment_id?: string | null
          assigned_vehicles?: Json | null
          created_at?: string
          drive_time_from_previous?: number | null
          estimated_arrival?: string | null
          estimated_departure?: string | null
          id?: string
          load_unload_minutes?: number | null
          location_address?: string | null
          notes?: string | null
          order_id?: string
          route_id?: string
          sequence_number?: number
          stop_type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "driver_day_route_stops_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "order_transport_assignments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "driver_day_route_stops_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "driver_day_route_stops_route_id_fkey"
            columns: ["route_id"]
            isOneToOne: false
            referencedRelation: "driver_day_routes"
            referencedColumns: ["id"]
          },
        ]
      }
      driver_day_routes: {
        Row: {
          created_at: string
          driver_id: string
          id: string
          notes: string | null
          route_date: string
          status: string
          transport_material_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          driver_id: string
          id?: string
          notes?: string | null
          route_date: string
          status?: string
          transport_material_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          driver_id?: string
          id?: string
          notes?: string | null
          route_date?: string
          status?: string
          transport_material_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "driver_day_routes_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
        ]
      }
      driver_schedule_exceptions: {
        Row: {
          created_at: string
          driver_id: string
          end_time: string | null
          exception_date: string
          exception_type: string
          id: string
          is_available: boolean
          notes: string | null
          start_time: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          driver_id: string
          end_time?: string | null
          exception_date: string
          exception_type?: string
          id?: string
          is_available?: boolean
          notes?: string | null
          start_time?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          driver_id?: string
          end_time?: string | null
          exception_date?: string
          exception_type?: string
          id?: string
          is_available?: boolean
          notes?: string | null
          start_time?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "driver_schedule_exceptions_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
        ]
      }
      driver_weekly_schedules: {
        Row: {
          created_at: string
          day_of_week: number
          driver_id: string
          end_time_1: string | null
          end_time_2: string | null
          id: string
          is_working: boolean
          start_time_1: string | null
          start_time_2: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          day_of_week: number
          driver_id: string
          end_time_1?: string | null
          end_time_2?: string | null
          id?: string
          is_working?: boolean
          start_time_1?: string | null
          start_time_2?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          day_of_week?: number
          driver_id?: string
          end_time_1?: string | null
          end_time_2?: string | null
          id?: string
          is_working?: boolean
          start_time_1?: string | null
          start_time_2?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "driver_weekly_schedules_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
        ]
      }
      drivers: {
        Row: {
          can_drive_trailer: boolean
          created_at: string
          id: string
          is_active: boolean
          is_available: boolean
          name: string
          phone: string | null
          updated_at: string
        }
        Insert: {
          can_drive_trailer?: boolean
          created_at?: string
          id?: string
          is_active?: boolean
          is_available?: boolean
          name: string
          phone?: string | null
          updated_at?: string
        }
        Update: {
          can_drive_trailer?: boolean
          created_at?: string
          id?: string
          is_active?: boolean
          is_available?: boolean
          name?: string
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      order_load_unload_instructions: {
        Row: {
          action: string
          assignment_id: string
          created_at: string
          custom_duration_minutes: number | null
          helper_count: number
          helper_driver_ids: Json | null
          id: string
          location: string
          notes: string | null
          order_id: string
          sequence_number: number
          stay_loaded_count: number
          target_transport_id: string | null
          updated_at: string
          vehicle_count: number
          vehicle_type: string
        }
        Insert: {
          action?: string
          assignment_id: string
          created_at?: string
          custom_duration_minutes?: number | null
          helper_count?: number
          helper_driver_ids?: Json | null
          id?: string
          location?: string
          notes?: string | null
          order_id: string
          sequence_number?: number
          stay_loaded_count?: number
          target_transport_id?: string | null
          updated_at?: string
          vehicle_count?: number
          vehicle_type: string
        }
        Update: {
          action?: string
          assignment_id?: string
          created_at?: string
          custom_duration_minutes?: number | null
          helper_count?: number
          helper_driver_ids?: Json | null
          id?: string
          location?: string
          notes?: string | null
          order_id?: string
          sequence_number?: number
          stay_loaded_count?: number
          target_transport_id?: string | null
          updated_at?: string
          vehicle_count?: number
          vehicle_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_load_unload_instructions_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "order_transport_assignments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_load_unload_instructions_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      order_signatures: {
        Row: {
          created_at: string
          driver_id: string | null
          id: string
          ip_address: string | null
          order_id: string
          segment: string
          signature_url: string
          signed_at: string
          signer_name: string
        }
        Insert: {
          created_at?: string
          driver_id?: string | null
          id?: string
          ip_address?: string | null
          order_id: string
          segment?: string
          signature_url: string
          signed_at?: string
          signer_name: string
        }
        Update: {
          created_at?: string
          driver_id?: string | null
          id?: string
          ip_address?: string | null
          order_id?: string
          segment?: string
          signature_url?: string
          signed_at?: string
          signer_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_signatures_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_signatures_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      order_transport_assignments: {
        Row: {
          created_at: string
          driver_id: string | null
          id: string
          order_id: string
          segment: string
          sequence_number: number
          transport_id: string
          trip_status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          driver_id?: string | null
          id?: string
          order_id: string
          segment: string
          sequence_number?: number
          transport_id: string
          trip_status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          driver_id?: string | null
          id?: string
          order_id?: string
          segment?: string
          sequence_number?: number
          transport_id?: string
          trip_status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_transport_assignments_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          assigned_driver_leveren: string | null
          assigned_driver_ophalen: string | null
          assigned_transport_leveren: string | null
          assigned_transport_ophalen: string | null
          combined_unloading_leveren: boolean
          combined_unloading_ophalen: boolean
          company_name: string | null
          created_at: string
          delivery_date: string | null
          delivery_time: string | null
          delivery_window_end: string | null
          delivery_window_start: string | null
          driver_returns_to_shop: boolean | null
          email: string
          end_date: string
          end_location: string
          end_time: string
          first_name: string
          id: string
          last_name: string
          notes: string | null
          number_of_persons: number
          order_number: string
          phone: string
          pickup_date: string | null
          pickup_time: string | null
          pickup_window_end: string | null
          pickup_window_start: string | null
          reseller: string | null
          start_date: string
          start_location: string
          start_time: string
          status: string
          updated_at: string
          vehicle_types: Json | null
        }
        Insert: {
          assigned_driver_leveren?: string | null
          assigned_driver_ophalen?: string | null
          assigned_transport_leveren?: string | null
          assigned_transport_ophalen?: string | null
          combined_unloading_leveren?: boolean
          combined_unloading_ophalen?: boolean
          company_name?: string | null
          created_at?: string
          delivery_date?: string | null
          delivery_time?: string | null
          delivery_window_end?: string | null
          delivery_window_start?: string | null
          driver_returns_to_shop?: boolean | null
          email: string
          end_date: string
          end_location: string
          end_time: string
          first_name: string
          id?: string
          last_name: string
          notes?: string | null
          number_of_persons?: number
          order_number: string
          phone: string
          pickup_date?: string | null
          pickup_time?: string | null
          pickup_window_end?: string | null
          pickup_window_start?: string | null
          reseller?: string | null
          start_date: string
          start_location: string
          start_time: string
          status?: string
          updated_at?: string
          vehicle_types?: Json | null
        }
        Update: {
          assigned_driver_leveren?: string | null
          assigned_driver_ophalen?: string | null
          assigned_transport_leveren?: string | null
          assigned_transport_ophalen?: string | null
          combined_unloading_leveren?: boolean
          combined_unloading_ophalen?: boolean
          company_name?: string | null
          created_at?: string
          delivery_date?: string | null
          delivery_time?: string | null
          delivery_window_end?: string | null
          delivery_window_start?: string | null
          driver_returns_to_shop?: boolean | null
          email?: string
          end_date?: string
          end_location?: string
          end_time?: string
          first_name?: string
          id?: string
          last_name?: string
          notes?: string | null
          number_of_persons?: number
          order_number?: string
          phone?: string
          pickup_date?: string | null
          pickup_time?: string | null
          pickup_window_end?: string | null
          pickup_window_start?: string | null
          reseller?: string | null
          start_date?: string
          start_location?: string
          start_time?: string
          status?: string
          updated_at?: string
          vehicle_types?: Json | null
        }
        Relationships: []
      }
      planning_memory: {
        Row: {
          category: string
          content: string
          created_at: string
          id: string
          is_active: boolean
          updated_at: string
        }
        Insert: {
          category?: string
          content: string
          created_at?: string
          id?: string
          is_active?: boolean
          updated_at?: string
        }
        Update: {
          category?: string
          content?: string
          created_at?: string
          id?: string
          is_active?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      transport_combis: {
        Row: {
          aanhanger_id: string | null
          bakwagen_id: string | null
          capacity_bikes: number
          capacity_choppers: number
          capacity_fatbikes: number
          capacity_fietsen: number
          capacity_tweepers: number
          code: string
          created_at: string
          id: string
          is_active: boolean
          name: string
          updated_at: string
        }
        Insert: {
          aanhanger_id?: string | null
          bakwagen_id?: string | null
          capacity_bikes?: number
          capacity_choppers?: number
          capacity_fatbikes?: number
          capacity_fietsen?: number
          capacity_tweepers?: number
          code: string
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          aanhanger_id?: string | null
          bakwagen_id?: string | null
          capacity_bikes?: number
          capacity_choppers?: number
          capacity_fatbikes?: number
          capacity_fietsen?: number
          capacity_tweepers?: number
          code?: string
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "transport_combis_aanhanger_id_fkey"
            columns: ["aanhanger_id"]
            isOneToOne: false
            referencedRelation: "transport_materials"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transport_combis_bakwagen_id_fkey"
            columns: ["bakwagen_id"]
            isOneToOne: false
            referencedRelation: "transport_materials"
            referencedColumns: ["id"]
          },
        ]
      }
      transport_current_load: {
        Row: {
          created_at: string
          id: string
          loaded_at: string
          notes: string | null
          source_assignment_id: string | null
          source_order_id: string | null
          transport_material_id: string
          updated_at: string
          vehicle_count: number
          vehicle_type: string
        }
        Insert: {
          created_at?: string
          id?: string
          loaded_at?: string
          notes?: string | null
          source_assignment_id?: string | null
          source_order_id?: string | null
          transport_material_id: string
          updated_at?: string
          vehicle_count?: number
          vehicle_type: string
        }
        Update: {
          created_at?: string
          id?: string
          loaded_at?: string
          notes?: string | null
          source_assignment_id?: string | null
          source_order_id?: string | null
          transport_material_id?: string
          updated_at?: string
          vehicle_count?: number
          vehicle_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "transport_current_load_source_assignment_id_fkey"
            columns: ["source_assignment_id"]
            isOneToOne: false
            referencedRelation: "order_transport_assignments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transport_current_load_source_order_id_fkey"
            columns: ["source_order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transport_current_load_transport_material_id_fkey"
            columns: ["transport_material_id"]
            isOneToOne: false
            referencedRelation: "transport_materials"
            referencedColumns: ["id"]
          },
        ]
      }
      transport_materials: {
        Row: {
          capacity_bikes: number
          capacity_choppers: number
          capacity_fatbikes: number
          capacity_fietsen: number
          capacity_tweepers: number
          code: string
          created_at: string
          id: string
          is_active: boolean
          name: string
          type: string
          updated_at: string
        }
        Insert: {
          capacity_bikes?: number
          capacity_choppers?: number
          capacity_fatbikes?: number
          capacity_fietsen?: number
          capacity_tweepers?: number
          code: string
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          type: string
          updated_at?: string
        }
        Update: {
          capacity_bikes?: number
          capacity_choppers?: number
          capacity_fatbikes?: number
          capacity_fietsen?: number
          capacity_tweepers?: number
          code?: string
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          type?: string
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
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
