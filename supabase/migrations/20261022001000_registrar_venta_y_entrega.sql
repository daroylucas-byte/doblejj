-- Ventas atomicas: una venta nueva y la entrega de una venta pasan a ser UNA sola transaccion.
--
-- Hoy el front hace varias llamadas sueltas (venta, items, pago en cuenta corriente, pago, actualizacion
-- de la venta). Si una falla a mitad de camino queda, por ejemplo, una venta sin su cobro o sin su ajuste.
-- Estas funciones hacen EXACTAMENTE los mismos pasos, en el mismo orden y con los mismos conceptos que el
-- front, pero todo o nada. No hay logica nueva: el formulario sigue mostrando el calculo mientras se edita,
-- y los totales que se guardan salen de los items.
--
-- Son SECURITY INVOKER (permisos de quien las llama): las politicas RLS de ventas, cuenta_corriente y pagos
-- siguen decidiendo quien puede hacer que, y si algo falla se revierte todo.

CREATE OR REPLACE FUNCTION public.registrar_venta(
    p_cliente_id uuid,
    p_items jsonb,
    p_forma_pago text,
    p_referencia text DEFAULT NULL,
    p_fecha_vencimiento date DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $function$
DECLARE
    v_hoy date := (now() AT TIME ZONE 'America/Argentina/Cordoba')::date;
    v_total numeric;
    v_venta_id uuid;
    v_numero text;
    v_cc_id uuid;
    v_cheque boolean := p_forma_pago IN ('cheque', 'icheque');
BEGIN
    IF p_forma_pago IS NULL OR p_forma_pago NOT IN ('efectivo', 'transferencia', 'cheque', 'icheque', 'cuenta_corriente') THEN
        RAISE EXCEPTION 'Forma de pago inválida: %', p_forma_pago;
    END IF;
    IF v_cheque AND p_fecha_vencimiento IS NULL THEN
        RAISE EXCEPTION 'La fecha de vencimiento es obligatoria para cobros con cheque.';
    END IF;
    IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
        RAISE EXCEPTION 'La venta debe tener al menos un producto';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM clientes WHERE id = p_cliente_id) THEN
        RAISE EXCEPTION 'Cliente no encontrado';
    END IF;

    -- Cada item: producto existente, cantidad > 0 y precio >= 0
    IF EXISTS (
        SELECT 1 FROM jsonb_to_recordset(p_items) AS i(producto_id uuid, cantidad numeric, precio_unitario numeric)
        WHERE i.producto_id IS NULL OR i.cantidad IS NULL OR i.cantidad <= 0
           OR i.precio_unitario IS NULL OR i.precio_unitario < 0
           OR NOT EXISTS (SELECT 1 FROM productos p WHERE p.id = i.producto_id)
    ) THEN
        RAISE EXCEPTION 'Hay productos con datos inválidos (producto inexistente, cantidad o precio incorrectos)';
    END IF;

    -- El total sale de los items (subtotal = cantidad x precio, a 2 decimales)
    SELECT sum(round(i.cantidad * i.precio_unitario, 2)) INTO v_total
    FROM jsonb_to_recordset(p_items) AS i(producto_id uuid, cantidad numeric, precio_unitario numeric);

    -- 1. La venta. El cargo en cuenta corriente lo registra solo el trigger trg_venta_cta_cte_auto.
    INSERT INTO ventas (cliente_id, vendedor_id, total, saldo_pendiente, estado, tipo_comprobante, fecha)
    VALUES (
        p_cliente_id, auth.uid(), v_total,
        CASE WHEN p_forma_pago = 'cuenta_corriente' THEN v_total ELSE 0 END,
        'en distribucion', 'ticket', v_hoy
    )
    RETURNING id, numero INTO v_venta_id, v_numero;

    -- 2. Los items. El stock lo descuenta el trigger on_venta_item_stock.
    INSERT INTO venta_items (venta_id, producto_id, cantidad, precio_unitario, subtotal)
    SELECT v_venta_id, i.producto_id, i.cantidad, i.precio_unitario, round(i.cantidad * i.precio_unitario, 2)
    FROM jsonb_to_recordset(p_items) AS i(producto_id uuid, cantidad numeric, precio_unitario numeric);

    -- 3. Si se cobro en el acto: el pago en cuenta corriente (para saldar el cargo) y el pago enlazado
    IF p_forma_pago <> 'cuenta_corriente' THEN
        INSERT INTO cuenta_corriente (cliente_id, venta_id, tipo, concepto, monto, fecha, usuario_id)
        VALUES (
            p_cliente_id, v_venta_id, 'pago',
            'Cobro Contado (' || upper(p_forma_pago) || ') - Venta #' || coalesce(v_numero, left(v_venta_id::text, 6)),
            v_total, v_hoy, auth.uid()
        )
        RETURNING id INTO v_cc_id;

        INSERT INTO pagos (cliente_id, venta_id, monto, forma_pago, referencia, fecha_vencimiento, fecha, usuario_id, movimiento_cc_id)
        VALUES (
            p_cliente_id, v_venta_id, v_total, p_forma_pago,
            coalesce(nullif(trim(p_referencia), ''), 'Pago Contado - Venta #' || coalesce(v_numero, left(v_venta_id::text, 6))),
            CASE WHEN v_cheque THEN p_fecha_vencimiento END,
            v_hoy, auth.uid(), v_cc_id
        );
    END IF;

    RETURN v_venta_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.registrar_entrega(
    p_venta_id uuid,
    p_items jsonb,
    p_pago numeric DEFAULT 0,
    p_forma_pago text DEFAULT NULL,
    p_fecha_vencimiento date DEFAULT NULL,
    p_estado text DEFAULT 'entregada'
)
RETURNS uuid
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $function$
DECLARE
    v_hoy date := (now() AT TIME ZONE 'America/Argentina/Cordoba')::date;
    v_venta ventas%ROWTYPE;
    v_concepto_ref text;
    v_nuevo_total numeric;
    v_nuevo_total_pagado numeric;
    v_nuevo_saldo numeric;
    v_ajuste numeric;
    v_cc_id uuid;
    v_pago numeric := coalesce(p_pago, 0);
