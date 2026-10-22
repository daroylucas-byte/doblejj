-- Seguridad: el rol de un usuario nuevo ya no lo decide el cliente.
-- Antes handle_new_user tomaba el rol de raw_user_meta_data->>'rol' (lo manda quien se registra con
-- la anon key), así que cualquiera podía registrarse como admin. Ahora todo usuario nuevo nace
-- 'pendiente' (sin ningún privilegio) y un administrador lo aprueba asignándole un rol:
--   UPDATE profiles SET rol = 'vendedor', activo = true
--   WHERE id = (SELECT id FROM auth.users WHERE email = 'usuario@ejemplo.com');

ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_rol_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_rol_check
    CHECK (rol = ANY (ARRAY['admin', 'vendedor', 'deposito', 'caja', 'pendiente']));

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
    INSERT INTO public.profiles (id, nombre, apellido, rol, activo)
    VALUES (
        NEW.id,
        left(COALESCE(NULLIF(trim(NEW.raw_user_meta_data->>'nombre'), ''), 'Usuario'), 60),
        left(COALESCE(NULLIF(trim(NEW.raw_user_meta_data->>'apellido'), ''), 'Nuevo'), 60),
        'pendiente',
        false
    );
    RETURN NEW;
END;
$function$;

-- Es una función de trigger: no debe poder llamarse por la API (/rest/v1/rpc/handle_new_user)
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
