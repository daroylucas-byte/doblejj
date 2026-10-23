-- Ajuste de saldo de proveedor: el usuario indica el SALDO FINAL y la base decide
-- si hay que cargar o pagar la diferencia. Antes el front leia el saldo, calculaba
-- el delta e insertaba (con carrera entre la lectura y la insercion).
--
-- Convencion: saldo > 0 = se le debe al proveedor; saldo <= 0 = saldo a favor.
-- Aditiva: solo agrega una funcion; el front viejo sigue funcionando.
-- INVOKER: las politicas RLS de cuenta_corriente_proveedores siguen decidiendo quien puede.

CREATE OR REPLACE FUNCTION public.ajustar_saldo_proveedor(
    p_proveedor_id uuid,
    p_saldo_objetivo numeric,
    p_concepto text DEFAULT 'Ajuste de Saldo'
) RETURNS jsonb
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
    v_saldo_actual numeric;
    v_delta numeric;
    v_tipo text;
    v_saldo_nuevo numeric;
BEGIN
    IF p_saldo_objetivo IS NULL THEN
        RAISE EXCEPTION 'Falta el saldo final';
    END IF;

    -- Bloquea la fila: dos ajustes simultaneos se encolan en vez de pisarse.
    SELECT COALESCE(saldo_actual, 0) INTO v_saldo_actual
    FROM proveedores WHERE id = p_proveedor_id FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Proveedor no encontrado';
    END IF;

    v_delta := round(p_saldo_objetivo - v_saldo_actual, 2);

    IF v_delta = 0 THEN
        RETURN jsonb_build_object('ajustado', false, 'saldo_anterior', v_saldo_actual,
                                  'diferencia', 0, 'saldo_nuevo', v_saldo_actual);
    END IF;

    -- Sube la deuda -> cargo; baja la deuda o crece el saldo a favor -> pago.
    v_tipo := CASE WHEN v_delta > 0 THEN 'cargo' ELSE 'pago' END;

    -- El trigger trg_ccp_calcular_saldo calcula saldo_acumulado y sincroniza proveedores.saldo_actual.
    INSERT INTO cuenta_corriente_proveedores (proveedor_id, fecha, tipo, concepto, monto, usuario_id)
    VALUES (p_proveedor_id,
            (now() AT TIME ZONE 'America/Argentina/Cordoba')::date,
            v_tipo,
            COALESCE(NULLIF(trim(p_concepto), ''), 'Ajuste de Saldo'),
            v_delta,
            auth.uid());

    SELECT saldo_actual INTO v_saldo_nuevo FROM proveedores WHERE id = p_proveedor_id;

    RETURN jsonb_build_object('ajustado', true, 'saldo_anterior', v_saldo_actual,
                              'diferencia', v_delta, 'tipo', v_tipo, 'saldo_nuevo', v_saldo_nuevo);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.ajustar_saldo_proveedor(uuid, numeric, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ajustar_saldo_proveedor(uuid, numeric, text) TO authenticated;
