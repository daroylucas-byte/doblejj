import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { format, parseISO } from 'date-fns';
import { Link } from 'react-router-dom';
import Layout from '../components/Layout';
import MainHeader from '../components/MainHeader';
import AnularMotivoModal from '../components/AnularMotivoModal';
import { supabase } from '../lib/supabase';
import { MOTIVOS_ANULACION } from '../utils/anulaciones';
import type { MotivoAnulacion } from '../utils/anulaciones';

// Pantalla PROVISORIA: sirve para revisar las anulaciones y clasificar las históricas.
// Cuando termine la limpieza se elimina (ruta, menú y este archivo); la base no cambia.

interface Anulacion {
    id: string;
    cliente_id: string;
    fecha: string;
    tipo: string;
    concepto: string;
    monto: number;
    anulacion_motivo: MotivoAnulacion | null;
    anulacion_detalle: string | null;
    anulacion_tardia: boolean;
    revierte_a: string | null;
    etiquetada_en: string | null;
    clientes: { razon_social: string } | null;
    profiles: { nombre: string | null; apellido: string | null } | null;
}

const SELECT = 'id, cliente_id, fecha, tipo, concepto, monto, anulacion_motivo, anulacion_detalle, anulacion_tardia, revierte_a, etiquetada_en, clientes(razon_social), profiles!cuenta_corriente_usuario_id_fkey(nombre, apellido)';

const etiquetaMotivo = (m: string | null) => MOTIVOS_ANULACION.find(x => x.value === m)?.label ?? '—';
const nombreUsuario = (a: Anulacion) =>
    a.profiles ? `${a.profiles.nombre ?? ''} ${a.profiles.apellido ?? ''}`.trim() || 'Sin nombre' : 'Sin usuario';
const dinero = (n: number) => `$ ${Math.abs(Number(n)).toLocaleString('es-AR', { minimumFractionDigits: 2 })}`;

