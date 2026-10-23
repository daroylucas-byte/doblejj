-- Corrige ajustar_saldo_proveedor: la diferencia se calcula contra el saldo que
-- muestra la ficha del proveedor (suma de la cuenta corriente: cargo/nota_debito suman,
-- pago/nota_credito restan, siempre con abs(monto)), NO contra proveedores.saldo_actual.
--
-- Motivo: en proveedores, saldo_actual / saldo_acumulado_historico (que llenan los triggers)
-- difieren de la suma de la cuenta corriente por datos historicos con montos de signo
-- invertido. La pantalla usa la suma, asi que ajustar contra saldo_actual dejaba
-- un saldo distinto al pedido en pantalla.

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
    PERFORM 1 FROM proveedores WHERE id = p_proveedor_id FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Proveedor no encontrado';
    END IF;

    SELECT COALESCE(SUM(CASE
                WHEN tipo IN ('cargo', 'nota_debito') THEN abs(monto)
                WHEN tipo IN ('pago', 'nota_credito') THEN -abs(monto)
                ELSE 0 END), 0)
    INTO v_saldo_actual
    FROM cuenta_corriente_proveedores WHERE proveedor_id = p_proveedor_id;

    v_delta := round(p_saldo_objetivo - v_saldo_actual, 2);

    IF v_delta = 0 THEN
        RETURN jsonb_build_object('ajustado', false, 'saldo_anterior', v_saldo_actual,
                                  'diferencia', 0, 'saldo_nuevo', v_saldo_actual);
    END IF;

    -- Sube la deuda -> cargo; baja la deuda o crece el saldo a favor -> pago.
    v_tipo := CASE WHEN v_delta > 0 THEN 'cargo' ELSE 'pago' END;

    -- Los triggers calculan saldo_acumulado y sincronizan proveedores.saldo_actual.
    INSERT INTO cuenta_corriente_proveedores (proveedor_id, fecha, tipo, concepto, monto, usuario_id)
    VALUES (p_proveedor_id,
            (now() AT TIME ZONE 'America/Argentina/Cordoba')::date,
            v_tipo,
            COALESCE(NULLIF(trim(p_concepto), ''), 'Ajuste de Saldo'),
            v_delta,
            auth.uid());

    v_saldo_nuevo := v_saldo_actual + v_delta;

    RETURN jsonb_build_object('ajustado', true, 'saldo_anterior', v_saldo_actual,
                              'diferencia', v_delta, 'tipo', v_tipo, 'saldo_nuevo', v_saldo_nuevo);
END;
$$;
