import React, { useState, useEffect, useCallback, useRef } from 'react';
import { format } from 'date-fns';
import Layout from '../components/Layout';
import MainHeader from '../components/MainHeader';
import { supabase } from '../lib/supabase';

interface Producto {
    id: string;
    codigo: string | null;
    nombre: string;
    stock_actual: number;
}

interface InsumoItem extends Producto {
    cantidad: number;
}

const Elaboracion: React.FC = () => {

    const [productos, setProductos] = useState<Producto[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [history, setHistory] = useState<any[]>([]);

    // Insumos State
    const [insumos, setInsumos] = useState<InsumoItem[]>([]);
    const [searchInsumo, setSearchInsumo] = useState('');
    const [filteredInsumos, setFilteredInsumos] = useState<Producto[]>([]);
    const [insumoDropdown, setInsumoDropdown] = useState(false);
    const insumoSearchRef = useRef<HTMLDivElement>(null);

    // Resultado State
    const [productoResultado, setProductoResultado] = useState<Producto | null>(null);
    const [cantidadResultado, setCantidadResultado] = useState<number>(0);
    const [searchResultado, setSearchResultado] = useState('');
    const [filteredResultados, setFilteredResultados] = useState<Producto[]>([]);
    const [resultadoDropdown, setResultadoDropdown] = useState(false);
    const resultadoSearchRef = useRef<HTMLDivElement>(null);

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const { data: productsData } = await supabase.from('productos').select('id, codigo, nombre, stock_actual').order('nombre');
            setProductos(productsData || []);

            // Cargar Historial Reciente (últimos 30 movimientos de elaboración)
            const { data: historyData } = await supabase
                .from('movimientos_stock')
                .select('*, productos(nombre)')
                .ilike('motivo', 'Elaboración%')
                .order('created_at', { ascending: false })
                .limit(30);
            
            setHistory(historyData || []);
        } catch (error) {
            console.error('Error fetching data:', error);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    // Click outside search results
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (insumoSearchRef.current && !insumoSearchRef.current.contains(event.target as Node)) {
                setInsumoDropdown(false);
            }
            if (resultadoSearchRef.current && !resultadoSearchRef.current.contains(event.target as Node)) {
                setResultadoDropdown(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Search Handlers
    const handleInsumoSearch = (val: string) => {
        setSearchInsumo(val);
        if (val.length > 0) {
            const filtered = productos.filter(p =>
                p.nombre.toLowerCase().includes(val.toLowerCase()) ||
                (p.codigo && p.codigo.toLowerCase().includes(val.toLowerCase()))
            ).slice(0, 10);
            setFilteredInsumos(filtered);
            setInsumoDropdown(true);
        } else {
            setInsumoDropdown(false);
        }
    };

    const handleResultSearch = (val: string) => {
        setSearchResultado(val);
        if (val.length > 0) {
            const filtered = productos.filter(p =>
                p.nombre.toLowerCase().includes(val.toLowerCase()) ||
                (p.codigo && p.codigo.toLowerCase().includes(val.toLowerCase()))
            ).slice(0, 10);
            setFilteredResultados(filtered);
            setResultadoDropdown(true);
        } else {
            setResultadoDropdown(false);
        }
    };

    const addInsumo = (prod: Producto) => {
        const existing = insumos.find(item => item.id === prod.id);
        if (existing) {
            setInsumos(insumos.map(item =>
                item.id === prod.id ? { ...item, cantidad: item.cantidad + 1 } : item
            ));
        } else {
            setInsumos([...insumos, { ...prod, cantidad: 1 }]);
        }
        setSearchInsumo('');
        setInsumoDropdown(false);
    };

    const updateInsumoQuantity = (id: string, value: string) => {
        const newQty = parseFloat(value);
        if (isNaN(newQty)) return;
        setInsumos(insumos.map(item => item.id === id ? { ...item, cantidad: newQty } : item));
    };

    const removeInsumo = (id: string) => {
        setInsumos(insumos.filter(item => item.id !== id));
    };

    const selectResultado = (prod: Producto) => {
        setProductoResultado(prod);
        setSearchResultado('');
        setResultadoDropdown(false);
    };

    const handleConfirm = async () => {
        if (insumos.length === 0 || !productoResultado || cantidadResultado <= 0) {
            alert('Debe seleccionar al menos un insumo y un producto de salida con cantidad mayor a cero.');
            return;
        }

        setSaving(true);
        try {
            const batchId = crypto.randomUUID();
            const timestamp = format(new Date(), 'dd/MM/yyyy HH:mm');
            const shortRef = batchId.slice(0, 8);
            const motivo = `Elaboración [Ref: ${shortRef}] - ${timestamp}`;

            // Process Insumos (Salidas)
            for (const item of insumos) {
                const stockAnterior = item.stock_actual;
                const stockNuevo = stockAnterior - item.cantidad;

                const { error } = await supabase.from('movimientos_stock').insert({
                    producto_id: item.id,
                    tipo: 'salida',
                    cantidad: item.cantidad,
                    stock_anterior: stockAnterior,
                    stock_nuevo: stockNuevo,
                    motivo: motivo,
                    referencia_tipo: 'ajuste_manual'
                });

                if (error) throw error;
            }

            // Process Resultado (Entrada)
            const stockAnteriorRes = productoResultado.stock_actual;
            const stockNuevoRes = stockAnteriorRes + cantidadResultado;

            const { error: resError } = await supabase.from('movimientos_stock').insert({
                producto_id: productoResultado.id,
                tipo: 'entrada',
                cantidad: cantidadResultado,
                stock_anterior: stockAnteriorRes,
                stock_nuevo: stockNuevoRes,
                motivo: motivo,
                referencia_tipo: 'ajuste_manual'
            });

            if (resError) throw resError;

            alert('Elaboración procesada con éxito.');
            setInsumos([]);
            setProductoResultado(null);
            setCantidadResultado(0);
            fetchData();
        } catch (error) {
            console.error('Error processing elaboration:', error);
            alert('Ocurrió un error al procesar la elaboración.');
        } finally {
            setSaving(false);
        }
    };

    return (
        <Layout>
            <MainHeader title="Elaboración de Productos" />

            <div className="p-4 lg:p-6 space-y-6 pb-24">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Panel de Insumos */}
                    <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-sm border border-slate-200 dark:border-zinc-800 flex flex-col overflow-hidden">
                        <div className="p-4 border-b border-slate-100 dark:border-zinc-800 bg-slate-50/50 dark:bg-zinc-800/30">
                            <h3 className="font-bold text-slate-800 dark:text-zinc-200 flex items-center gap-2">
                                <span className="material-symbols-outlined text-primary">inventory</span>
                                Insumos (Materia Prima)
                            </h3>
                            <p className="text-xs text-slate-500 dark:text-zinc-500 mt-1">
                                Seleccione los productos que se consumirán en el proceso.
                            </p>
                        </div>

                        <div className="p-4">
                            <div className="relative" ref={insumoSearchRef}>
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                                    <span className="material-symbols-outlined text-lg">search</span>
                                </div>
                                <input
                                    type="text"
                                    className="w-full pl-10 pr-4 py-3 bg-slate-50 dark:bg-zinc-800/50 border-none rounded-xl text-sm focus:ring-2 focus:ring-primary/20 transition-all outline-none"
                                    placeholder="Buscar insumo por nombre o código..."
                                    value={searchInsumo}
                                    onChange={(e) => handleInsumoSearch(e.target.value)}
                                />

                                {insumoDropdown && filteredInsumos.length > 0 && (
                                    <div className="absolute z-50 w-full mt-2 bg-white dark:bg-zinc-900 rounded-xl shadow-xl border border-slate-200 dark:border-zinc-800 overflow-hidden max-h-60 overflow-y-auto animate-in fade-in slide-in-from-top-2 duration-200">
                                        {filteredInsumos.map(p => (
                                            <button
                                                key={p.id}
                                                onClick={() => addInsumo(p)}
                                                className="w-full px-4 py-3 text-left hover:bg-slate-50 dark:hover:bg-zinc-800 flex items-center gap-3 border-b border-slate-50 dark:border-zinc-800 last:border-none group transition-colors"
                                            >
                                                <div className="size-8 rounded-lg bg-slate-100 dark:bg-zinc-800 flex items-center justify-center text-slate-500 group-hover:bg-primary/20 group-hover:text-primary transition-colors">
                                                    <span className="material-symbols-outlined text-lg whitespace-nowrap">category</span>
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-sm font-semibold truncate">{p.nombre}</p>
                                                    <p className="text-[10px] text-slate-500">{p.codigo || 'S/C'} • Stock: {p.stock_actual}</p>
                                                </div>
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>

                            <div className="mt-4 space-y-2 max-h-[300px] overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-slate-200 dark:scrollbar-thumb-zinc-800">
                                {insumos.length === 0 ? (
                                    <div className="py-12 flex flex-col items-center justify-center text-slate-400 bg-slate-50/50 dark:bg-zinc-800/20 rounded-2xl border-2 border-dashed border-slate-200 dark:border-zinc-800/50">
                                        <span className="material-symbols-outlined text-4xl opacity-20 mb-2">add_shopping_cart</span>
                                        <p className="text-sm">No has agregado insumos</p>
                                    </div>
                                ) : (
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-sm">
                                            <thead>
                                                <tr className="text-left text-slate-500 border-b border-slate-100 dark:border-zinc-800">
                                                    <th className="pb-2 font-medium">Producto</th>
                                                    <th className="pb-2 font-medium w-32 text-center">Cantidad</th>
                                                    <th className="pb-2 font-medium w-12"></th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-50 dark:divide-zinc-800/50">
                                                {insumos.map(item => (
                                                    <tr key={item.id}>
                                                        <td className="py-3">
                                                            <p className="font-semibold truncate max-w-[150px]">{item.nombre}</p>
                                                            <p className="text-[10px] text-slate-500">Stock: {item.stock_actual}</p>
                                                        </td>
                                                        <td className="py-3 px-2">
                                                            <div className="flex items-center justify-center">
                                                                <input
                                                                    type="number"
                                                                    step="0.001"
                                                                    className="w-24 px-2 py-1.5 bg-slate-50 dark:bg-zinc-800 border-none rounded-lg text-center font-bold focus:ring-2 focus:ring-primary/20 transition-all outline-none"
                                                                    value={item.cantidad}
                                                                    onChange={(e) => updateInsumoQuantity(item.id, e.target.value)}
                                                                />
                                                            </div>
                                                        </td>
                                                        <td className="py-3 text-right">
                                                            <button
                                                                onClick={() => removeInsumo(item.id)}
                                                                className="text-slate-400 hover:text-red-500 p-1 transition-colors"
                                                            >
                                                                <span className="material-symbols-outlined text-lg">close</span>
                                                            </button>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Panel de Resultado */}
                    <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-sm border border-slate-200 dark:border-zinc-800 flex flex-col overflow-hidden h-fit">
                        <div className="p-4 border-b border-slate-100 dark:border-zinc-800 bg-emerald-50/50 dark:bg-emerald-900/10">
                            <h3 className="font-bold text-slate-800 dark:text-zinc-200 flex items-center gap-2">
                                <span className="material-symbols-outlined text-emerald-500">check_circle</span>
                                Producto Resultante
                            </h3>
                            <p className="text-xs text-slate-500 dark:text-zinc-500 mt-1">
                                Seleccione el producto terminado que se obtiene.
                            </p>
                        </div>

                        <div className="p-4 space-y-4">
                            {!productoResultado ? (
                                <div className="relative" ref={resultadoSearchRef}>
                                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                                        <span className="material-symbols-outlined text-lg">search</span>
                                    </div>
                                    <input
                                        type="text"
                                        className="w-full pl-10 pr-4 py-3 bg-slate-50 dark:bg-zinc-800/50 border-none rounded-xl text-sm focus:ring-2 focus:ring-primary/20 transition-all outline-none"
                                        placeholder="Buscar producto de salida..."
                                        value={searchResultado}
                                        onChange={(e) => handleResultSearch(e.target.value)}
                                    />

                                    {resultadoDropdown && filteredResultados.length > 0 && (
                                        <div className="absolute z-50 w-full mt-2 bg-white dark:bg-zinc-900 rounded-xl shadow-xl border border-slate-200 dark:border-zinc-800 overflow-hidden max-h-60 overflow-y-auto animate-in fade-in slide-in-from-top-2 duration-200">
                                            {filteredResultados.map(p => (
                                                <button
                                                    key={p.id}
                                                    onClick={() => selectResultado(p)}
                                                    className="w-full px-4 py-3 text-left hover:bg-slate-50 dark:hover:bg-zinc-800 flex items-center gap-3 border-b border-slate-50 dark:border-zinc-800 last:border-none group transition-colors"
                                                >
                                                    <div className="size-8 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center text-emerald-500 transition-colors">
                                                        <span className="material-symbols-outlined text-lg whitespace-nowrap">auto_awesome</span>
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <p className="text-sm font-semibold truncate">{p.nombre}</p>
                                                        <p className="text-[10px] text-slate-500">{p.codigo || 'S/C'}</p>
                                                    </div>
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <div className="p-4 bg-emerald-50/50 dark:bg-emerald-900/10 rounded-2xl border border-emerald-100 dark:border-emerald-900/20 relative">
                                    <button
                                        onClick={() => setProductoResultado(null)}
                                        className="absolute top-2 right-2 text-slate-400 hover:text-red-500 transition-colors"
                                    >
                                        <span className="material-symbols-outlined text-lg">edit</span>
                                    </button>
                                    <div className="flex items-center gap-3 mb-4">
                                        <div className="size-12 rounded-xl bg-emerald-500 text-white flex items-center justify-center shadow-lg shadow-emerald-500/20">
                                            <span className="material-symbols-outlined text-2xl">hardware</span>
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <h4 className="font-bold text-slate-800 dark:text-zinc-100 truncate">{productoResultado.nombre}</h4>
                                            <p className="text-xs text-slate-500">{productoResultado.codigo || 'S/C'} • Stock actual: <span className="font-bold text-emerald-600 dark:text-emerald-400">{productoResultado.stock_actual}</span></p>
                                        </div>
                                    </div>

                                    <div className="space-y-1.5">
                                        <label className="text-xs font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider ml-1">
                                            Cantidad Producida
                                        </label>
                                        <div className="flex items-center gap-3">
                                            <input
                                                type="number"
                                                step="0.001"
                                                placeholder="0.000"
                                                className="flex-1 px-4 py-3 bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl text-center text-xl font-black text-primary focus:ring-2 focus:ring-primary/20 transition-all outline-none"
                                                value={cantidadResultado || ''}
                                                onChange={(e) => setCantidadResultado(parseFloat(e.target.value) || 0)}
                                            />
                                        </div>
                                    </div>
                                </div>
                            )}

                            <div className="pt-4">
                                <button
                                    onClick={handleConfirm}
                                    disabled={saving || insumos.length === 0 || !productoResultado || cantidadResultado <= 0}
                                    className={`w-full py-4 rounded-xl font-bold flex items-center justify-center gap-2 shadow-lg transition-all ${saving || insumos.length === 0 || !productoResultado || cantidadResultado <= 0
                                            ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                                            : 'bg-primary text-white hover:bg-primary-dark active:scale-[0.98] shadow-primary/20'
                                        }`}
                                >
                                    {saving ? (
                                        <>
                                            <div className="size-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                            <span>Procesando...</span>
                                        </>
                                    ) : (
                                        <>
                                            <span className="material-symbols-outlined">bolt</span>
                                            <span>Confirmar Elaboración</span>
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Historial de Elaboraciones */}
                <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-sm border border-slate-200 dark:border-zinc-800 overflow-hidden">
                    <div className="p-4 border-b border-slate-100 dark:border-zinc-800 flex items-center justify-between">
                        <h3 className="font-bold text-slate-800 dark:text-zinc-200 flex items-center gap-2">
                            <span className="material-symbols-outlined text-primary">history</span>
                            Historial de Elaboración
                        </h3>
                        <p className="text-[10px] text-slate-500 uppercase font-bold tracking-widest">Últimos movimientos</p>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm">
                            <thead>
                                <tr className="text-slate-500 border-b border-slate-100 dark:border-zinc-800">
                                    <th className="px-6 py-4 font-medium">Fecha / Motivo</th>
                                    <th className="px-6 py-4 font-medium">Producto</th>
                                    <th className="px-6 py-4 font-medium text-center">Tipo</th>
                                    <th className="px-6 py-4 font-medium text-right">Cantidad</th>
                                    <th className="px-6 py-4 font-medium text-right whitespace-nowrap">Stock Nuevo</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50 dark:divide-zinc-800/50">
                                {loading ? (
                                    <tr>
                                        <td colSpan={5} className="px-6 py-8 text-center text-slate-400">
                                            Cargando historial...
                                        </td>
                                    </tr>
                                ) : history.length === 0 ? (
                                    <tr>
                                        <td colSpan={5} className="px-6 py-8 text-center text-slate-400">
                                            No hay movimientos de elaboración registrados todavía.
                                        </td>
                                    </tr>
                                ) : (
                                    history.map((mov) => {
                                        const isEntrada = mov.tipo === 'entrada';
                                        return (
                                            <tr key={mov.id} className="hover:bg-slate-50/50 dark:hover:bg-zinc-800/30 transition-colors">
                                                <td className="px-6 py-4">
                                                    <p className="font-medium text-slate-800 dark:text-zinc-200 line-clamp-1">{mov.motivo}</p>
                                                </td>
                                                <td className="px-6 py-4 font-semibold text-slate-700 dark:text-zinc-300">
                                                    {mov.productos?.nombre || 'Producto Desconocido'}
                                                </td>
                                                <td className="px-6 py-4">
                                                    <div className="flex justify-center">
                                                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${isEntrada 
                                                            ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400' 
                                                            : 'bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400'
                                                        }`}>
                                                            {isEntrada ? 'Resultado' : 'Insumo'}
                                                        </span>
                                                    </div>
                                                </td>
                                                <td className={`px-6 py-4 text-right font-bold ${isEntrada ? 'text-emerald-600' : 'text-orange-600'}`}>
                                                    {isEntrada ? '+' : '-'}{mov.cantidad}
                                                </td>
                                                <td className="px-6 py-4 text-right font-medium text-slate-500">
                                                    {mov.stock_nuevo}
                                                </td>
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </Layout>
    );
};

export default Elaboracion;
