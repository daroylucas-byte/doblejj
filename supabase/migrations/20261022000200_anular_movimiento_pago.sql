-- La anulación parte del movimiento de cuenta corriente (lo que el usuario ve en la ficha),
-- así funciona también con pagos viejos que no tienen enlace en la tabla pagos.
DROP FUNCTION IF EXISTS public.anular_pago(uuid, text, text);

CREATE OR REPLACE FUNCTION public.anular_movimiento_pago(p_mov_id uuid, p_motivo text, p_detalle text DEFAULT NULL)
RETURNS uuid
LANGUAGE plpgsql
-- DEFINER: pagos y cuenta_corriente no tienen política de UPDATE para los usuarios de la app
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
    v_mov cuenta_corriente%ROWTYPE;
    v_pago pagos%ROWTYPE;
    v_cfg config_anulaciones%ROWTYPE;
    v_hoy date := (now() AT TIME ZONE 'America/Argentina/Cordoba')::date;
    v_tardia boolean;
    v_candidatos integer;
    v_nuevo_id uuid;
BEGIN
    IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND rol IN ('admin', 'vendedor')) THEN
        RAISE EXCEPTION 'No tenés permiso para esta operación';
    END IF;

    IF p_motivo IS NULL OR p_motivo NOT IN ('error_carga','cheque_rechazado','devolucion','otro') THEN
        RAISE EXCEPTION 'Motivo de anulación inválido: %', p_motivo;
    END IF;
    IF p_motivo = 'otro' AND coalesce(trim(p_detalle), '') = '' THEN
        RAISE EXCEPTION 'El motivo "otro" requiere un detalle';
    END IF;

    SELECT * INTO v_cfg FROM config_anulaciones;
    -- FOR UPDATE: dos anulaciones simultáneas del mismo movimiento no pueden pasar
    SELECT * INTO v_mov FROM cuenta_corriente WHERE id = p_mov_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Movimiento no encontrado';
    END IF;
    IF v_mov.tipo <> 'pago' OR v_mov.revierte_a IS NOT NULL THEN
        RAISE EXCEPTION 'Solo se pueden anular movimientos de tipo pago';
    END IF;
    IF EXISTS (SELECT 1 FROM cuenta_corriente WHERE revierte_a = p_mov_id) THEN
        RAISE EXCEPTION 'Este pago ya fue anulado';
    END IF;

    v_tardia := p_motivo = 'error_carga' AND v_mov.fecha < v_hoy - v_cfg.limite_dias;
    IF v_tardia THEN
        IF v_hoy > v_cfg.limpieza_hasta THEN
            RAISE EXCEPTION 'Un error de carga solo puede anularse dentro de los % días. Usá otro motivo.', v_cfg.limite_dias;
        END IF;
        IF coalesce(trim(p_detalle), '') = '' THEN
            RAISE EXCEPTION 'Un error de carga de más de % días requiere un detalle', v_cfg.limite_dias;
        END IF;
    END IF;

    -- Pago asociado: por enlace directo o, en pagos viejos, por coincidencia única
    SELECT * INTO v_pago FROM pagos WHERE movimiento_cc_id = p_mov_id FOR UPDATE;
    IF NOT FOUND THEN
        SELECT count(*) INTO v_candidatos FROM pagos
        WHERE cliente_id = v_mov.cliente_id AND fecha = v_mov.fecha
          AND monto = abs(v_mov.monto) AND estado = 'acreditado' AND movimiento_cc_id IS NULL;
        IF v_candidatos = 1 THEN
            SELECT * INTO v_pago FROM pagos
            WHERE cliente_id = v_mov.cliente_id AND fecha = v_mov.fecha
              AND monto = abs(v_mov.monto) AND estado = 'acreditado' AND movimiento_cc_id IS NULL
            FOR UPDATE;
        END IF;
    END IF;
    IF v_pago.id IS NOT NULL AND v_pago.estado <> 'acreditado' THEN
        RAISE EXCEPTION 'El pago asociado ya está en estado %', v_pago.estado;
    END IF;

    INSERT INTO cuenta_corriente (cliente_id, fecha, tipo, concepto, monto, usuario_id, revierte_a, anulacion_motivo, anulacion_detalle, anulacion_tardia)
    VALUES (
        v_mov.cliente_id, v_hoy, 'nota_debito',
        'Anulación de pago ' || to_char(v_mov.fecha, 'DD/MM/YYYY') || ' - ' || left(v_mov.concepto, 60),
        abs(v_mov.monto), auth.uid(), v_mov.id, p_motivo, p_detalle, v_tardia
    )
    RETURNING id INTO v_nuevo_id;

    IF v_pago.id IS NOT NULL THEN
        UPDATE pagos
        SET estado = 'anulado', movimiento_cc_id = v_mov.id, anulado_en = now(), anulado_por = auth.uid(),
            motivo_anulacion = p_motivo || coalesce(': ' || nullif(trim(p_detalle), ''), '')
        WHERE id = v_pago.id;
    END IF;

    RETURN v_nuevo_id;
END;
$function$;

-- Solo usuarios autenticados; el rol (admin o vendedor) se verifica dentro de la función
REVOKE EXECUTE ON FUNCTION public.anular_movimiento_pago(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.anular_movimiento_pago(uuid, text, text) TO authenticated;
