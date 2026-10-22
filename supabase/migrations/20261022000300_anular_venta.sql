-- Anulación de venta atómica, con motivo. Reemplaza los dos pasos sueltos del front
-- (UPDATE de estado + INSERT de nota de crédito). El stock lo devuelve el trigger
-- trg_stock_on_venta_status_change al pasar a 'cancelada', igual que antes.
CREATE OR REPLACE FUNCTION public.anular_venta(p_venta_id uuid, p_motivo text, p_detalle text DEFAULT NULL)
RETURNS uuid
LANGUAGE plpgsql
SET search_path = public
AS $function$
DECLARE
    v_venta ventas%ROWTYPE;
    v_cfg config_anulaciones%ROWTYPE;
    v_hoy date := (now() AT TIME ZONE 'America/Argentina/Cordoba')::date;
    v_tardia boolean;
    v_cargo_id uuid;
    v_nc_id uuid;
BEGIN
    IF p_motivo IS NULL OR p_motivo NOT IN ('error_carga','cheque_rechazado','devolucion','otro') THEN
        RAISE EXCEPTION 'Motivo de anulación inválido: %', p_motivo;
    END IF;
    IF p_motivo = 'otro' AND coalesce(trim(p_detalle), '') = '' THEN
        RAISE EXCEPTION 'El motivo "otro" requiere un detalle';
    END IF;

    SELECT * INTO v_cfg FROM config_anulaciones;
    SELECT * INTO v_venta FROM ventas WHERE id = p_venta_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Venta no encontrada';
    END IF;
    IF v_venta.estado IN ('cancelada', 'anulada') THEN
        RAISE EXCEPTION 'La venta ya está anulada';
    END IF;

    v_tardia := p_motivo = 'error_carga' AND v_venta.fecha < v_hoy - v_cfg.limite_dias;
    IF v_tardia THEN
        IF v_hoy > v_cfg.limpieza_hasta THEN
            RAISE EXCEPTION 'Un error de carga solo puede anularse dentro de los % días. Usá otro motivo.', v_cfg.limite_dias;
        END IF;
        IF coalesce(trim(p_detalle), '') = '' THEN
            RAISE EXCEPTION 'Un error de carga de más de % días requiere un detalle', v_cfg.limite_dias;
        END IF;
    END IF;

    -- Un presupuesto nunca generó cargo en cuenta corriente: no hay nada que revertir
    IF v_venta.estado <> 'presupuesto' THEN
        SELECT id INTO v_cargo_id FROM cuenta_corriente
        WHERE venta_id = p_venta_id AND tipo = 'cargo'
        ORDER BY created_at LIMIT 1;
    END IF;

    UPDATE ventas SET estado = 'cancelada' WHERE id = p_venta_id;

    IF v_venta.estado <> 'presupuesto' THEN
        INSERT INTO cuenta_corriente (cliente_id, fecha, tipo, concepto, monto, venta_id, usuario_id, revierte_a, anulacion_motivo, anulacion_detalle, anulacion_tardia)
        VALUES (
            v_venta.cliente_id, v_hoy, 'nota_credito',
            'Anulación Venta #' || coalesce(v_venta.numero, left(v_venta.id::text, 6)),
            v_venta.total, p_venta_id, auth.uid(), v_cargo_id, p_motivo, p_detalle, v_tardia
        )
        RETURNING id INTO v_nc_id;
    END IF;

    RETURN v_nc_id;
END;
$function$;
