-- Rendimiento: indices en las claves foraneas mas consultadas y una vista con el
-- saldo de cada proveedor, para que el listado no traiga toda la cuenta corriente.
-- Aditiva: solo agrega indices y una vista; no cambia ningun comportamiento.

CREATE INDEX IF NOT EXISTS idx_cuenta_corriente_cliente ON public.cuenta_corriente (cliente_id);
CREATE INDEX IF NOT EXISTS idx_cuenta_corriente_venta ON public.cuenta_corriente (venta_id);
CREATE INDEX IF NOT EXISTS idx_cc_proveedores_proveedor ON public.cuenta_corriente_proveedores (proveedor_id);
CREATE INDEX IF NOT EXISTS idx_ventas_cliente ON public.ventas (cliente_id);
CREATE INDEX IF NOT EXISTS idx_venta_items_venta ON public.venta_items (venta_id);
CREATE INDEX IF NOT EXISTS idx_venta_items_producto ON public.venta_items (producto_id);
CREATE INDEX IF NOT EXISTS idx_pagos_cliente ON public.pagos (cliente_id);
CREATE INDEX IF NOT EXISTS idx_pagos_venta ON public.pagos (venta_id);
CREATE INDEX IF NOT EXISTS idx_pagos_movimiento_cc ON public.pagos (movimiento_cc_id);
CREATE INDEX IF NOT EXISTS idx_compras_proveedor ON public.compras (proveedor_id);
CREATE INDEX IF NOT EXISTS idx_compra_items_compra ON public.compra_items (compra_id);
CREATE INDEX IF NOT EXISTS idx_movimientos_stock_producto ON public.movimientos_stock (producto_id);
CREATE INDEX IF NOT EXISTS idx_pagos_proveedores_proveedor ON public.pagos_proveedores (proveedor_id);

-- Saldo de cada proveedor = el que muestra la ficha (suma de la cuenta corriente:
-- cargo/nota_debito suman, pago/nota_credito restan, siempre con abs(monto)).
-- Positivo = se le debe al proveedor. Equivale al ultimo saldo_acumulado de
-- vista_cuenta_corriente_proveedores. Respeta el RLS de quien consulta.
CREATE OR REPLACE VIEW public.vista_saldos_proveedores
WITH (security_invoker = true) AS
SELECT proveedor_id,
       COALESCE(SUM(CASE
           WHEN tipo IN ('cargo', 'nota_debito') THEN abs(monto)
           WHEN tipo IN ('pago', 'nota_credito') THEN -abs(monto)
           ELSE 0 END), 0) AS saldo
FROM public.cuenta_corriente_proveedores
GROUP BY proveedor_id;

REVOKE ALL ON public.vista_saldos_proveedores FROM PUBLIC, anon;
GRANT SELECT ON public.vista_saldos_proveedores TO authenticated;
