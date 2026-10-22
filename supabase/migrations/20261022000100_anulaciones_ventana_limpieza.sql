-- Ventana de limpieza: hasta limpieza_hasta, un "error de carga" se puede anular sin límite de tiempo
-- (queda marcado como tardío si supera limite_dias). Pasada esa fecha rige el límite de limite_dias.
CREATE TABLE IF NOT EXISTS public.config_anulaciones (
    id boolean PRIMARY KEY DEFAULT true CHECK (id),
    limpieza_hasta date NOT NULL,
    limite_dias integer NOT NULL DEFAULT 7
);
INSERT INTO public.config_anulaciones (limpieza_hasta, limite_dias)
VALUES ((now() AT TIME ZONE 'America/Argentina/Cordoba')::date + 30, 7)
ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.config_anulaciones ENABLE ROW LEVEL SECURITY;
CREATE POLICY "config_anulaciones_lectura" ON public.config_anulaciones
    FOR SELECT TO authenticated USING (true);

ALTER TABLE public.cuenta_corriente ADD COLUMN IF NOT EXISTS anulacion_tardia boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.anular_pago(p_pago_id uuid, p_motivo text, p_detalle text DEFAULT NULL)
RETURNS uuid
LANGUAGE plpgsql
SET search_path = public
AS $function$
DECLARE
    v_pago pagos%ROWTYPE;
    v_cfg config_anulaciones%ROWTYPE;
    v_hoy date := (now() AT TIME ZONE 'America/Argentina/Cordoba')::date;
    v_tardia boolean;
    v_mov_id uuid;
BEGIN
    IF p_motivo IS NULL OR p_motivo NOT IN ('error_carga','cheque_rechazado','devolucion','otro') THEN
        RAISE EXCEPTION 'Motivo de anulación inválido: %', p_motivo;
    END IF;
    IF p_motivo = 'otro' AND coalesce(trim(p_detalle), '') = '' THEN
        RAISE EXCEPTION 'El motivo "otro" requiere un detalle';
    END IF;

    SELECT * INTO v_cfg FROM config_anulaciones;
    SELECT * INTO v_pago FROM pagos WHERE id = p_pago_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Pago no encontrado';
    END IF;
    IF v_pago.estado <> 'acreditado' THEN
        RAISE EXCEPTION 'Solo se pueden anular pagos acreditados (estado actual: %)', v_pago.estado;
    END IF;
    IF v_pago.movimiento_cc_id IS NULL THEN
        RAISE EXCEPTION 'Este pago no está enlazado a la cuenta corriente y no se puede anular automáticamente';
    END IF;

    v_tardia := p_motivo = 'error_carga' AND v_pago.fecha < v_hoy - v_cfg.limite_dias;
    IF v_tardia THEN
        IF v_hoy > v_cfg.limpieza_hasta THEN
            RAISE EXCEPTION 'Un error de carga solo puede anularse dentro de los % días. Usá otro motivo.', v_cfg.limite_dias;
        END IF;
        IF coalesce(trim(p_detalle), '') = '' THEN
            RAISE EXCEPTION 'Un error de carga de más de % días requiere un detalle', v_cfg.limite_dias;
        END IF;
    END IF;

    INSERT INTO cuenta_corriente (cliente_id, fecha, tipo, concepto, monto, usuario_id, revierte_a, anulacion_motivo, anulacion_detalle, anulacion_tardia)
    VALUES (
        v_pago.cliente_id, v_hoy, 'nota_debito',
        'Anulación de pago ' || to_char(v_pago.fecha, 'DD/MM/YYYY') || ' (' || upper(v_pago.forma_pago) || ')',
        abs(v_pago.monto), auth.uid(), v_pago.movimiento_cc_id, p_motivo, p_detalle, v_tardia
    )
    RETURNING id INTO v_mov_id;

    UPDATE pagos
    SET estado = 'anulado', anulado_en = now(), anulado_por = auth.uid(),
        motivo_anulacion = p_motivo || coalesce(': ' || nullif(trim(p_detalle), ''), '')
    WHERE id = p_pago_id;

    RETURN v_mov_id;
END;
$function$;
