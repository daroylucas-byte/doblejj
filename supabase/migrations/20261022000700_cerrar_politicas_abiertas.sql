-- Seguridad (punto 3 y 4 de la auditoria): cerrar las politicas abiertas a cualquiera.
--
-- Antes: clientes, productos y profiles se podian LEER sin iniciar sesion; ventas y venta_items se
-- podian leer, crear y modificar sin iniciar sesion (politicas {public} con USING true). Ademas, la
-- lectura de cuenta_corriente, pagos y proveedores estaba abierta a cualquier usuario autenticado
-- (incluido un 'pendiente'), y las 4 vistas SECURITY DEFINER saltaban el RLS.
--
-- Ahora: solo el personal activo (private.es_personal()) lee y escribe. Un 'pendiente' solo puede
-- leer su propio perfil (para ver el cartel de espera). Las politicas de escritura por rol que ya
-- existian (admin/vendedor/deposito/caja) se conservan, pero ya no aplican al rol anonimo.

-- ---------- clientes ----------
ALTER POLICY "Public Read Clientes" ON public.clientes TO authenticated USING (private.es_personal());
ALTER POLICY "Public Read Clientes" ON public.clientes RENAME TO "Personal puede leer clientes";
ALTER POLICY "Admins and Vendors can insert clientes" ON public.clientes TO authenticated;
ALTER POLICY "Admins and Vendors can update clientes" ON public.clientes TO authenticated;
ALTER POLICY "Only admins can delete clientes" ON public.clientes TO authenticated;

-- ---------- productos ----------
ALTER POLICY "Public Read Productos" ON public.productos TO authenticated USING (private.es_personal());
ALTER POLICY "Public Read Productos" ON public.productos RENAME TO "Personal puede leer productos";
ALTER POLICY "Admins and Deposito can insert productos" ON public.productos TO authenticated;
ALTER POLICY "Admins and Deposito can update productos" ON public.productos TO authenticated;
ALTER POLICY "Only admins can delete productos" ON public.productos TO authenticated;

-- ---------- profiles: cada usuario lee el suyo; el personal lee todos (nombres del vendedor, etc.) ----------
ALTER POLICY "Public Read Profiles" ON public.profiles TO authenticated
    USING (id = auth.uid() OR private.es_personal());
ALTER POLICY "Public Read Profiles" ON public.profiles RENAME TO "Leer el propio perfil o ser personal";

-- ---------- ventas y venta_items ----------
ALTER POLICY "Vendedores Can Read Ventas" ON public.ventas TO authenticated USING (private.es_personal());
ALTER POLICY "Vendedores Can Insert Ventas" ON public.ventas TO authenticated WITH CHECK (private.es_personal());
ALTER POLICY "Vendedores Can Update Ventas" ON public.ventas TO authenticated
    USING (private.es_personal()) WITH CHECK (private.es_personal());
ALTER POLICY "Vendedores Can Read Items" ON public.venta_items TO authenticated USING (private.es_personal());
ALTER POLICY "Vendedores Can Insert Items" ON public.venta_items TO authenticated WITH CHECK (private.es_personal());
ALTER POLICY "Vendedores Can Update Items" ON public.venta_items TO authenticated
    USING (private.es_personal()) WITH CHECK (private.es_personal());

-- ---------- lectura de cuenta corriente y pagos (antes: cualquier usuario autenticado) ----------
ALTER POLICY "Vendedores pueden leer cuenta corriente" ON public.cuenta_corriente USING (private.es_personal());
ALTER POLICY "Caja y Admins pueden leer cta cte proveedores" ON public.cuenta_corriente_proveedores USING (private.es_personal());
ALTER POLICY "Vendedores pueden leer pagos" ON public.pagos USING (private.es_personal());
ALTER POLICY "Caja y Admins pueden leer pagos proveedores" ON public.pagos_proveedores USING (private.es_personal());

-- ---------- promociones, creditos de IA y configuracion ----------
ALTER POLICY "Usuarios autenticados pueden ver promociones" ON public.promociones_sugeridas USING (private.es_personal());
ALTER POLICY "Usuarios autenticados pueden insertar promociones" ON public.promociones_sugeridas WITH CHECK (private.es_personal());
ALTER POLICY "Usuarios autenticados pueden actualizar promociones" ON public.promociones_sugeridas
    USING (private.es_personal()) WITH CHECK (private.es_personal());
ALTER POLICY "authenticated can read creditos" ON public.sistema_creditos USING (private.es_personal());
ALTER POLICY "authenticated can update creditos" ON public.sistema_creditos
    USING (private.es_personal()) WITH CHECK (private.es_personal());
ALTER POLICY "authenticated can read movimientos" ON public.sistema_creditos_movimientos USING (private.es_personal());
ALTER POLICY "authenticated can insert movimientos" ON public.sistema_creditos_movimientos WITH CHECK (private.es_personal());
ALTER POLICY "config_anulaciones_lectura" ON public.config_anulaciones USING (private.es_personal());

-- ---------- vistas: que respeten el RLS de quien consulta (antes corrian con los permisos del dueño) ----------
ALTER VIEW public.vista_cuenta_corriente SET (security_invoker = true);
ALTER VIEW public.vista_cuenta_corriente_proveedores SET (security_invoker = true);
ALTER VIEW public.vista_combos_frecuentes SET (security_invoker = true);
ALTER VIEW public.vista_productos_para_promociones SET (security_invoker = true);

-- ---------- el rol anonimo no necesita nada en este esquema (login y registro usan el esquema auth) ----------
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM PUBLIC, anon;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO authenticated, service_role;
-- handle_new_user es una funcion de trigger: no debe poder llamarse por la API
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM authenticated;

-- ...ni tampoco los objetos que se creen de ahora en adelante
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM anon;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM anon;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC, anon;