BEGIN
    IF p_estado IS NULL OR p_estado NOT IN ('confirmada', 'preparando', 'lista', 'en distribucion', 'entregada') THEN
        RAISE EXCEPTION 'Estado inválido para una entrega: % (para anular usá anular_venta)', p_estado;
    END IF;
    IF v_pago < 0 THEN
        RAISE EXCEPTION 'El pago no puede ser negativo';
    END IF;

    SELECT * INTO v_venta FROM ventas WHERE id = p_venta_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Venta no encontrada';
    END IF;
    IF v_venta.estado IN ('cancelada', 'presupuesto') THEN
        RAISE EXCEPTION 'No se puede registrar la entrega de una venta en estado %', v_venta.estado;
    END IF;
    IF v_venta.cliente_id IS NULL THEN
        RAISE EXCEPTION 'No se pudo identificar al cliente';
    END IF;

    IF v_pago > 0 THEN
        IF p_forma_pago IS NULL OR p_forma_pago NOT IN ('efectivo', 'transferencia', 'cheque', 'icheque') THEN
            RAISE EXCEPTION 'Forma de pago inválida para el cobro: %', p_forma_pago;
        END IF;
        IF p_forma_pago IN ('cheque', 'icheque') AND p_fecha_vencimiento IS NULL THEN
            RAISE EXCEPTION 'La fecha de vencimiento es obligatoria para cobros con cheque.';
        END IF;
    END IF;

    v_concepto_ref := coalesce(v_venta.numero, left(v_venta.id::text, 6));

    -- 1. Cantidades entregadas: solo se actualizan los items cuya cantidad cambio. El subtotal sale del
    --    precio guardado en la base. (Igual que el front, esto no reajusta el stock.)
    IF p_items IS NOT NULL AND jsonb_typeof(p_items) = 'array' THEN
        UPDATE venta_items vi
        SET cantidad = x.cantidad, subtotal = x.cantidad * vi.precio_unitario
        FROM jsonb_to_recordset(p_items) AS x(id uuid, cantidad numeric)
        WHERE vi.id = x.id AND vi.venta_id = p_venta_id AND x.cantidad IS NOT NULL AND x.cantidad >= 0
          AND vi.cantidad IS DISTINCT FROM x.cantidad;
    END IF;

    -- 2. Totales (misma formula que el front)
    SELECT coalesce(sum(cantidad * precio_unitario), 0) INTO v_nuevo_total FROM venta_items WHERE venta_id = p_venta_id;
    v_nuevo_total_pagado := v_venta.total_pagado + v_pago;
    v_nuevo_saldo := greatest(0, v_nuevo_total - v_nuevo_total_pagado);

    -- 3. Ajuste del total en la cuenta corriente del cliente
    IF v_nuevo_total <> v_venta.total THEN
        v_ajuste := v_nuevo_total - v_venta.total;
        INSERT INTO cuenta_corriente (cliente_id, fecha, tipo, concepto, monto, venta_id, usuario_id)
        VALUES (
            v_venta.cliente_id, v_hoy,
            CASE WHEN v_ajuste > 0 THEN 'cargo' ELSE 'nota_credito' END,
            'Ajuste en Entrega - Venta #' || v_concepto_ref,
            abs(v_ajuste), p_venta_id, auth.uid()
        );
    END IF;

    -- 4. El cobro, si hubo: movimiento de cuenta corriente y pago enlazado
    IF v_pago > 0 THEN
        INSERT INTO cuenta_corriente (cliente_id, fecha, tipo, concepto, monto, venta_id, usuario_id)
        VALUES (v_venta.cliente_id, v_hoy, 'pago', 'Cobro Entrega - Venta #' || v_concepto_ref, v_pago, p_venta_id, auth.uid())
        RETURNING id INTO v_cc_id;

        INSERT INTO pagos (venta_id, cliente_id, monto, forma_pago, fecha, fecha_vencimiento, estado, usuario_id, movimiento_cc_id)
        VALUES (
            p_venta_id, v_venta.cliente_id, v_pago, p_forma_pago, v_hoy,
            CASE WHEN p_forma_pago IN ('cheque', 'icheque') THEN p_fecha_vencimiento END,
            'acreditado', auth.uid(), v_cc_id
        );
    END IF;

    -- 5. Estado y saldo de la venta
    UPDATE ventas
    SET total = v_nuevo_total, total_pagado = v_nuevo_total_pagado, saldo_pendiente = v_nuevo_saldo, estado = p_estado
    WHERE id = p_venta_id;

    RETURN p_venta_id;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.registrar_venta(uuid, jsonb, text, text, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.registrar_venta(uuid, jsonb, text, text, date) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.registrar_entrega(uuid, jsonb, numeric, text, date, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.registrar_entrega(uuid, jsonb, numeric, text, date, text) TO authenticated;
