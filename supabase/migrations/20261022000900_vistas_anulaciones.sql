-- Los calculos de las anulaciones los hace la base, no el front.
--
-- 1) vista_cuenta_corriente_resumen: movimientos del cliente con
--      - oculto_en_resumen: el movimiento es un error de carga que fue corregido, o es su correccion
--      - saldo_resumen: el saldo acumulado SIN el efecto de los movimientos ocultos (cuadra fila por fila,
--        aunque el par quede partido por un filtro de fechas, porque se acumula sobre todo el historial)
--      - anulado_motivo / anulacion_tardia / revierte_a: para mostrar las etiquetas
--    El saldo base sigue siendo saldo_acumulado (calculado por el trigger de insercion), nunca se recalcula a mano.
-- 2) vista_anulaciones_estadisticas: los conteos de la pantalla provisoria /anulaciones.

CREATE OR REPLACE VIEW public.vista_cuenta_corriente_resumen
WITH (security_invoker = true) AS
WITH base AS (
    SELECT
        cc.*,
        (cc.anulacion_motivo = 'error_carga' AND cc.revierte_a IS NOT NULL) AS es_correccion_por_error,
        EXISTS (
            SELECT 1 FROM public.cuenta_corriente r
            WHERE r.revierte_a = cc.id AND r.anulacion_motivo = 'error_carga'
        ) AS anulado_por_error,
        (SELECT r.anulacion_motivo FROM public.cuenta_corriente r WHERE r.revierte_a = cc.id LIMIT 1) AS anulado_motivo_calc
    FROM public.cuenta_corriente cc
)
SELECT
    id,
    cliente_id,
    fecha,
    created_at,
    tipo,
    concepto,
    monto,
    saldo_acumulado AS saldo_acumulado_historico,
    venta_id,
    usuario_id,
    revierte_a,
    anulacion_motivo,
    anulacion_tardia,
    anulado_motivo_calc AS anulado_motivo,
    (es_correccion_por_error OR anulado_por_error) AS oculto_en_resumen,
    saldo_acumulado - COALESCE(
        SUM(
            CASE WHEN (es_correccion_por_error OR anulado_por_error)
                 THEN CASE WHEN tipo IN ('cargo', 'nota_debito') THEN abs(monto) ELSE -abs(monto) END
                 ELSE 0 END
        ) OVER (PARTITION BY cliente_id ORDER BY created_at, id ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW),
        0
    ) AS saldo_resumen
FROM base;

CREATE OR REPLACE VIEW public.vista_anulaciones_estadisticas
WITH (security_invoker = true) AS
WITH reg AS (
    SELECT cc.anulacion_motivo, cc.anulacion_tardia,
           trim(coalesce(p.nombre, '') || ' ' || coalesce(p.apellido, '')) AS usuario
    FROM public.cuenta_corriente cc
    LEFT JOIN public.profiles p ON p.id = cc.usuario_id
    WHERE cc.revierte_a IS NOT NULL OR cc.anulacion_motivo IS NOT NULL
)
SELECT 'total'::text AS dimension, ''::text AS clave, count(*)::int AS cantidad FROM reg
UNION ALL
SELECT 'tardias', '', count(*)::int FROM reg WHERE anulacion_tardia
UNION ALL
SELECT 'motivo', coalesce(anulacion_motivo, '—'), count(*)::int FROM reg GROUP BY anulacion_motivo
UNION ALL
SELECT 'usuario', coalesce(nullif(usuario, ''), 'Sin usuario'), count(*)::int FROM reg GROUP BY usuario
UNION ALL
SELECT 'sin_clasificar', '', count(*)::int
FROM public.cuenta_corriente
WHERE tipo = 'nota_credito' AND concepto LIKE 'Anulación Venta%' AND anulacion_motivo IS NULL;

GRANT SELECT ON public.vista_cuenta_corriente_resumen, public.vista_anulaciones_estadisticas TO authenticated;
