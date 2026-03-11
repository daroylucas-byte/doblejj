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
      caja_cierres: {
        Row: {
          created_at: string | null
          diferencia: number
          fecha_apertura: string
          fecha_cierre: string
          id: string
          notas: string | null
          saldo_inicial: number
          saldo_real: number
          saldo_teorico: number
          total_egresos: number
          total_ingresos: number
          usuario_id: string | null
        }
        Insert: {
          created_at?: string | null
          diferencia?: number
          fecha_apertura: string
          fecha_cierre?: string
          id?: string
          notas?: string | null
          saldo_inicial?: number
          saldo_real?: number
          saldo_teorico?: number
          total_egresos?: number
          total_ingresos?: number
          usuario_id?: string | null
        }
        Update: {
          created_at?: string | null
          diferencia?: number
          fecha_apertura?: string
          fecha_cierre?: string
          id?: string
          notas?: string | null
          saldo_inicial?: number
          saldo_real?: number
          saldo_teorico?: number
          total_egresos?: number
          total_ingresos?: number
          usuario_id?: string | null
        }
        Relationships: []
      }
      categorias: {
        Row: {
          activo: boolean
          created_at: string
          descripcion: string | null
          id: string
          nombre: string
        }
        Insert: {
          activo?: boolean
          created_at?: string
          descripcion?: string | null
          id?: string
          nombre: string
        }
        Update: {
          activo?: boolean
          created_at?: string
          descripcion?: string | null
          id?: string
          nombre?: string
        }
        Relationships: []
      }
      categorias_gasto: {
        Row: {
          activo: boolean
          created_at: string
          descripcion: string | null
          id: string
          nombre: string
        }
        Insert: {
          activo?: boolean
          created_at?: string
          descripcion?: string | null
          id?: string
          nombre: string
        }
        Update: {
          activo?: boolean
          created_at?: string
          descripcion?: string | null
          id?: string
          nombre?: string
        }
        Relationships: []
      }
      clientes: {
        Row: {
          activo: boolean
          created_at: string
          cuit: string | null
          direccion: string | null
          dni: string | null
          email: string | null
          id: string
          limite_credito: number
          localidad: string | null
          nombre_fantasia: string | null
          notas: string | null
          razon_social: string
          saldo_actual: number
          telefono: string | null
          tipo: string
          updated_at: string
        }
        Insert: {
          activo?: boolean
          created_at?: string
          cuit?: string | null
          direccion?: string | null
          dni?: string | null
          email?: string | null
          id?: string
          limite_credito?: number
          localidad?: string | null
          nombre_fantasia?: string | null
          notas?: string | null
          razon_social: string
          saldo_actual?: number
          telefono?: string | null
          tipo: string
          updated_at?: string
        }
        Update: {
          activo?: boolean
          created_at?: string
          cuit?: string | null
          direccion?: string | null
          dni?: string | null
          email?: string | null
          id?: string
          limite_credito?: number
          localidad?: string | null
          nombre_fantasia?: string | null
          notas?: string | null
          razon_social?: string
          saldo_actual?: number
          telefono?: string | null
          tipo?: string
          updated_at?: string
        }
        Relationships: []
      }
      compra_items: {
        Row: {
          cantidad: number
          cantidad_recibida: number
          compra_id: string
          created_at: string
          id: string
          precio_unitario: number
          producto_id: string
          subtotal: number
        }
        Insert: {
          cantidad: number
          cantidad_recibida?: number
          compra_id: string
          created_at?: string
          id?: string
          precio_unitario: number
          producto_id: string
          subtotal: number
        }
        Update: {
          cantidad?: number
          cantidad_recibida?: number
          compra_id?: string
          created_at?: string
          id?: string
          precio_unitario?: number
          producto_id?: string
          subtotal?: number
        }
        Relationships: [
          {
            foreignKeyName: "compra_items_compra_id_fkey"
            columns: ["compra_id"]
            isOneToOne: false
            referencedRelation: "compras"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "compra_items_producto_id_fkey"
            columns: ["producto_id"]
            isOneToOne: false
            referencedRelation: "productos"
            referencedColumns: ["id"]
          },
        ]
      }
      compras: {
        Row: {
          created_at: string
          descuento_monto: number
          estado: string
          fecha: string
          id: string
          notas: string | null
          nro_comprobante: string | null
          numero: string | null
          proveedor_id: string
          subtotal: number
          tipo_comprobante: string | null
          total: number
          updated_at: string
          usuario_id: string | null
        }
        Insert: {
          created_at?: string
          descuento_monto?: number
          estado?: string
          fecha?: string
          id?: string
          notas?: string | null
          nro_comprobante?: string | null
          numero?: string | null
          proveedor_id: string
          subtotal?: number
          tipo_comprobante?: string | null
          total?: number
          updated_at?: string
          usuario_id?: string | null
        }
        Update: {
          created_at?: string
          descuento_monto?: number
          estado?: string
          fecha?: string
          id?: string
          notas?: string | null
          nro_comprobante?: string | null
          numero?: string | null
          proveedor_id?: string
          subtotal?: number
          tipo_comprobante?: string | null
          total?: number
          updated_at?: string
          usuario_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "compras_proveedor_id_fkey"
            columns: ["proveedor_id"]
            isOneToOne: false
            referencedRelation: "proveedores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "compras_usuario_id_fkey"
            columns: ["usuario_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      cuenta_corriente: {
        Row: {
          cliente_id: string
          concepto: string
          created_at: string
          fecha: string
          id: string
          monto: number
          saldo_acumulado: number
          tipo: string
          usuario_id: string | null
          venta_id: string | null
        }
        Insert: {
          cliente_id: string
          concepto: string
          created_at?: string
          fecha: string
          id?: string
          monto: number
          saldo_acumulado: number
          tipo: string
          usuario_id?: string | null
          venta_id?: string | null
        }
        Update: {
          cliente_id?: string
          concepto?: string
          created_at?: string
          fecha?: string
          id?: string
          monto?: number
          saldo_acumulado?: number
          tipo?: string
          usuario_id?: string | null
          venta_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cuenta_corriente_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cuenta_corriente_usuario_id_fkey"
            columns: ["usuario_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cuenta_corriente_venta_id_fkey"
            columns: ["venta_id"]
            isOneToOne: false
            referencedRelation: "ventas"
            referencedColumns: ["id"]
          },
        ]
      }
      cuenta_corriente_proveedores: {
        Row: {
          compra_id: string | null
          concepto: string
          created_at: string
          fecha: string
          id: string
          monto: number
          proveedor_id: string
          saldo_acumulado: number
          tipo: string
          usuario_id: string | null
        }
        Insert: {
          compra_id?: string | null
          concepto: string
          created_at?: string
          fecha: string
          id?: string
          monto: number
          proveedor_id: string
          saldo_acumulado: number
          tipo: string
          usuario_id?: string | null
        }
        Update: {
          compra_id?: string | null
          concepto?: string
          created_at?: string
          fecha?: string
          id?: string
          monto?: number
          proveedor_id?: string
          saldo_acumulado?: number
          tipo?: string
          usuario_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cuenta_corriente_proveedores_proveedor_id_fkey"
            columns: ["proveedor_id"]
            isOneToOne: false
            referencedRelation: "proveedores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cuenta_corriente_proveedores_usuario_id_fkey"
            columns: ["usuario_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_ccp_compra"
            columns: ["compra_id"]
            isOneToOne: false
            referencedRelation: "compras"
            referencedColumns: ["id"]
          },
        ]
      }
      gastos: {
        Row: {
          categoria_gasto_id: string
          comprobante_nro: string | null
          concepto: string
          created_at: string
          fecha: string
          forma_pago: string
          gasto_recurrente_id: string | null
          id: string
          monto: number
          notas: string | null
          proveedor_id: string | null
          recurrente: boolean
          updated_at: string
          usuario_id: string | null
        }
        Insert: {
          categoria_gasto_id: string
          comprobante_nro?: string | null
          concepto: string
          created_at?: string
          fecha?: string
          forma_pago: string
          gasto_recurrente_id?: string | null
          id?: string
          monto: number
          notas?: string | null
          proveedor_id?: string | null
          recurrente?: boolean
          updated_at?: string
          usuario_id?: string | null
        }
        Update: {
          categoria_gasto_id?: string
          comprobante_nro?: string | null
          concepto?: string
          created_at?: string
          fecha?: string
          forma_pago?: string
          gasto_recurrente_id?: string | null
          id?: string
          monto?: number
          notas?: string | null
          proveedor_id?: string | null
          recurrente?: boolean
          updated_at?: string
          usuario_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "gastos_categoria_gasto_id_fkey"
            columns: ["categoria_gasto_id"]
            isOneToOne: false
            referencedRelation: "categorias_gasto"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gastos_gasto_recurrente_id_fkey"
            columns: ["gasto_recurrente_id"]
            isOneToOne: false
            referencedRelation: "gastos_recurrentes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gastos_proveedor_id_fkey"
            columns: ["proveedor_id"]
            isOneToOne: false
            referencedRelation: "proveedores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gastos_usuario_id_fkey"
            columns: ["usuario_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      gastos_recurrentes: {
        Row: {
          activo: boolean
          categoria_gasto_id: string
          concepto: string
          created_at: string
          dia_del_mes: number | null
          id: string
          monto_estimado: number | null
        }
        Insert: {
          activo?: boolean
          categoria_gasto_id: string
          concepto: string
          created_at?: string
          dia_del_mes?: number | null
          id?: string
          monto_estimado?: number | null
        }
        Update: {
          activo?: boolean
          categoria_gasto_id?: string
          concepto?: string
          created_at?: string
          dia_del_mes?: number | null
          id?: string
          monto_estimado?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "gastos_recurrentes_categoria_gasto_id_fkey"
            columns: ["categoria_gasto_id"]
            isOneToOne: false
            referencedRelation: "categorias_gasto"
            referencedColumns: ["id"]
          },
        ]
      }
      movimientos_stock: {
        Row: {
          cantidad: number
          created_at: string
          id: string
          motivo: string | null
          producto_id: string
          referencia_id: string | null
          referencia_tipo: string | null
          stock_anterior: number
          stock_nuevo: number
          tipo: string
          usuario_id: string | null
        }
        Insert: {
          cantidad: number
          created_at?: string
          id?: string
          motivo?: string | null
          producto_id: string
          referencia_id?: string | null
          referencia_tipo?: string | null
          stock_anterior: number
          stock_nuevo: number
          tipo: string
          usuario_id?: string | null
        }
        Update: {
          cantidad?: number
          created_at?: string
          id?: string
          motivo?: string | null
          producto_id?: string
          referencia_id?: string | null
          referencia_tipo?: string | null
          stock_anterior?: number
          stock_nuevo?: number
          tipo?: string
          usuario_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "movimientos_stock_producto_id_fkey"
            columns: ["producto_id"]
            isOneToOne: false
            referencedRelation: "productos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "movimientos_stock_usuario_id_fkey"
            columns: ["usuario_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      pagos: {
        Row: {
          cliente_id: string | null
          created_at: string
          estado: string
          fecha: string
          forma_pago: string
          id: string
          monto: number
          referencia: string | null
          updated_at: string
          usuario_id: string | null
          venta_id: string
        }
        Insert: {
          cliente_id?: string | null
          created_at?: string
          estado?: string
          fecha?: string
          forma_pago: string
          id?: string
          monto: number
          referencia?: string | null
          updated_at?: string
          usuario_id?: string | null
          venta_id: string
        }
        Update: {
          cliente_id?: string | null
          created_at?: string
          estado?: string
          fecha?: string
          forma_pago?: string
          id?: string
          monto?: number
          referencia?: string | null
          updated_at?: string
          usuario_id?: string | null
          venta_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pagos_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pagos_usuario_id_fkey"
            columns: ["usuario_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pagos_venta_id_fkey"
            columns: ["venta_id"]
            isOneToOne: false
            referencedRelation: "ventas"
            referencedColumns: ["id"]
          },
        ]
      }
      pagos_proveedores: {
        Row: {
          compra_id: string | null
          created_at: string
          estado: string
          fecha: string
          forma_pago: string
          id: string
          monto: number
          proveedor_id: string
          referencia: string | null
          updated_at: string
          usuario_id: string | null
        }
        Insert: {
          compra_id?: string | null
          created_at?: string
          estado?: string
          fecha?: string
          forma_pago: string
          id?: string
          monto: number
          proveedor_id: string
          referencia?: string | null
          updated_at?: string
          usuario_id?: string | null
        }
        Update: {
          compra_id?: string | null
          created_at?: string
          estado?: string
          fecha?: string
          forma_pago?: string
          id?: string
          monto?: number
          proveedor_id?: string
          referencia?: string | null
          updated_at?: string
          usuario_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pagos_proveedores_compra_id_fkey"
            columns: ["compra_id"]
            isOneToOne: false
            referencedRelation: "compras"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pagos_proveedores_proveedor_id_fkey"
            columns: ["proveedor_id"]
            isOneToOne: false
            referencedRelation: "proveedores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pagos_proveedores_usuario_id_fkey"
            columns: ["usuario_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      productos: {
        Row: {
          activo: boolean
          categoria_id: string | null
          codigo: string | null
          created_at: string
          descripcion: string | null
          id: string
          imagen_url: string | null
          nombre: string
          precio_costo: number
          precio_mayorista: number
          precio_minorista: number
          precio_revendedor: number
          stock_actual: number
          stock_minimo: number
          unidad_medida: string
          updated_at: string
        }
        Insert: {
          activo?: boolean
          categoria_id?: string | null
          codigo?: string | null
          created_at?: string
          descripcion?: string | null
          id?: string
          imagen_url?: string | null
          nombre: string
          precio_costo?: number
          precio_mayorista?: number
          precio_minorista?: number
          precio_revendedor?: number
          stock_actual?: number
          stock_minimo?: number
          unidad_medida: string
          updated_at?: string
        }
        Update: {
          activo?: boolean
          categoria_id?: string | null
          codigo?: string | null
          created_at?: string
          descripcion?: string | null
          id?: string
          imagen_url?: string | null
          nombre?: string
          precio_costo?: number
          precio_mayorista?: number
          precio_minorista?: number
          precio_revendedor?: number
          stock_actual?: number
          stock_minimo?: number
          unidad_medida?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "productos_categoria_id_fkey"
            columns: ["categoria_id"]
            isOneToOne: false
            referencedRelation: "categorias"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          activo: boolean
          apellido: string
          created_at: string
          id: string
          nombre: string
          rol: string
          updated_at: string
        }
        Insert: {
          activo?: boolean
          apellido: string
          created_at?: string
          id: string
          nombre: string
          rol: string
          updated_at?: string
        }
        Update: {
          activo?: boolean
          apellido?: string
          created_at?: string
          id?: string
          nombre?: string
          rol?: string
          updated_at?: string
        }
        Relationships: []
      }
      proveedores: {
        Row: {
          activo: boolean
          categoria_proveedor: string | null
          condicion_pago: string | null
          contacto_nombre: string | null
          contacto_telefono: string | null
          created_at: string
          cuit: string | null
          direccion: string | null
          email: string | null
          id: string
          limite_credito: number
          localidad: string | null
          nombre_fantasia: string | null
          notas: string | null
          razon_social: string
          saldo_actual: number
          telefono: string | null
          updated_at: string
        }
        Insert: {
          activo?: boolean
          categoria_proveedor?: string | null
          condicion_pago?: string | null
          contacto_nombre?: string | null
          contacto_telefono?: string | null
          created_at?: string
          cuit?: string | null
          direccion?: string | null
          email?: string | null
          id?: string
          limite_credito?: number
          localidad?: string | null
          nombre_fantasia?: string | null
          notas?: string | null
          razon_social: string
          saldo_actual?: number
          telefono?: string | null
          updated_at?: string
        }
        Update: {
          activo?: boolean
          categoria_proveedor?: string | null
          condicion_pago?: string | null
          contacto_nombre?: string | null
          contacto_telefono?: string | null
          created_at?: string
          cuit?: string | null
          direccion?: string | null
          email?: string | null
          id?: string
          limite_credito?: number
          localidad?: string | null
          nombre_fantasia?: string | null
          notas?: string | null
          razon_social?: string
          saldo_actual?: number
          telefono?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      venta_items: {
        Row: {
          cantidad: number
          created_at: string
          descuento: number
          id: string
          precio_unitario: number
          producto_id: string
          subtotal: number
          venta_id: string
        }
        Insert: {
          cantidad: number
          created_at?: string
          descuento?: number
          id?: string
          precio_unitario: number
          producto_id: string
          subtotal: number
          venta_id: string
        }
        Update: {
          cantidad?: number
          created_at?: string
          descuento?: number
          id?: string
          precio_unitario?: number
          producto_id?: string
          subtotal?: number
          venta_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "venta_items_producto_id_fkey"
            columns: ["producto_id"]
            isOneToOne: false
            referencedRelation: "productos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "venta_items_venta_id_fkey"
            columns: ["venta_id"]
            isOneToOne: false
            referencedRelation: "ventas"
            referencedColumns: ["id"]
          },
        ]
      }
      ventas: {
        Row: {
          cliente_id: string | null
          created_at: string
          descuento_monto: number
          descuento_porcentaje: number
          estado: string
          fecha: string
          id: string
          notas: string | null
          numero: string | null
          saldo_pendiente: number
          subtotal: number
          tipo_comprobante: string
          total: number
          total_pagado: number
          updated_at: string
          vendedor_id: string | null
        }
        Insert: {
          cliente_id?: string | null
          created_at?: string
          descuento_monto?: number
          descuento_porcentaje?: number
          estado?: string
          fecha?: string
          id?: string
          notas?: string | null
          numero?: string | null
          saldo_pendiente?: number
          subtotal?: number
          tipo_comprobante?: string
          total?: number
          total_pagado?: number
          updated_at?: string
          vendedor_id?: string | null
        }
        Update: {
          cliente_id?: string | null
          created_at?: string
          descuento_monto?: number
          descuento_porcentaje?: number
          estado?: string
          fecha?: string
          id?: string
          notas?: string | null
          numero?: string | null
          saldo_pendiente?: number
          subtotal?: number
          tipo_comprobante?: string
          total?: number
          total_pagado?: number
          updated_at?: string
          vendedor_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ventas_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ventas_vendedor_id_fkey"
            columns: ["vendedor_id"]
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
