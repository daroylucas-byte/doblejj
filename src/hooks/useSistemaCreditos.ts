import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';

const COSTO_APROBAR_PROMO = 500;
const COSTO_GENERAR_IMAGEN = 1200;

export { COSTO_APROBAR_PROMO, COSTO_GENERAR_IMAGEN };

interface Movimiento {
    id: string;
    tipo: string;
    concepto: string | null;
    monto: number;
    saldo_resultante: number;
    created_at: string;
}

interface DescontarResult {
    ok: boolean;
    error?: string;
}

export function useSistemaCreditos() {
    const [saldo, setSaldo] = useState<number | null>(null);
    const [movimientos, setMovimientos] = useState<Movimiento[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchSaldo = useCallback(async () => {
        const { data } = await supabase
            .from('sistema_creditos')
            .select('saldo')
            .single();
        if (data) setSaldo(Number(data.saldo));
        setLoading(false);
    }, []);

    const fetchMovimientos = useCallback(async () => {
        const { data } = await supabase
            .from('sistema_creditos_movimientos')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(50);
        setMovimientos(data || []);
    }, []);

    useEffect(() => {
        fetchSaldo();
    }, [fetchSaldo]);

    const descontarCreditos = useCallback(async (
        monto: number,
        tipo: string,
        concepto: string,
        promoId?: string
    ): Promise<DescontarResult> => {
        if (saldo === null) return { ok: false, error: 'Saldo no disponible' };
        if (saldo < monto) return { ok: false, error: `Saldo insuficiente. Disponible: $${saldo.toLocaleString('es-AR')}` };

        const nuevoSaldo = saldo - monto;

        const { error: updateErr } = await supabase
            .from('sistema_creditos')
            .update({ saldo: nuevoSaldo, updated_at: new Date().toISOString() })
            .eq('saldo', saldo); // optimistic lock: solo actualiza si el saldo no cambió

        if (updateErr) return { ok: false, error: 'Error al actualizar saldo' };

        await supabase.from('sistema_creditos_movimientos').insert([{
            tipo,
            concepto,
            monto: -monto,
            saldo_resultante: nuevoSaldo,
            promo_id: promoId || null,
        }]);

        setSaldo(nuevoSaldo);
        return { ok: true };
    }, [saldo]);

    return { saldo, loading, movimientos, fetchMovimientos, descontarCreditos, refetch: fetchSaldo };
}