const Anulaciones: React.FC = () => {
    const [tab, setTab] = useState<'registro' | 'sin_clasificar'>('registro');
    const [registro, setRegistro] = useState<Anulacion[]>([]);
    const [sinClasificar, setSinClasificar] = useState<Anulacion[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [filtroMotivo, setFiltroMotivo] = useState<string>('Todos');
    const [soloTardias, setSoloTardias] = useState(false);
    const [aClasificar, setAClasificar] = useState<Anulacion | null>(null);

    const fetchData = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const [reg, sin] = await Promise.all([
                supabase
                    .from('cuenta_corriente')
                    .select(SELECT)
                    .or('revierte_a.not.is.null,anulacion_motivo.not.is.null')
                    .order('created_at', { ascending: false })
                    .limit(1000),
                supabase
                    .from('cuenta_corriente')
                    .select(SELECT)
                    .eq('tipo', 'nota_credito')
                    .like('concepto', 'Anulación Venta%')
                    .is('anulacion_motivo', null)
                    .order('fecha', { ascending: false })
                    .limit(1000),
            ]);
            if (reg.error) throw reg.error;
            if (sin.error) throw sin.error;
            setRegistro((reg.data || []) as unknown as Anulacion[]);
            setSinClasificar((sin.data || []) as unknown as Anulacion[]);
        } catch (err: any) {
            console.error('Error cargando anulaciones:', err);
            setError(err.message || 'Error al cargar las anulaciones');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const registroFiltrado = useMemo(
        () => registro.filter(a =>
            (filtroMotivo === 'Todos' || a.anulacion_motivo === filtroMotivo) &&
            (!soloTardias || a.anulacion_tardia)
        ),
        [registro, filtroMotivo, soloTardias]
    );

    const porMotivo = useMemo(() => {
        const cuenta = new Map<string, number>();
        registro.forEach(a => cuenta.set(a.anulacion_motivo ?? '—', (cuenta.get(a.anulacion_motivo ?? '—') ?? 0) + 1));
        return cuenta;
    }, [registro]);

    const porUsuario = useMemo(() => {
        const cuenta = new Map<string, number>();
        registro.forEach(a => cuenta.set(nombreUsuario(a), (cuenta.get(nombreUsuario(a)) ?? 0) + 1));
        return Array.from(cuenta.entries()).sort((a, b) => b[1] - a[1]);
    }, [registro]);

    const tardias = registro.filter(a => a.anulacion_tardia).length;

    const clasificar = async (motivo: MotivoAnulacion, detalle: string | null) => {
        if (!aClasificar) return;
        const { error: rpcErr } = await supabase.rpc('clasificar_anulacion_historica', {
            p_nc_id: aClasificar.id,
            p_motivo: motivo,
            p_detalle: detalle,
        });
        if (rpcErr) throw rpcErr;
        await fetchData();
    };

    return (
        <Layout>
            <MainHeader title="Anulaciones" />

            <div className="p-4 sm:p-8 space-y-6 max-w-[1500px] mx-auto w-full">
                <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-900/30 text-amber-700 dark:text-amber-400 text-xs font-bold">
                    Pantalla provisoria para la etapa de limpieza. Revisá las anulaciones y clasificá las anteriores al sistema nuevo.
                    Clasificar solo agrega una etiqueta: no cambia montos ni saldos.
                </div>

                {error && (
                    <div className="p-4 bg-red-50 dark:bg-red-900/20 border-l-4 border-red-500 text-red-700 dark:text-red-400 text-sm font-medium rounded-r-lg">
                        {error}
                    </div>
                )}

                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="bg-white dark:bg-zinc-900 p-4 rounded-xl border border-slate-200 dark:border-zinc-800">
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Anulaciones registradas</p>
                        <p className="text-2xl font-black">{registro.length}</p>
                    </div>
                    <div className="bg-white dark:bg-zinc-900 p-4 rounded-xl border border-slate-200 dark:border-zinc-800">
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Sin clasificar (históricas)</p>
                        <p className="text-2xl font-black text-amber-600">{sinClasificar.length}</p>
                    </div>
                    <div className="bg-white dark:bg-zinc-900 p-4 rounded-xl border border-slate-200 dark:border-zinc-800">
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Tardías</p>
                        <p className="text-2xl font-black">{tardias}</p>
                    </div>
                    <div className="bg-white dark:bg-zinc-900 p-4 rounded-xl border border-slate-200 dark:border-zinc-800">
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Por usuario</p>
                        <div className="text-xs font-bold space-y-0.5 mt-1 max-h-16 overflow-y-auto">
                            {porUsuario.length === 0 ? '—' : porUsuario.map(([nombre, n]) => (
                                <div key={nombre} className="flex justify-between gap-2"><span className="truncate">{nombre}</span><span>{n}</span></div>
                            ))}
                        </div>
                    </div>
                </div>

                <div className="bg-white dark:bg-zinc-900 rounded-xl border border-slate-200 dark:border-zinc-800 shadow-sm overflow-hidden">
                    <div className="flex border-b border-slate-100 dark:border-zinc-800">
                        <button
                            onClick={() => setTab('registro')}
                            className={`flex-1 py-4 text-[10px] font-black uppercase tracking-widest border-b-2 transition-all ${tab === 'registro' ? 'border-primary text-primary' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
                        >
                            Registro de anulaciones
                        </button>
                        <button
                            onClick={() => setTab('sin_clasificar')}
                            className={`flex-1 py-4 text-[10px] font-black uppercase tracking-widest border-b-2 transition-all ${tab === 'sin_clasificar' ? 'border-primary text-primary' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
                        >
                            Ventas anuladas sin clasificar ({sinClasificar.length})
                        </button>
                    </div>

                    {tab === 'registro' && (
                        <div className="p-4 space-y-4">
                            <div className="flex flex-wrap items-center gap-4">
                                <select
                                    value={filtroMotivo}
                                    onChange={(e) => setFiltroMotivo(e.target.value)}
                                    className="h-9 px-3 bg-slate-50 dark:bg-zinc-800 border-none rounded-lg text-xs font-bold"
                                >
                                    <option value="Todos">Todos los motivos</option>
                                    {MOTIVOS_ANULACION.map(m => (
                                        <option key={m.value} value={m.value}>{m.label} ({porMotivo.get(m.value) ?? 0})</option>
                                    ))}
                                </select>
                                <label className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-500 cursor-pointer">
                                    <input type="checkbox" checked={soloTardias} onChange={(e) => setSoloTardias(e.target.checked)} className="size-4 rounded accent-primary" />
                                    Solo tardías
                                </label>
                            </div>

                            <div className="overflow-x-auto">
                                <table className="w-full text-left border-collapse">
                                    <thead>
                                        <tr className="text-[10px] font-black uppercase text-slate-400 tracking-widest border-b border-slate-100 dark:border-zinc-800">
                                            <th className="py-3">Fecha</th>
                                            <th className="py-3">Cliente</th>
                                            <th className="py-3">Concepto</th>
                                            <th className="py-3 text-right">Monto</th>
                                            <th className="py-3 pl-4">Motivo</th>
                                            <th className="py-3">Usuario</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-50 dark:divide-zinc-800">
                                        {loading ? (
                                            <tr><td colSpan={6} className="py-12 text-center text-slate-400 font-bold">Cargando...</td></tr>
                                        ) : registroFiltrado.length === 0 ? (
                                            <tr><td colSpan={6} className="py-12 text-center text-slate-400 font-bold italic">No hay anulaciones para mostrar</td></tr>
                                        ) : registroFiltrado.map(a => (
                                            <tr key={a.id} className="text-sm hover:bg-slate-50/50 dark:hover:bg-zinc-800/10">
                                                <td className="py-3 text-slate-500 whitespace-nowrap">{format(parseISO(a.fecha), 'dd/MM/yyyy')}</td>
                                                <td className="py-3 font-bold">
                                                    <Link to={`/clientes/${a.cliente_id}`} className="hover:text-primary">{a.clientes?.razon_social ?? '—'}</Link>
                                                </td>
                                                <td className="py-3 text-slate-600 dark:text-zinc-300">
                                                    {a.concepto}
                                                    {a.anulacion_detalle && <span className="block text-[11px] text-slate-400">{a.anulacion_detalle}</span>}
                                                </td>
                                                <td className="py-3 text-right font-black whitespace-nowrap">{dinero(a.monto)}</td>
                                                <td className="py-3 pl-4 whitespace-nowrap">
                                                    <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase bg-slate-100 text-slate-600">{etiquetaMotivo(a.anulacion_motivo)}</span>
                                                    {a.anulacion_tardia && <span className="ml-1 px-2 py-0.5 rounded-full text-[9px] font-black uppercase bg-amber-100 text-amber-700">Tardía</span>}
                                                    {a.etiquetada_en && <span className="ml-1 px-2 py-0.5 rounded-full text-[9px] font-black uppercase bg-blue-100 text-blue-700">Histórica</span>}
                                                    {!a.revierte_a && <span className="ml-1 text-[9px] font-bold text-slate-400">sin cargo original</span>}
                                                </td>
                                                <td className="py-3 text-xs text-slate-500">{nombreUsuario(a)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {tab === 'sin_clasificar' && (
                        <div className="p-4">
                            <p className="text-xs text-slate-500 mb-4">
                                Ventas anuladas antes del sistema de motivos. Clasificalas una por una: las marcadas como
                                "Error de carga" dejan de verse en el resumen del cliente.
                            </p>
                            <div className="overflow-x-auto">
                                <table className="w-full text-left border-collapse">
                                    <thead>
                                        <tr className="text-[10px] font-black uppercase text-slate-400 tracking-widest border-b border-slate-100 dark:border-zinc-800">
                                            <th className="py-3">Fecha</th>
                                            <th className="py-3">Cliente</th>
                                            <th className="py-3">Concepto</th>
                                            <th className="py-3 text-right">Monto</th>
                                            <th className="py-3 w-28"></th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-50 dark:divide-zinc-800">
                                        {loading ? (
                                            <tr><td colSpan={5} className="py-12 text-center text-slate-400 font-bold">Cargando...</td></tr>
                                        ) : sinClasificar.length === 0 ? (
                                            <tr><td colSpan={5} className="py-12 text-center text-slate-400 font-bold italic">No quedan anulaciones por clasificar</td></tr>
                                        ) : sinClasificar.map(a => (
                                            <tr key={a.id} className="text-sm hover:bg-slate-50/50 dark:hover:bg-zinc-800/10">
                                                <td className="py-3 text-slate-500 whitespace-nowrap">{format(parseISO(a.fecha), 'dd/MM/yyyy')}</td>
                                                <td className="py-3 font-bold">
                                                    <Link to={`/clientes/${a.cliente_id}`} className="hover:text-primary">{a.clientes?.razon_social ?? '—'}</Link>
                                                </td>
                                                <td className="py-3 text-slate-600 dark:text-zinc-300">{a.concepto}</td>
                                                <td className="py-3 text-right font-black whitespace-nowrap">{dinero(a.monto)}</td>
                                                <td className="py-3 text-right">
                                                    <button
                                                        onClick={() => setAClasificar(a)}
                                                        className="h-8 px-3 bg-primary text-white text-[10px] font-black uppercase tracking-widest rounded-lg hover:bg-primary/90 transition-all"
                                                    >
                                                        Clasificar
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            <AnularMotivoModal
                isOpen={!!aClasificar}
                onClose={() => setAClasificar(null)}
                titulo="Clasificar anulación"
                resumen={aClasificar ? `${format(parseISO(aClasificar.fecha), 'dd/MM/yyyy')} · ${dinero(aClasificar.monto)}` : ''}
                descripcion={aClasificar ? `${aClasificar.clientes?.razon_social ?? ''} · ${aClasificar.concepto}` : undefined}
                advertencia="Solo agrega la etiqueta: no cambia montos ni saldos. Si es error de carga y la venta tiene su cargo registrado, deja de verse en el resumen del cliente."
                textoBoton="Guardar"
                onConfirm={clasificar}
            />
        </Layout>
    );
};

export default Anulaciones;
