-- Anulación de pagos (Fase 1: solo saldo; no reabre ventas).
-- Todo es aditivo: columnas nuevas, una restricción ampliada y una función nueva.
-- No se modifica ningún trigger existente.

-- 1. Enlace pago -> movimiento de cuenta corriente (solo los pagos nuevos lo completan)
ALTER TABLE public.pagos
    ADD COLUMN IF NOT EXISTS movimiento_cc_id uuid REFERENCES public.cuenta_corriente(id),
    ADD COLUMN IF NOT EXISTS anulado_en timestamptz,
    ADD COLUMN IF NOT EXISTS anulado_por uuid REFERENCES public.profiles(id),
    ADD COLUMN IF NOT EXISTS motivo_anulacion text;

-- 2. 'anulado' como estado válido de un pago
ALTER TABLE public.pagos DROP CONSTRAINT IF EXISTS pagos_estado_check;
ALTER TABLE public.pagos ADD CONSTRAINT pagos_estado_check
    CHECK (estado = ANY (ARRAY['pendiente','acreditado','rechazado','anulado']));

-- 3. Marca en cuenta corriente: qué movimiento corrige y por qué
ALTER TABLE public.cuenta_corriente
    ADD COLUMN IF NOT EXISTS revierte_a uuid REFERENCES public.cuenta_corriente(id),
    ADD COLUMN IF NOT EXISTS anulacion_motivo text,
    ADD COLUMN IF NOT EXISTS anulacion_detalle text;

ALTER TABLE public.cuenta_corriente ADD CONSTRAINT cuenta_corriente_anulacion_motivo_check
    CHECK (anulacion_motivo IS NULL OR anulacion_motivo = ANY (ARRAY['error_carga','cheque_rechazado','devolucion','otro']));

-- Un movimiento solo puede ser revertido una vez
CREATE UNIQUE INDEX IF NOT EXISTS cuenta_corriente_revierte_a_uniq
    ON public.cuenta_corriente (revierte_a) WHERE revierte_a IS NOT NULL;

-- 4. Anulación atómica: el saldo lo recalculan los triggers existentes (nota_debito suma)
CREATE OR REPLACE FUNCTION public.anular_pago(p_pago_id uuid, p_motivo text, p_detalle text DEFAULT NULL)
RETURNS uuid
LANGUAGE plpgsql
SET search_path = public
AS $function$
DECLARE
    v_pago pagos%ROWTYPE;
    v_hoy date := (now() AT TIME ZONE 'America/Argentina/Cordoba')::date;
    v_mov_id uuid;
BEGIN
    IF p_motivo IS NULL OR p_motivo NOT IN ('error_carga','cheque_rechazado','devolucion','otro') THEN
        RAISE EXCEPTION 'Motivo de anulación inválido: %', p_motivo;
    END IF;
    IF p_motivo = 'otro' AND coalesce(trim(p_detalle), '') = '' THEN
        RAISE EXCEPTION 'El motivo "otro" requiere un detalle';
    END IF;

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
    -- Un error de carga solo se puede esconder si es reciente
    IF p_motivo = 'error_carga' AND v_pago.fecha < v_hoy - 7 THEN
        RAISE EXCEPTION 'Un error de carga solo puede anularse dentro de los 7 días. Usá otro motivo.';
    END IF;

    INSERT INTO cuenta_corriente (cliente_id, fecha, tipo, concepto, monto, usuario_id, revierte_a, anulacion_motivo, anulacion_detalle)
    VALUES (
        v_pago.cliente_id, v_hoy, 'nota_debito',
        'Anulación de pago ' || to_char(v_pago.fecha, 'DD/MM/YYYY') || ' (' || upper(v_pago.forma_pago) || ')',
        abs(v_pago.monto), auth.uid(), v_pago.movimiento_cc_id, p_motivo, p_detalle
    )
    RETURNING id INTO v_mov_id;

    UPDATE pagos
    SET estado = 'anulado', anulado_en = now(), anulado_por = auth.uid(),
        motivo_anulacion = p_motivo || coalesce(': ' || nullif(trim(p_detalle), ''), '')
    WHERE id = p_pago_id;

    RETURN v_mov_id;
END;
$function$;
