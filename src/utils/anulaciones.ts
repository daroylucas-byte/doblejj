export type MotivoAnulacion = 'error_carga' | 'cheque_rechazado' | 'devolucion' | 'otro';

export const MOTIVOS_ANULACION: { value: MotivoAnulacion; label: string; ayuda: string }[] = [
    { value: 'error_carga', label: 'Error de carga', ayuda: 'Se cargó mal (monto, cliente o forma de pago). No aparece en el resumen del cliente.' },
    { value: 'cheque_rechazado', label: 'Cheque rechazado', ayuda: 'Aparece en el resumen del cliente.' },
    { value: 'devolucion', label: 'Devolución o ajuste acordado', ayuda: 'Aparece en el resumen del cliente.' },
    { value: 'otro', label: 'Otro', ayuda: 'Requiere un detalle. Aparece en el resumen del cliente.' },
];

export interface AnulacionCC {
    id: string;
    revierte_a: string | null;
    anulacion_motivo: MotivoAnulacion | null;
    anulacion_tardia: boolean;
}

interface MovimientoVisible {
    id: string;
    tipo: 'cargo' | 'pago' | 'nota_credito' | 'nota_debito';
    monto: number;
    saldo_acumulado: number;
}

// Pares [movimiento original, movimiento que lo corrige] marcados como error de carga
export const paresPorError = (anulaciones: AnulacionCC[]): [string, string][] =>
    anulaciones
        .filter(a => a.anulacion_motivo === 'error_carga' && a.revierte_a)
        .map(a => [a.revierte_a as string, a.id]);

/**
 * Oculta los pares (original + corrección) marcados como "error de carga" y recalcula el
 * saldo de las filas que quedan para que la columna siga cuadrando. Solo se oculta un par
 * si ambos movimientos están en la lista (con un filtro de fechas puede venir uno solo).
 * `movimientos` viene del más reciente al más antiguo.
 */
export const ocultarCorreccionesPorError = <T extends MovimientoVisible>(
    movimientos: T[],
    anulaciones: AnulacionCC[]
): T[] => {
    const presentes = new Set(movimientos.map(m => m.id));
    const ocultos = new Set<string>();
    paresPorError(anulaciones).forEach(([original, correccion]) => {
        if (presentes.has(original) && presentes.has(correccion)) {
            ocultos.add(original);
            ocultos.add(correccion);
        }
    });
    if (ocultos.size === 0) return movimientos;

    const efecto = (m: MovimientoVisible) =>
        m.tipo === 'cargo' || m.tipo === 'nota_debito' ? Math.abs(m.monto) : -Math.abs(m.monto);

    // Se recorre del más antiguo al más nuevo acumulando el efecto de lo oculto
    let ocultoAcumulado = 0;
    const saldoAjustado = new Map<string, number>();
    [...movimientos].reverse().forEach(m => {
        if (ocultos.has(m.id)) ocultoAcumulado += efecto(m);
        else saldoAjustado.set(m.id, m.saldo_acumulado - ocultoAcumulado);
    });

    return movimientos
        .filter(m => !ocultos.has(m.id))
        .map(m => ({ ...m, saldo_acumulado: saldoAjustado.get(m.id) as number }));
};
