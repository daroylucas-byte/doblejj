-- Clasificación de las anulaciones de venta anteriores a este sistema (notas de crédito
-- "Anulación Venta #..." sin motivo). Solo agrega la etiqueta y, si existe, el enlace al cargo original:
-- no modifica montos, saldos ni ningún otro dato.
ALTER TABLE public.cuenta_corriente
    ADD COLUMN IF NOT EXISTS etiquetada_por uuid REFERENCES public.profiles(id),
    ADD COLUMN IF NOT EXISTS etiquetada_en timestamptz;

CREATE OR REPLACE FUNCTION public.clasificar_anulacion_historica(p_nc_id uuid, p_motivo text, p_detalle text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
-- DEFINER: pagos y cuenta_corriente no tienen política de UPDATE para los usuarios de la app
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
    v_nc cuenta_corriente%ROWTYPE;
    v_cargo_id uuid;
BEGIN
    IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND rol IN ('admin', 'vendedor')) THEN
        RAISE EXCEPTION 'No tenés permiso para esta operación';
    END IF;

    IF p_motivo IS NULL OR p_motivo NOT IN ('error_carga','cheque_rechazado','devolucion','otro') THEN
        RAISE EXCEPTION 'Motivo inválido: %', p_motivo;
    END IF;
    IF p_motivo = 'otro' AND coalesce(trim(p_detalle), '') = '' THEN
        RAISE EXCEPTION 'El motivo "otro" requiere un detalle';
    END IF;

    SELECT * INTO v_nc FROM cuenta_corriente WHERE id = p_nc_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Movimiento no encontrado';
    END IF;
    IF v_nc.tipo <> 'nota_credito' OR v_nc.venta_id IS NULL OR v_nc.concepto NOT LIKE 'Anulación Venta%' THEN
        RAISE EXCEPTION 'Solo se pueden clasificar anulaciones de venta';
    END IF;
    IF v_nc.revierte_a IS NOT NULL OR v_nc.anulacion_motivo IS NOT NULL THEN
        RAISE EXCEPTION 'Esta anulación ya está clasificada';
    END IF;

    SELECT c.id INTO v_cargo_id FROM cuenta_corriente c
    WHERE c.venta_id = v_nc.venta_id AND c.tipo = 'cargo'
      AND NOT EXISTS (SELECT 1 FROM cuenta_corriente r WHERE r.revierte_a = c.id)
    ORDER BY c.created_at LIMIT 1;
    -- Las anulaciones de las primeras semanas (marzo/abril) no tienen cargo registrado en la cuenta
    -- corriente: se etiquetan igual, pero sin enlace (quedan siempre visibles en el resumen).
    UPDATE cuenta_corriente
    SET revierte_a = v_cargo_id, anulacion_motivo = p_motivo, anulacion_detalle = p_detalle,
        etiquetada_por = auth.uid(), etiquetada_en = now()
    WHERE id = p_nc_id;
END;
$function$;

-- Solo usuarios autenticados; el rol (admin o vendedor) se verifica dentro de la función
REVOKE EXECUTE ON FUNCTION public.clasificar_anulacion_historica(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.clasificar_anulacion_historica(uuid, text, text) TO authenticated;
