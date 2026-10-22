-- Seguridad: activar RLS en las 9 tablas que estaban abiertas a cualquiera con la anon key
-- (caja_cierres, categorias, categorias_gasto, compra_items, compras, gastos, gastos_recurrentes,
-- movimientos_stock, proveedores). Antes se podian leer, modificar y borrar sin iniciar sesion.
--
-- Primera version: todo el personal activo (admin, vendedor, deposito, caja) puede leer, insertar y
-- actualizar. Se hace asi porque los triggers corren con los permisos de quien dispara la accion
-- (vender o anular una venta escribe en movimientos_stock; pagar a un proveedor actualiza proveedores)
-- y una politica mas fina por rol los romperia en silencio. Quedan afuera los anonimos y los usuarios
-- 'pendiente'. Nadie puede borrar: el front no borra nada en estas tablas.

-- Esquema privado para el helper: no se expone por la API (/rest/v1/rpc)
CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC;
GRANT USAGE ON SCHEMA private TO authenticated;

CREATE OR REPLACE FUNCTION private.es_personal()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
    SELECT EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid()
          AND activo
          AND rol IN ('admin', 'vendedor', 'deposito', 'caja')
    );
$function$;

REVOKE EXECUTE ON FUNCTION private.es_personal() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.es_personal() TO authenticated;

DO $$
DECLARE
    t text;
BEGIN
    FOREACH t IN ARRAY ARRAY[
        'caja_cierres', 'categorias', 'categorias_gasto', 'compra_items', 'compras',
        'gastos', 'gastos_recurrentes', 'movimientos_stock', 'proveedores'
    ] LOOP
        EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
        -- El rol anon no debe tener ningun permiso sobre estas tablas
        EXECUTE format('REVOKE ALL ON TABLE public.%I FROM anon', t);

        EXECUTE format('CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (private.es_personal())',
                       t || '_personal_select', t);
        EXECUTE format('CREATE POLICY %I ON public.%I FOR INSERT TO authenticated WITH CHECK (private.es_personal())',
                       t || '_personal_insert', t);
        EXECUTE format('CREATE POLICY %I ON public.%I FOR UPDATE TO authenticated USING (private.es_personal()) WITH CHECK (private.es_personal())',
                       t || '_personal_update', t);
    END LOOP;
END
$$;
