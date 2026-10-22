-- Fix: la venta de un vendedor tiene que mover el stock (y moverlo bien).
--
-- Dos triggers del stock corrian con los permisos de quien dispara la accion, y las politicas de
-- `productos` solo dejan actualizar a admin y deposito:
--
--  1) calcular_stock_movimiento (BEFORE INSERT en movimientos_stock) lee el stock actual con
--     SELECT ... FOR UPDATE. Para un vendedor esa fila no es visible (el FOR UPDATE exige poder
--     actualizarla), asi que leia NULL, tomaba el stock previo como 0 y calculaba stock_nuevo desde cero.
--  2) sync_stock_producto (AFTER INSERT) hace el UPDATE de productos.stock_actual, que para un
--     vendedor no afectaba ninguna fila (sin error).
--
-- Resultado: si vendia un vendedor, el movimiento quedaba registrado con un stock_nuevo incorrecto y el
-- stock del producto no se movia. No se notaba porque hasta ahora los tres usuarios eran admin.
--
-- Ahora los dos corren con los permisos del dueño. Es seguro porque el stock solo se puede mover por esta
-- via: trg_proteger_stock_actual revierte cualquier escritura directa de stock_actual que no venga de
-- sync_stock_producto (usa la marca de sesion app.sync_stock, que se conserva igual).

CREATE OR REPLACE FUNCTION public.calcular_stock_movimiento()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  stock_previo NUMERIC;
BEGIN
  -- FOR UPDATE serializa movimientos concurrentes sobre el mismo producto
  SELECT COALESCE(stock_actual, 0) INTO stock_previo
  FROM productos WHERE id = NEW.producto_id FOR UPDATE;

  NEW.stock_anterior := COALESCE(stock_previo, 0);

  IF NEW.tipo = 'ajuste' THEN
    -- En un ajuste el frontend declara el stock objetivo en stock_nuevo
    NEW.cantidad := abs(COALESCE(NEW.stock_nuevo, 0) - NEW.stock_anterior);
  ELSIF NEW.tipo IN ('entrada', 'devolucion') THEN
    NEW.stock_nuevo := NEW.stock_anterior + abs(COALESCE(NEW.cantidad, 0));
  ELSIF NEW.tipo = 'salida' THEN
    NEW.stock_nuevo := NEW.stock_anterior - abs(COALESCE(NEW.cantidad, 0));
  END IF;

  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.sync_stock_producto()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  PERFORM set_config('app.sync_stock', 'on', true);
  UPDATE productos SET stock_actual = NEW.stock_nuevo WHERE id = NEW.producto_id;
  PERFORM set_config('app.sync_stock', 'off', true);
  RETURN NEW;
END;
$function$;
