import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { format, parseISO } from 'date-fns';
import Layout from '../components/Layout';
import MainHeader from '../components/MainHeader';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/authStore';

interface Producto {
    id: string;
    nombre: string;
    codigo: string;
    stock_actual: number;
    unidad_medida: string;
}

interface MovimientoStock {
    id: string;
    tipo: 'entrada' | 'salida' | 'ajuste' | 'devolucion';
    cantidad: number;
    stock_anterior: number;
    stock_nuevo: number;
    motivo: string;
    referencia_tipo: string;
    created_at: string;
    producto: {
        nombre: string;
        codigo: string;
        unidad_medida: string;
    };
    usuario: {
        nombre: string;
        apellido: string;
    };
}

export default function StockHistorial() {
    const { user } = useAuthStore();
    const [searchParams] = useSearchParams();
    const initialProductId = searchParams.get('id') || 'all';

    const [loading, setLoading] = useState(true);
    const [productos, setProductos] = useState<Producto[]>([]);
    const [selectedProductoId, setSelectedProductoId] = useState<string>(initialProductId);
    const [searchTerm, setSearchTerm] = useState<string>('');
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [movimientos, setMovimientos] = useState<MovimientoStock[]>([]);
    const [stats, setStats] = useState({ entradas: 0, salidas: 0, ajustes: 0 });

    // Filter State
    const [dateRange, setDateRange] = useState({ from: '', to: '' });
    const [filterTipo, setFilterTipo] = useState<string>('all');

    useEffect(() => {
        fetchInitialData();
    }, []);

    useEffect(() => {
        fetchMovimientos();
    }, [selectedProductoId, dateRange, filterTipo]);

    const fetchInitialData = async () => {
        try {
            const { data } = await supabase
                .from('productos')
                .select('id, nombre, codigo, stock_actual, unidad_medida')
                .eq('activo', true)
                .order('nombre');
            
            const fetchedProductos = data || [];
            setProductos(fetchedProductos);

            // If we came with an ID, set the search term to the product name
            if (initialProductId !== 'all') {
                const prod = fetchedProductos.find(p => p.id === initialProductId);
                if (prod) setSearchTerm(prod.nombre);
            }
        } catch (error) {
            console.error("Error fetching products", error);
        }
    };

    const fetchMovimientos = async () => {
        setLoading(true);
        try {
            let query = supabase
                .from('movimientos_stock')
                .select(`
                    *,
                    producto:productos(nombre, codigo, unidad_medida),
                    usuario:profiles(nombre, apellido)
                `)
                .order('created_at', { ascending: false });

            if (selectedProductoId !== 'all') {
                query = query.eq('producto_id', selectedProductoId);
            }

            if (dateRange.from) {
                query = query.gte('created_at', new Date(dateRange.from + 'T00:00:00').toISOString());
            }
            if (dateRange.to) {
                query = query.lte('created_at', new Date(dateRange.to + 'T23:59:59.999').toISOString());
            }

            if (filterTipo !== 'all') {
                query = query.eq('tipo', filterTipo);
            }

            const { data, error } = await query.limit(100);
            if (error) throw error;

            const movs = data as any[];
            setMovimientos(movs || []);

            // Calculate local stats for the filtered set
            const ent = movs.filter(m => m.tipo === 'entrada').reduce((acc, m) => acc + Number(m.cantidad), 0);
            const sal = movs.filter(m => m.tipo === 'salida').reduce((acc, m) => acc + Number(m.cantidad), 0);
            const aju = movs.filter(m => m.tipo === 'ajuste').reduce((acc, m) => acc + Number(m.cantidad), 0);
            setStats({ entradas: ent, salidas: sal, ajustes: aju });

        } catch (error) {
            console.error("Error fetching movements", error);
        } finally {
            setLoading(false);
        }
    };

    const getTipoBadge = (tipo: string) => {
        switch (tipo) {
            case 'entrada': return <span className="px-2 py-1 bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400 rounded-lg text-[10px] font-black uppercase tracking-widest flex items-center gap-1 w-fit"><span className="material-symbols-outlined text-sm">add_circle</span>Entrada</span>;
            case 'salida': return <span className="px-2 py-1 bg-rose-100 text-rose-600 dark:bg-rose-900/30 dark:text-rose-400 rounded-lg text-[10px] font-black uppercase tracking-widest flex items-center gap-1 w-fit"><span className="material-symbols-outlined text-sm">remove_circle</span>Salida</span>;
            case 'ajuste': return <span className="px-2 py-1 bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400 rounded-lg text-[10px] font-black uppercase tracking-widest flex items-center gap-1 w-fit"><span className="material-symbols-outlined text-sm">settings</span>Ajuste</span>;
            default: return <span className="px-2 py-1 bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 rounded-lg text-[10px] font-black uppercase tracking-widest flex items-center gap-1 w-fit">{tipo}</span>;
        }
    };

    return (
        <Layout>
            <MainHeader title="Historial de Stock">
                <span className="px-3 py-1 bg-primary/10 text-primary text-[10px] font-black uppercase tracking-widest rounded-full border border-primary/20">Kardex</span>
            </MainHeader>

            <div className="p-4 lg:p-8 max-w-[1600px] mx-auto w-full space-y-6 pb-24 lg:pb-8">
                
                {/* Filters Section */}
                <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-[2rem] p-6 shadow-sm space-y-6">
                    <div className="flex flex-col lg:flex-row gap-6 items-end justify-between">
                        <div className="w-full lg:flex-1 space-y-2 relative">
                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Buscar Producto</label>
                            <div className="relative group">
                                <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-primary transition-colors">search</span>
                                <input 
                                    type="text"
                                    placeholder="Nombre o código del producto..."
                                    className="w-full bg-slate-50 dark:bg-zinc-800 border-none rounded-2xl pl-12 pr-4 py-3 text-sm font-bold focus:ring-2 focus:ring-primary/50"
                                    value={searchTerm}
                                    onChange={(e) => {
                                        setSearchTerm(e.target.value);
                                        setShowSuggestions(true);
                                    }}
                                    onFocus={() => setShowSuggestions(true)}
                                />
                                
                                {showSuggestions && (searchTerm || selectedProductoId !== 'all') && (
                                    <div className="absolute top-full left-0 w-full mt-2 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl shadow-xl z-50 max-h-60 overflow-y-auto overflow-x-hidden p-2 space-y-1">
                                        <button 
                                            onClick={() => {
                                                setSelectedProductoId('all');
                                                setSearchTerm('');
                                                setShowSuggestions(false);
                                            }}
                                            className="w-full text-left px-4 py-2 rounded-xl text-xs font-bold hover:bg-slate-100 dark:hover:bg-zinc-800 flex items-center justify-between"
                                        >
                                            <span>Todos los Productos</span>
                                            {selectedProductoId === 'all' && <span className="material-symbols-outlined text-primary text-sm">check</span>}
                                        </button>
                                        <div className="h-[1px] bg-slate-100 dark:bg-zinc-800 mx-2 my-1"></div>
                                        {productos
                                            .filter(p => p.nombre.toLowerCase().includes(searchTerm.toLowerCase()) || p.codigo?.toLowerCase().includes(searchTerm.toLowerCase()))
                                            .slice(0, 10)
                                            .map(p => (
                                                <button 
                                                    key={p.id}
                                                    onClick={() => {
                                                        setSelectedProductoId(p.id);
                                                        setSearchTerm(p.nombre);
                                                        setShowSuggestions(false);
                                                    }}
                                                    className="w-full text-left px-4 py-2 rounded-xl text-xs font-bold hover:bg-slate-100 dark:hover:bg-zinc-800 flex items-center justify-between transition-colors"
                                                >
                                                    <div className="flex flex-col">
                                                        <span className={selectedProductoId === p.id ? 'text-primary' : ''}>{p.nombre}</span>
                                                        <span className="text-[9px] text-slate-400 uppercase tracking-widest">{p.codigo || 'SIN CÓDIGO'}</span>
                                                    </div>
                                                    {selectedProductoId === p.id && <span className="material-symbols-outlined text-primary text-sm">check</span>}
                                                </button>
                                            ))
                                        }
                                    </div>
                                )}
                                
                                {showSuggestions && (
                                    <div 
                                        className="fixed inset-0 z-40" 
                                        onClick={() => setShowSuggestions(false)}
                                    ></div>
                                )}
                            </div>
                        </div>

                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 w-full lg:w-auto">
                            <div className="space-y-2">
                                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Tipo</label>
                                <select 
                                    className="w-full bg-slate-50 dark:bg-zinc-800 border-none rounded-2xl px-4 py-3 text-xs font-bold focus:ring-2 focus:ring-primary/50"
                                    value={filterTipo}
                                    onChange={(e) => setFilterTipo(e.target.value)}
                                >
                                    <option value="all">Todos</option>
                                    <option value="entrada">Entradas</option>
                                    <option value="salida">Salidas</option>
                                    <option value="ajuste">Ajustes</option>
                                </select>
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Desde</label>
                                <input 
                                    type="date" 
                                    className="w-full bg-slate-50 dark:bg-zinc-800 border-none rounded-2xl px-4 py-3 text-xs font-bold focus:ring-2 focus:ring-primary/50"
                                    value={dateRange.from}
                                    onChange={(e) => setDateRange(prev => ({ ...prev, from: e.target.value }))}
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Hasta</label>
                                <input 
                                    type="date" 
                                    className="w-full bg-slate-50 dark:bg-zinc-800 border-none rounded-2xl px-4 py-3 text-xs font-bold focus:ring-2 focus:ring-primary/50"
                                    value={dateRange.to}
                                    onChange={(e) => setDateRange(prev => ({ ...prev, to: e.target.value }))}
                                />
                            </div>
                            <button 
                                onClick={() => { setSelectedProductoId('all'); setDateRange({ from: '', to: '' }); setFilterTipo('all'); }}
                                className="mt-auto h-[44px] bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 text-slate-500 rounded-2xl flex items-center justify-center transition-all"
                                title="Limpiar Filtros"
                            >
                                <span className="material-symbols-outlined">restart_alt</span>
                            </button>
                        </div>
                    </div>
                </div>

                {/* Stats Summary */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-100 dark:border-emerald-800/30 p-6 rounded-[2rem] flex items-center justify-between">
                        <div>
                            <p className="text-[10px] font-black uppercase tracking-widest text-emerald-500 mb-1">Total Ingresos</p>
                            <h4 className="text-3xl font-black text-emerald-600 dark:text-emerald-400">+{stats.entradas}</h4>
                        </div>
                        <span className="material-symbols-outlined text-4xl text-emerald-200 dark:text-emerald-800/50">trending_up</span>
                    </div>
                    <div className="bg-rose-50 dark:bg-rose-900/10 border border-rose-100 dark:border-rose-800/30 p-6 rounded-[2rem] flex items-center justify-between">
                        <div>
                            <p className="text-[10px] font-black uppercase tracking-widest text-rose-500 mb-1">Total Salidas</p>
                            <h4 className="text-3xl font-black text-rose-600 dark:text-rose-400">-{stats.salidas}</h4>
                        </div>
                        <span className="material-symbols-outlined text-4xl text-rose-200 dark:text-rose-800/50">trending_down</span>
                    </div>
                    <div className="bg-amber-50 dark:bg-amber-900/10 border border-amber-100 dark:border-amber-800/30 p-6 rounded-[2rem] flex items-center justify-between">
                        <div>
                            <p className="text-[10px] font-black uppercase tracking-widest text-amber-500 mb-1">Ajustes Realizados</p>
                            <h4 className="text-3xl font-black text-amber-600 dark:text-amber-400">{stats.ajustes}</h4>
                        </div>
                        <span className="material-symbols-outlined text-4xl text-amber-200 dark:text-amber-800/50">tune</span>
                    </div>
                </div>

                {/* Movements Table */}
                <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-[2rem] overflow-hidden shadow-sm">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead>
                                <tr className="bg-slate-50 dark:bg-zinc-800/50 border-b border-slate-200 dark:border-zinc-800">
                                    <th className="px-6 py-5 text-[10px] font-black uppercase tracking-widest text-slate-400">Fecha / Usuario</th>
                                    <th className="px-6 py-5 text-[10px] font-black uppercase tracking-widest text-slate-400">Producto</th>
                                    <th className="px-6 py-5 text-[10px] font-black uppercase tracking-widest text-slate-400">Tipo / Motivo</th>
                                    <th className="px-6 py-5 text-[10px] font-black uppercase tracking-widest text-slate-400 text-center">Movimiento</th>
                                    <th className="px-6 py-5 text-[10px] font-black uppercase tracking-widest text-slate-400 text-right">Stock Final</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
                                {loading ? (
                                    <tr>
                                        <td colSpan={5} className="px-6 py-20 text-center">
                                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
                                        </td>
                                    </tr>
                                ) : movimientos.length === 0 ? (
                                    <tr>
                                        <td colSpan={5} className="px-6 py-20 text-center text-slate-400">
                                            <span className="material-symbols-outlined text-5xl mb-2 opacity-20">inventory_2</span>
                                            <p className="font-bold">No se encontraron movimientos con estos filtros</p>
                                        </td>
                                    </tr>
                                ) : (
                                    movimientos.map((m) => (
                                        <tr key={m.id} className="hover:bg-slate-50 dark:hover:bg-zinc-800/40 transition-colors">
                                            <td className="px-6 py-5">
                                                <div className="text-xs font-black text-slate-900 dark:text-white mb-1">
                                                    {format(parseISO(m.created_at), 'dd/MM/yyyy HH:mm')}
                                                </div>
                                                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                                                    {m.usuario?.nombre} {m.usuario?.apellido}
                                                </div>
                                            </td>
                                            <td className="px-6 py-5">
                                                <div className="font-black text-slate-900 dark:text-white uppercase tracking-tighter">
                                                    {m.producto?.nombre}
                                                </div>
                                                <div className="text-[10px] font-bold text-slate-400">
                                                    COD: {m.producto?.codigo || 'S/C'}
                                                </div>
                                            </td>
                                            <td className="px-6 py-5">
                                                <div className="mb-2">{getTipoBadge(m.tipo)}</div>
                                                <div className="text-[10px] font-bold text-slate-500 uppercase italic line-clamp-1">
                                                    {m.motivo || `Referencia: ${m.referencia_tipo}`}
                                                </div>
                                            </td>
                                            <td className="px-6 py-5 text-center">
                                                <div className={`text-lg font-black ${m.tipo === 'entrada' ? 'text-emerald-600' : m.tipo === 'salida' ? 'text-rose-600' : 'text-amber-600'}`}>
                                                    {m.tipo === 'entrada' ? '+' : m.tipo === 'salida' ? '-' : ''}{m.cantidad}
                                                    <span className="text-[9px] font-black ml-1 opacity-60 uppercase">{m.producto?.unidad_medida}</span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-5 text-right">
                                                <div className="text-[10px] font-black text-slate-400 uppercase mb-1">Stock Resultante</div>
                                                <div className="text-base font-black text-slate-900 dark:text-white">
                                                    {m.stock_nuevo} <span className="text-[10px] text-slate-400 font-bold ml-1 uppercase">{m.producto?.unidad_medida}</span>
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

            </div>
        </Layout>
    );
}
