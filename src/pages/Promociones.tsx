import React, { useState, useEffect, useCallback } from 'react';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import Layout from '../components/Layout';
import MainHeader from '../components/MainHeader';
import { supabase } from '../lib/supabase';
import { generarImagenPromocion } from '../utils/promoImageGenerator';
import { useSistemaCreditos, COSTO_APROBAR_PROMO, COSTO_GENERAR_IMAGEN } from '../hooks/useSistemaCreditos';

interface ProductoPromo {
    nombre: string;
    cantidad_sugerida: number;
    unidad: string;
}

interface Promocion {
    id: string;
    nombre: string;
    descripcion: string;
    motivo_ia: string;
    productos: ProductoPromo[];
    descuento_porcentaje: number | null;
    precio_combo: number | null;
    ahorro_estimado: number | null;
    estado: 'borrador' | 'aprobada' | 'activa' | 'descartada' | 'vencida';
    generada_por_ia: boolean;
    vigencia_desde: string | null;
    vigencia_hasta: string | null;
    imagen_url: string | null;
    created_at: string;
}

const ESTADO_CONFIG = {
    borrador:   { label: 'Borrador',   color: 'bg-slate-100 text-slate-600 dark:bg-zinc-800 dark:text-slate-300' },
    aprobada:   { label: 'Aprobada',   color: 'bg-blue-100 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400' },
    activa:     { label: 'Activa',     color: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400' },
    descartada: { label: 'Descartada', color: 'bg-red-100 text-red-500 dark:bg-red-500/20 dark:text-red-400' },
    vencida:    { label: 'Vencida',    color: 'bg-amber-100 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400' },
};

const TABS: { key: string; label: string }[] = [
    { key: 'borrador',   label: 'Borradores' },
    { key: 'aprobada',   label: 'Aprobadas' },
    { key: 'activa',     label: 'Activas' },
    { key: 'descartada', label: 'Descartadas' },
];

// --- Panel informativo ---
const PanelInfo: React.FC = () => {
    const [open, setOpen] = useState(false);
    return (
        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-sm overflow-hidden">
            <button
                onClick={() => setOpen(v => !v)}
                className="w-full flex items-center justify-between p-5 text-left hover:bg-slate-50 dark:hover:bg-zinc-800/50 transition-colors"
            >
                <div className="flex items-center gap-3">
                    <div className="size-9 rounded-xl bg-violet-100 dark:bg-violet-500/20 flex items-center justify-center">
                        <span className="material-symbols-outlined text-violet-600 dark:text-violet-400 text-base">auto_awesome</span>
                    </div>
                    <div>
                        <p className="text-sm font-black text-slate-900 dark:text-white">¿Cómo funciona el sistema de Promociones IA?</p>
                        <p className="text-xs text-slate-400">Entendé en qué datos se basa la IA para sugerir promos</p>
                    </div>
                </div>
                <span className={`material-symbols-outlined text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`}>expand_more</span>
            </button>

            {open && (
                <div className="border-t border-slate-100 dark:border-zinc-800 p-5 space-y-6">
                    {/* Flujo */}
                    <div>
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3">Flujo automático (cada lunes 8am)</p>
                        <div className="flex flex-wrap items-center gap-2">
                            {[
                                { icon: 'database', label: 'Datos reales\ndel negocio' },
                                { icon: 'arrow_forward', label: null },
                                { icon: 'merge', label: 'Combina\nproductos + combos' },
                                { icon: 'arrow_forward', label: null },
                                { icon: 'smart_toy', label: 'GPT-4o genera\n4 sugerencias' },
                                { icon: 'arrow_forward', label: null },
                                { icon: 'campaign', label: 'Se guardan\ncomo borradores' },
                            ].map((step, i) =>
                                step.label === null ? (
                                    <span key={i} className="material-symbols-outlined text-slate-300 dark:text-zinc-600 text-lg">arrow_forward</span>
                                ) : (
                                    <div key={i} className="flex flex-col items-center gap-1 px-3 py-2 bg-slate-50 dark:bg-zinc-800 rounded-xl">
                                        <span className="material-symbols-outlined text-violet-500 text-base">{step.icon}</span>
                                        <span className="text-[9px] font-bold text-slate-500 text-center leading-tight whitespace-pre-line">{step.label}</span>
                                    </div>
                                )
                            )}
                        </div>
                    </div>

                    {/* Fuentes de datos */}
                    <div>
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3">En qué datos se basa la IA</p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {[
                                {
                                    icon: 'shopping_cart',
                                    color: 'bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400',
                                    title: 'Pares frecuentes',
                                    desc: 'Productos que los clientes compran juntos. La IA usa estos pares como base de los combos porque ya hay demanda probada.',
                                    fuente: 'vista_combos_frecuentes',
                                },
                                {
                                    icon: 'inventory_2',
                                    color: 'bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400',
                                    title: 'Stock alto',
                                    desc: 'Productos con mucho inventario acumulado. La IA los incluye en combos para ayudar a rotar y liberar espacio.',
                                    fuente: 'vista_productos_para_promociones',
                                },
                                {
                                    icon: 'trending_down',
                                    color: 'bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400',
                                    title: 'Sin movimiento',
                                    desc: 'Productos sin ventas en los últimos 30 días. Se priorizan en combos con descuento para activarlos.',
                                    fuente: 'vista_productos_para_promociones',
                                },
                                {
                                    icon: 'star',
                                    color: 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
                                    title: 'Top ventas',
                                    desc: 'Los productos más vendidos del mes. Se usan como ancla del combo para atraer al cliente y meter productos de menor rotación.',
                                    fuente: 'vista_productos_para_promociones',
                                },
                            ].map((item, i) => (
                                <div key={i} className="flex gap-3 p-3 bg-slate-50 dark:bg-zinc-800/50 rounded-xl border border-slate-100 dark:border-zinc-800">
                                    <div className={`size-8 rounded-lg flex items-center justify-center shrink-0 ${item.color}`}>
                                        <span className="material-symbols-outlined text-base">{item.icon}</span>
                                    </div>
                                    <div>
                                        <p className="text-xs font-black text-slate-700 dark:text-slate-200">{item.title}</p>
                                        <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed mt-0.5">{item.desc}</p>
                                        <p className="text-[9px] font-bold text-slate-300 dark:text-zinc-600 mt-1 font-mono">{item.fuente}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Reglas */}
                    <div>
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3">Reglas que aplica la IA</p>
                        <div className="flex flex-wrap gap-2">
                            {[
                                'Descuentos realistas: 5% a 15%',
                                'No incluye productos con stock bajo',
                                'Vigencia sugerida: 7 días',
                                'Máximo 4 productos por combo',
                                'Prioriza rotar stock alto y sin movimiento',
                                'Usa pares frecuentes como base',
                            ].map((r, i) => (
                                <span key={i} className="px-3 py-1 bg-violet-50 dark:bg-violet-500/10 text-violet-700 dark:text-violet-300 text-[10px] font-bold rounded-full border border-violet-100 dark:border-violet-500/20">
                                    {r}
                                </span>
                            ))}
                        </div>
                    </div>

                    {/* Costos */}
                    <div className="p-4 bg-amber-50 dark:bg-amber-500/10 rounded-xl border border-amber-100 dark:border-amber-500/20">
                        <div className="flex gap-2 items-start">
                            <span className="material-symbols-outlined text-amber-500 text-sm mt-0.5">monetization_on</span>
                            <div>
                                <p className="text-[10px] font-black uppercase tracking-widest text-amber-700 dark:text-amber-400 mb-1">Costos de créditos</p>
                                <p className="text-xs text-amber-700 dark:text-amber-300 leading-relaxed">
                                    Aprobar una promoción cuesta <strong>${COSTO_APROBAR_PROMO.toLocaleString('es-AR')}</strong> créditos.
                                    Generar la imagen para redes sociales cuesta <strong>${COSTO_GENERAR_IMAGEN.toLocaleString('es-AR')}</strong> créditos adicionales.
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

// --- Modal historial de movimientos ---
const HistorialModal: React.FC<{ onClose: () => void; fetchMovimientos: () => void; movimientos: { id: string; tipo: string; concepto: string | null; monto: number; saldo_resultante: number; created_at: string }[] }> = ({ onClose, fetchMovimientos, movimientos }) => {
    useEffect(() => { fetchMovimientos(); }, [fetchMovimientos]);

    const iconMap: Record<string, string> = {
        aprobar_promo: 'thumb_up',
        generar_imagen: 'image',
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-zinc-800 w-full max-w-md overflow-hidden">
                <div className="p-5 border-b border-slate-100 dark:border-zinc-800 flex items-center justify-between">
                    <h3 className="font-black text-slate-900 dark:text-white uppercase tracking-tight">Historial de Créditos</h3>
                    <button onClick={onClose} className="p-1 text-slate-400 hover:text-red-500 transition-colors rounded-lg">
                        <span className="material-symbols-outlined">close</span>
                    </button>
                </div>
                <div className="max-h-[60vh] overflow-y-auto divide-y divide-slate-50 dark:divide-zinc-800">
                    {movimientos.length === 0 ? (
                        <p className="text-center text-sm text-slate-400 py-10">Sin movimientos aún</p>
                    ) : movimientos.map(m => (
                        <div key={m.id} className="flex items-center gap-3 px-5 py-3">
                            <div className="size-8 rounded-lg bg-red-50 dark:bg-red-500/10 text-red-500 flex items-center justify-center shrink-0">
                                <span className="material-symbols-outlined text-sm">{iconMap[m.tipo] || 'remove'}</span>
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-xs font-bold text-slate-700 dark:text-slate-200 truncate">{m.concepto || m.tipo}</p>
                                <p className="text-[10px] text-slate-400">{format(parseISO(m.created_at), 'dd/MM/yyyy HH:mm', { locale: es })}</p>
                            </div>
                            <div className="text-right shrink-0">
                                <p className="text-sm font-black text-red-500">-${Math.abs(m.monto).toLocaleString('es-AR')}</p>
                                <p className="text-[10px] text-slate-400">saldo: ${m.saldo_resultante.toLocaleString('es-AR')}</p>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

// --- EditModal ---
const EditModal: React.FC<{
    promo: Promocion;
    onClose: () => void;
    onSave: () => void;
}> = ({ promo, onClose, onSave }) => {
    const [nombre, setNombre] = useState(promo.nombre);
    const [descripcion, setDescripcion] = useState(promo.descripcion || '');
    const [descuento, setDescuento] = useState(promo.descuento_porcentaje?.toString() || '');
    const [vigenciaDesde, setVigenciaDesde] = useState(promo.vigencia_desde || '');
    const [vigenciaHasta, setVigenciaHasta] = useState(promo.vigencia_hasta || '');
    const [saving, setSaving] = useState(false);

    const handleSave = async () => {
        setSaving(true);
        const { error } = await supabase
            .from('promociones_sugeridas')
            .update({
                nombre,
                descripcion,
                descuento_porcentaje: descuento ? Number(descuento) : null,
                vigencia_desde: vigenciaDesde || null,
                vigencia_hasta: vigenciaHasta || null,
            })
            .eq('id', promo.id);
        setSaving(false);
        if (!error) onSave();
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-zinc-800 w-full max-w-lg overflow-hidden">
                <div className="p-5 border-b border-slate-100 dark:border-zinc-800 flex items-center justify-between">
                    <h3 className="font-black text-slate-900 dark:text-white uppercase tracking-tight">Editar Promoción</h3>
                    <button onClick={onClose} className="p-1 text-slate-400 hover:text-red-500 transition-colors rounded-lg">
                        <span className="material-symbols-outlined">close</span>
                    </button>
                </div>
                <div className="p-5 space-y-4">
                    <div className="space-y-1.5">
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Nombre</label>
                        <input
                            value={nombre}
                            onChange={e => setNombre(e.target.value)}
                            className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-sm font-bold outline-none focus:border-primary transition-all"
                        />
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Descripción</label>
                        <textarea
                            value={descripcion}
                            onChange={e => setDescripcion(e.target.value)}
                            rows={3}
                            className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-sm outline-none focus:border-primary transition-all resize-none"
                        />
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Descuento %</label>
                        <input
                            type="number"
                            min="0" max="100"
                            value={descuento}
                            onChange={e => setDescuento(e.target.value)}
                            className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-sm font-bold outline-none focus:border-primary transition-all"
                        />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Vigencia Desde</label>
                            <input
                                type="date"
                                value={vigenciaDesde}
                                onChange={e => setVigenciaDesde(e.target.value)}
                                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-sm outline-none focus:border-primary transition-all"
                            />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Vigencia Hasta</label>
                            <input
                                type="date"
                                value={vigenciaHasta}
                                onChange={e => setVigenciaHasta(e.target.value)}
                                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-sm outline-none focus:border-primary transition-all"
                            />
                        </div>
                    </div>
                </div>
                <div className="p-5 border-t border-slate-100 dark:border-zinc-800 flex gap-3">
                    <button onClick={onClose} className="flex-1 py-2.5 text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-slate-600 transition-colors">
                        Cancelar
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={saving}
                        className="flex-[2] py-2.5 bg-primary text-white text-[10px] font-black uppercase tracking-widest rounded-xl shadow-lg shadow-primary/20 hover:scale-[0.98] disabled:opacity-50 transition-all flex items-center justify-center gap-2"
                    >
                        {saving ? <div className="size-3 border-2 border-white/20 border-t-white rounded-full animate-spin" /> : <span className="material-symbols-outlined text-base">save</span>}
                        Guardar Cambios
                    </button>
                </div>
            </div>
        </div>
    );
};

// --- PromoCard ---
const PromoCard: React.FC<{
    promo: Promocion;
    onRefresh: () => void;
    saldoCreditos: number | null;
    descontarCreditos: (monto: number, tipo: string, concepto: string, promoId?: string) => Promise<{ ok: boolean; error?: string }>;
}> = ({ promo, onRefresh, saldoCreditos, descontarCreditos }) => {
    const [showEdit, setShowEdit] = useState(false);
    const [loading, setLoading] = useState(false);
    const [generandoImagen, setGenerandoImagen] = useState(false);
    const [progreso, setProgreso] = useState('');
    const [imagenUrl, setImagenUrl] = useState<string | null>(promo.imagen_url || null);
    const [errorCreditos, setErrorCreditos] = useState<string | null>(null);

    const handleGenerarImagen = async () => {
        setErrorCreditos(null);
        const result = await descontarCreditos(COSTO_GENERAR_IMAGEN, 'generar_imagen', `Imagen: ${promo.nombre}`, promo.id);
        if (!result.ok) {
            setErrorCreditos(result.error || 'Saldo insuficiente');
            return;
        }
        setGenerandoImagen(true);
        try {
            const url = await generarImagenPromocion(promo, setProgreso);
            setImagenUrl(url);
            onRefresh();
        } catch (error: any) {
            alert('Error al generar imagen: ' + error.message);
        } finally {
            setGenerandoImagen(false);
            setProgreso('');
        }
    };

    const cambiarEstado = async (nuevoEstado: Promocion['estado']) => {
        setErrorCreditos(null);
        if (nuevoEstado === 'aprobada') {
            const result = await descontarCreditos(COSTO_APROBAR_PROMO, 'aprobar_promo', `Aprobar: ${promo.nombre}`, promo.id);
            if (!result.ok) {
                setErrorCreditos(result.error || 'Saldo insuficiente');
                return;
            }
        }
        setLoading(true);
        await supabase.from('promociones_sugeridas').update({ estado: nuevoEstado }).eq('id', promo.id);
        setLoading(false);
        onRefresh();
    };

    const sinSaldoParaAprobar = saldoCreditos !== null && saldoCreditos < COSTO_APROBAR_PROMO;
    const sinSaldoParaImagen = saldoCreditos !== null && saldoCreditos < COSTO_GENERAR_IMAGEN;

    const productos: ProductoPromo[] = Array.isArray(promo.productos) ? promo.productos : [];
    const estadoCfg = ESTADO_CONFIG[promo.estado];

    return (
        <>
            <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-sm hover:shadow-md transition-all flex flex-col">
                {/* Header */}
                <div className="p-5 border-b border-slate-100 dark:border-zinc-800">
                    <div className="flex items-start justify-between gap-3 mb-2">
                        <h3 className="font-black text-slate-900 dark:text-white text-base leading-tight">{promo.nombre}</h3>
                        <div className="flex items-center gap-1.5 shrink-0">
                            {promo.generada_por_ia && (
                                <span className="px-2 py-0.5 rounded-full bg-violet-100 dark:bg-violet-500/20 text-violet-600 dark:text-violet-400 text-[9px] font-black uppercase tracking-widest">
                                    IA
                                </span>
                            )}
                            <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest ${estadoCfg.color}`}>
                                {estadoCfg.label}
                            </span>
                        </div>
                    </div>
                    <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">{promo.descripcion}</p>
                </div>

                {/* Motivo IA */}
                {promo.motivo_ia && (
                    <div className="px-5 py-3 bg-violet-50 dark:bg-violet-500/5 border-b border-violet-100 dark:border-violet-500/10">
                        <div className="flex gap-2">
                            <span className="material-symbols-outlined text-violet-500 text-sm shrink-0 mt-0.5">psychology</span>
                            <p className="text-xs text-violet-700 dark:text-violet-300 italic leading-relaxed">{promo.motivo_ia}</p>
                        </div>
                    </div>
                )}

                {/* Productos */}
                <div className="p-5 flex-1 space-y-2">
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3">Productos del combo</p>
                    {productos.map((p, i) => (
                        <div key={i} className="flex items-center justify-between py-1.5 border-b border-slate-50 dark:border-zinc-800 last:border-0">
                            <div className="flex items-center gap-2">
                                <div className="size-5 rounded-md bg-primary/10 text-primary text-[9px] font-black flex items-center justify-center">{i + 1}</div>
                                <span className="text-sm font-bold text-slate-700 dark:text-slate-200">{p.nombre}</span>
                            </div>
                            <span className="text-xs font-black text-slate-400">{p.cantidad_sugerida} {p.unidad}</span>
                        </div>
                    ))}
                </div>

                {/* Footer info */}
                <div className="px-5 py-3 bg-slate-50 dark:bg-zinc-800/30 border-t border-slate-100 dark:border-zinc-800 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                        {promo.descuento_porcentaje && (
                            <div className="flex items-center gap-1.5">
                                <span className="material-symbols-outlined text-emerald-500 text-sm">percent</span>
                                <span className="text-sm font-black text-emerald-600">{promo.descuento_porcentaje}% dto.</span>
                            </div>
                        )}
                        {promo.vigencia_hasta && (
                            <div className="flex items-center gap-1.5">
                                <span className="material-symbols-outlined text-slate-400 text-sm">event</span>
                                <span className="text-xs font-bold text-slate-400">
                                    hasta {format(parseISO(promo.vigencia_hasta), 'dd/MM/yyyy', { locale: es })}
                                </span>
                            </div>
                        )}
                    </div>
                    <span className="text-[9px] text-slate-300 dark:text-zinc-600">
                        {format(parseISO(promo.created_at), 'dd/MM/yyyy')}
                    </span>
                </div>

                {/* Error créditos */}
                {errorCreditos && (
                    <div className="px-5 py-3 bg-red-50 dark:bg-red-500/10 border-t border-red-100 dark:border-red-500/20 flex items-center gap-2">
                        <span className="material-symbols-outlined text-red-500 text-sm">error</span>
                        <p className="text-xs font-bold text-red-600 dark:text-red-400">{errorCreditos}</p>
                    </div>
                )}

                {/* Imagen generada preview */}
                {imagenUrl && (
                    <div className="relative group">
                        <img
                            src={imagenUrl}
                            alt="Imagen de promoción"
                            className="w-full aspect-square object-cover"
                        />
                        <a
                            href={imagenUrl}
                            download={`promo-${promo.nombre}.jpg`}
                            target="_blank"
                            rel="noreferrer"
                            className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-all flex items-center justify-center gap-2 text-white font-black text-xs uppercase tracking-widest"
                        >
                            <span className="material-symbols-outlined">download</span>
                            Descargar
                        </a>
                    </div>
                )}

                {/* Generando imagen progress */}
                {generandoImagen && (
                    <div className="px-5 py-4 bg-violet-50 dark:bg-violet-500/10 flex items-center gap-3">
                        <div className="size-4 border-2 border-violet-300 border-t-violet-600 rounded-full animate-spin shrink-0" />
                        <span className="text-xs font-bold text-violet-600 dark:text-violet-400">{progreso || 'Generando...'}</span>
                    </div>
                )}

                {/* Acciones */}
                <div className="p-4 border-t border-slate-100 dark:border-zinc-800 flex gap-2">
                    <button
                        onClick={() => setShowEdit(true)}
                        className="p-2 text-slate-400 hover:text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-500/10 rounded-lg transition-all"
                        title="Editar"
                    >
                        <span className="material-symbols-outlined text-xl">edit_square</span>
                    </button>

                    {(promo.estado === 'aprobada' || promo.estado === 'activa') && (
                        <button
                            onClick={handleGenerarImagen}
                            disabled={generandoImagen || sinSaldoParaImagen}
                            className="p-2 text-slate-400 hover:text-violet-500 hover:bg-violet-50 dark:hover:bg-violet-500/10 rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                            title={sinSaldoParaImagen ? `Saldo insuficiente (necesitás $${COSTO_GENERAR_IMAGEN.toLocaleString('es-AR')})` : 'Generar imagen para redes'}
                        >
                            <span className="material-symbols-outlined text-xl">
                                {generandoImagen ? 'hourglass_top' : 'image'}
                            </span>
                        </button>
                    )}

                    {promo.estado === 'borrador' && (
                        <>
                            <button
                                onClick={() => cambiarEstado('aprobada')}
                                disabled={loading || sinSaldoParaAprobar}
                                title={sinSaldoParaAprobar ? `Saldo insuficiente (necesitás $${COSTO_APROBAR_PROMO.toLocaleString('es-AR')})` : ''}
                                className="flex-1 py-2 bg-blue-600 text-white text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-1.5"
                            >
                                <span className="material-symbols-outlined text-sm">thumb_up</span>
                                Aprobar · ${COSTO_APROBAR_PROMO.toLocaleString('es-AR')}
                            </button>
                            <button
                                onClick={() => cambiarEstado('descartada')}
                                disabled={loading}
                                className="flex-1 py-2 bg-slate-100 dark:bg-zinc-800 text-slate-500 text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-red-50 hover:text-red-500 disabled:opacity-50 transition-all flex items-center justify-center gap-1.5"
                            >
                                <span className="material-symbols-outlined text-sm">thumb_down</span>
                                Descartar
                            </button>
                        </>
                    )}

                    {promo.estado === 'aprobada' && (
                        <>
                            <button
                                onClick={() => cambiarEstado('activa')}
                                disabled={loading}
                                className="flex-1 py-2 bg-emerald-600 text-white text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-emerald-700 disabled:opacity-50 transition-all flex items-center justify-center gap-1.5"
                            >
                                <span className="material-symbols-outlined text-sm">rocket_launch</span>
                                Activar
                            </button>
                            <button
                                onClick={() => cambiarEstado('borrador')}
                                disabled={loading}
                                className="py-2 px-3 bg-slate-100 dark:bg-zinc-800 text-slate-500 text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-slate-200 disabled:opacity-50 transition-all"
                            >
                                <span className="material-symbols-outlined text-sm">undo</span>
                            </button>
                        </>
                    )}

                    {promo.estado === 'activa' && (
                        <button
                            onClick={() => cambiarEstado('vencida')}
                            disabled={loading}
                            className="flex-1 py-2 bg-slate-100 dark:bg-zinc-800 text-slate-500 text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-amber-50 hover:text-amber-600 disabled:opacity-50 transition-all flex items-center justify-center gap-1.5"
                        >
                            <span className="material-symbols-outlined text-sm">timer_off</span>
                            Finalizar
                        </button>
                    )}

                    {(promo.estado === 'descartada' || promo.estado === 'vencida') && (
                        <button
                            onClick={() => cambiarEstado('borrador')}
                            disabled={loading}
                            className="flex-1 py-2 bg-slate-100 dark:bg-zinc-800 text-slate-500 text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-slate-200 disabled:opacity-50 transition-all flex items-center justify-center gap-1.5"
                        >
                            <span className="material-symbols-outlined text-sm">restart_alt</span>
                            Restaurar
                        </button>
                    )}
                </div>
            </div>

            {showEdit && (
                <EditModal
                    promo={promo}
                    onClose={() => setShowEdit(false)}
                    onSave={() => { setShowEdit(false); onRefresh(); }}
                />
            )}
        </>
    );
};

// --- Widget saldo ---
const SaldoWidget: React.FC<{ saldo: number | null; loading: boolean; onClick: () => void }> = ({ saldo, loading, onClick }) => {
    const colorClass =
        saldo === null ? 'bg-slate-100 text-slate-500 dark:bg-zinc-800 dark:text-slate-400'
        : saldo > 3000 ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400'
        : saldo > 1000 ? 'bg-amber-50 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400'
        : 'bg-red-50 text-red-600 dark:bg-red-500/20 dark:text-red-400';

    return (
        <button
            onClick={onClick}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg transition-all hover:scale-[0.98] ${colorClass}`}
            title="Ver historial de créditos"
        >
            <span className="material-symbols-outlined text-sm">toll</span>
            <span className="text-[10px] font-black uppercase tracking-widest">
                {loading ? 'Cargando...' : saldo !== null ? `Créditos: $${saldo.toLocaleString('es-AR')}` : 'Sin saldo'}
            </span>
        </button>
    );
};

// --- Página principal ---
const Promociones: React.FC = () => {
    const [promociones, setPromociones] = useState<Promocion[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('borrador');
    const [counts, setCounts] = useState<Record<string, number>>({});
    const [showHistorial, setShowHistorial] = useState(false);

    const { saldo, loading: loadingSaldo, movimientos, fetchMovimientos, descontarCreditos, refetch: refetchSaldo } = useSistemaCreditos();

    const fetchPromociones = useCallback(async () => {
        setLoading(true);
        const { data } = await supabase
            .from('promociones_sugeridas')
            .select('*')
            .order('created_at', { ascending: false });

        const all = data || [];
        const c: Record<string, number> = {};
        TABS.forEach(t => { c[t.key] = all.filter(p => p.estado === t.key).length; });
        setCounts(c);
        setPromociones(all);
        setLoading(false);
    }, []);

    useEffect(() => { fetchPromociones(); }, [fetchPromociones]);

    const handleRefresh = useCallback(() => {
        fetchPromociones();
        refetchSaldo();
    }, [fetchPromociones, refetchSaldo]);

    const filtradas = promociones.filter(p => p.estado === activeTab);

    return (
        <Layout>
            <MainHeader title="Promociones y Combos">
                <div className="flex items-center gap-2">
                    <SaldoWidget
                        saldo={saldo}
                        loading={loadingSaldo}
                        onClick={() => setShowHistorial(true)}
                    />
                    <div className="flex items-center gap-2 px-3 py-1.5 bg-violet-100 dark:bg-violet-500/20 rounded-lg">
                        <span className="material-symbols-outlined text-violet-500 text-sm">smart_toy</span>
                        <span className="text-[10px] font-black uppercase tracking-widest text-violet-600 dark:text-violet-400">Generado por IA</span>
                    </div>
                </div>
            </MainHeader>

            <div className="p-4 sm:p-8 space-y-6 max-w-[1400px] mx-auto w-full">

                {/* Panel informativo */}
                <PanelInfo />

                {/* Tabs */}
                <div className="flex gap-1 bg-slate-100 dark:bg-zinc-800 p-1 rounded-xl w-fit">
                    {TABS.map(tab => (
                        <button
                            key={tab.key}
                            onClick={() => setActiveTab(tab.key)}
                            className={`px-4 py-2 rounded-lg text-xs font-black uppercase tracking-widest transition-all flex items-center gap-2 ${
                                activeTab === tab.key
                                    ? 'bg-white dark:bg-zinc-900 text-primary shadow-sm'
                                    : 'text-slate-400 hover:text-slate-600'
                            }`}
                        >
                            {tab.label}
                            {counts[tab.key] > 0 && (
                                <span className={`size-5 rounded-full text-[9px] font-black flex items-center justify-center ${
                                    activeTab === tab.key ? 'bg-primary text-white' : 'bg-slate-200 dark:bg-zinc-700 text-slate-500'
                                }`}>
                                    {counts[tab.key]}
                                </span>
                            )}
                        </button>
                    ))}
                </div>

                {/* Grid */}
                {loading ? (
                    <div className="flex flex-col items-center justify-center py-20 gap-4">
                        <div className="size-10 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
                        <span className="text-xs font-black uppercase tracking-widest text-slate-400">Cargando promociones...</span>
                    </div>
                ) : filtradas.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 gap-3 text-slate-400">
                        <span className="material-symbols-outlined text-5xl">campaign</span>
                        <p className="font-black text-sm uppercase tracking-widest">No hay promociones en este estado</p>
                        {activeTab === 'borrador' && (
                            <p className="text-xs text-center max-w-xs">
                                El workflow de n8n genera nuevas sugerencias automáticamente cada lunes.
                            </p>
                        )}
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                        {filtradas.map(promo => (
                            <PromoCard
                                key={promo.id}
                                promo={promo}
                                onRefresh={handleRefresh}
                                saldoCreditos={saldo}
                                descontarCreditos={descontarCreditos}
                            />
                        ))}
                    </div>
                )}
            </div>

            {showHistorial && (
                <HistorialModal
                    onClose={() => setShowHistorial(false)}
                    fetchMovimientos={fetchMovimientos}
                    movimientos={movimientos}
                />
            )}
        </Layout>
    );
};

export default Promociones;
