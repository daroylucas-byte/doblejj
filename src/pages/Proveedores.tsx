import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import Layout from '../components/Layout';
import MainHeader from '../components/MainHeader';
import { supabase } from '../lib/supabase';
import ProveedorModal from '../components/ProveedorModal';
import PagoProveedorModal from '../components/PagoProveedorModal';

interface Proveedor {
    id: string;
    razon_social: string;
    nombre_fantasia: string;
    cuit: string;
    telefono: string;
    email: string;
    categoria_proveedor: string;
    saldo_actual: number;
    activo: boolean;
}

const Proveedores: React.FC = () => {
    const [proveedores, setProveedores] = useState<Proveedor[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [categoryFilter, setCategoryFilter] = useState('');
    const [statusFilter, setStatusFilter] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [showPagoModal, setShowPagoModal] = useState(false);
    const [editingProveedor, setEditingProveedor] = useState<Proveedor | null>(null);
    const [pagoProveedor, setPagoProveedor] = useState<Proveedor | null>(null);

    const [stats, setStats] = useState({
        totalDeuda: 0,
        proveedoresActivos: 0,
        ordenesPendientes: 0
    });

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            let query = supabase.from('proveedores').select('*').order('razon_social');

            if (searchTerm) {
                query = query.or(`razon_social.ilike.%${searchTerm}%,cuit.ilike.%${searchTerm}%`);
            }
            if (categoryFilter) {
                query = query.eq('categoria_proveedor', categoryFilter);
            }
            
            // Status filter logic remains on the DB side for initial fetch
            if (statusFilter === 'debt') {
                query = query.lt('saldo_actual', 0);
            } else if (statusFilter === 'no-debt') {
                query = query.gte('saldo_actual', 0);
            }

            const { data, error } = await query;
            if (error) throw error;

            // BUG 1 FIX: Fetch real dynamic balances from the view
            const { data: saldosData } = await supabase
                .from('vista_cuenta_corriente_proveedores')
                .select('proveedor_id, saldo_acumulado')
                .order('fecha', { ascending: false })
                .order('created_at', { ascending: false });

            // Quedarse con el saldo más reciente por proveedor (el primero en DESC)
            const saldosPorProveedor: Record<string, number> = {};
            (saldosData || []).forEach(m => {
                if (!(m.proveedor_id in saldosPorProveedor)) {
                    saldosPorProveedor[m.proveedor_id] = m.saldo_acumulado;
                }
            });

            // Mergear con los proveedores y usar convención vista: positivo = deuda
            const proveedoresConSaldo = (data || []).map(p => ({
                ...p,
                saldo_actual: saldosPorProveedor[p.id] ?? p.saldo_actual
            }));

            setProveedores(proveedoresConSaldo);

            // Calculate basic stats using the new convention (positive = debt)
            const total = proveedoresConSaldo.reduce((acc, curr) => acc + (curr.saldo_actual > 0 ? curr.saldo_actual : 0), 0);
            const activos = (data || []).filter(p => p.activo).length;

            setStats({
                totalDeuda: total,
                proveedoresActivos: activos,
                ordenesPendientes: 0 // This would come from a 'compras' table check
            });

        } catch (error) {
            console.error('Error fetching suppliers:', error);
        } finally {
            setLoading(false);
        }
    }, [searchTerm, categoryFilter, statusFilter]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const handleAdd = () => {
        setEditingProveedor(null);
        setIsModalOpen(true);
    };

    const handleEdit = (proveedor: Proveedor) => {
        setEditingProveedor(proveedor);
        setIsModalOpen(true);
    };

    const handlePago = (proveedor: Proveedor) => {
        setPagoProveedor(proveedor);
        setShowPagoModal(true);
    };

    return (
        <Layout>
            <MainHeader title="Gestión de Proveedores">
                <div className="flex gap-2">
                    <Link
                        to="/compras/nueva"
                        className="flex items-center justify-center gap-2 rounded-xl h-10 px-4 bg-indigo-600 text-white text-sm font-bold shadow-lg shadow-indigo-500/20 hover:bg-indigo-700 transition-all active:scale-95"
                    >
                        <span className="material-symbols-outlined text-sm">local_shipping</span>
                        <span>Registrar Compra</span>
                    </Link>
                    <button
                        onClick={handleAdd}
                        className="flex items-center justify-center gap-2 rounded-xl h-10 px-4 bg-primary text-white text-sm font-bold shadow-lg shadow-primary/20 hover:bg-primary/90 transition-all active:scale-95"
                    >
                        <span className="material-symbols-outlined text-sm">add_circle</span>
                        <span>Nuevo Proveedor</span>
                    </button>
                </div>
            </MainHeader>

            <div className="p-8 max-w-[1600px] mx-auto w-full space-y-8">
                {/* KPI Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 p-6 rounded-2xl relative overflow-hidden group shadow-sm">
                        <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                            <span className="material-symbols-outlined text-6xl text-primary">payments</span>
                        </div>
                        <p className="text-slate-400 text-sm font-medium">Total Deuda a Proveedores</p>
                        <h3 className="text-2xl font-bold text-slate-900 dark:text-white mt-1">
                            $ {stats.totalDeuda.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                        </h3>
                        <div className="flex items-center gap-1 mt-3 text-red-500 text-sm font-bold">
                            <span className="material-symbols-outlined text-sm text-red-500" style={{ fontVariationSettings: "'FILL' 1" }}>trending_up</span>
                            <span>Actualizado ahora</span>
                        </div>
                    </div>

                    <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 p-6 rounded-2xl relative overflow-hidden group shadow-sm">
                        <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                            <span className="material-symbols-outlined text-6xl text-amber-500">pending_actions</span>
                        </div>
                        <p className="text-slate-400 text-sm font-medium">Proveedores Activos</p>
                        <h3 className="text-2xl font-bold text-slate-900 dark:text-white mt-1">{stats.proveedoresActivos}</h3>
                        <div className="flex items-center gap-1 mt-3 text-emerald-500 text-sm font-bold">
                            <span className="material-symbols-outlined text-sm text-emerald-500" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
                            <span>Operativos</span>
                        </div>
                    </div>

                    <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 p-6 rounded-2xl relative overflow-hidden group shadow-sm">
                        <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                            <span className="material-symbols-outlined text-6xl text-slate-400">inventory</span>
                        </div>
                        <p className="text-slate-400 text-sm font-medium">Compras este mes</p>
                        <h3 className="text-2xl font-bold text-slate-900 dark:text-white mt-1">0</h3>
                        <div className="flex items-center gap-1 mt-3 text-primary text-sm font-bold">
                            <span className="material-symbols-outlined text-sm">info</span>
                            <span>Sin movimientos registrados</span>
                        </div>
                    </div>
                </div>

                {/* Filters & Search */}
                <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 p-4 rounded-2xl flex flex-wrap items-center gap-4 shadow-sm">
                    <div className="flex-1 min-w-[300px] relative group">
                        <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-primary transition-colors">search</span>
                        <input
                            className="w-full bg-slate-50 dark:bg-zinc-800 border-none rounded-xl pl-10 pr-4 py-2.5 text-slate-900 dark:text-white focus:ring-2 focus:ring-primary/50 transition-all"
                            placeholder="Buscar por Razón Social o CUIT..."
                            type="text"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                    <div className="flex items-center gap-3">
                        <select
                            value={categoryFilter}
                            onChange={(e) => setCategoryFilter(e.target.value)}
                            className="bg-slate-50 dark:bg-zinc-800 border-none rounded-xl px-4 py-2.5 text-slate-600 dark:text-slate-300 text-sm focus:ring-2 focus:ring-primary/50 cursor-pointer"
                        >
                            <option value="">Rubro (Todos)</option>
                            <option value="carnes">Carnes</option>
                            <option value="aves">Aves</option>
                            <option value="lacteos">Lácteos</option>
                            <option value="fiambres">Fiambres</option>
                            <option value="limpieza">Limpieza</option>
                            <option value="varios">Varios</option>
                        </select>
                        <select
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value)}
                            className="bg-slate-50 dark:bg-zinc-800 border-none rounded-xl px-4 py-2.5 text-slate-600 dark:text-slate-300 text-sm focus:ring-2 focus:ring-primary/50 cursor-pointer"
                        >
                            <option value="">Estado (Todos)</option>
                            <option value="active">Activos</option>
                            <option value="debt">Con Deuda</option>
                            <option value="no-debt">Al día</option>
                        </select>
                    </div>
                </div>

                {/* Suppliers Table */}
                <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl overflow-hidden shadow-sm transition-all duration-300">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-slate-50 dark:bg-zinc-800/50 border-b border-slate-200 dark:border-zinc-800">
                                    <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Razón Social</th>
                                    <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">CUIT</th>
                                    <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Rubro</th>
                                    <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Teléfono</th>
                                    <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400 text-right">Saldo Actual</th>
                                    <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400 text-center">Acciones</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
                                {loading ? (
                                    <tr>
                                        <td colSpan={6} className="px-6 py-12 text-center">
                                            <div className="flex flex-col items-center gap-3">
                                                <div className="size-8 border-3 border-primary/20 border-t-primary rounded-full animate-spin"></div>
                                                <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Cargando proveedores...</span>
                                            </div>
                                        </td>
                                    </tr>
                                ) : proveedores.length === 0 ? (
                                    <tr>
                                        <td colSpan={6} className="px-6 py-12 text-center text-slate-400">
                                            <span className="material-symbols-outlined text-4xl mb-2 block opacity-20">local_shipping</span>
                                            <p className="font-bold text-sm">No se encontraron proveedores</p>
                                        </td>
                                    </tr>
                                ) : (
                                    proveedores.map((p) => (
                                        <tr key={p.id} className="group hover:bg-slate-50 dark:hover:bg-zinc-800/40 transition-colors">
                                            <td className="px-6 py-4">
                                                <div className="font-bold text-slate-900 dark:text-white capitalize">{p.razon_social}</div>
                                                <div className="text-[10px] font-black font-bold text-slate-400 uppercase tracking-tight">{p.nombre_fantasia || 'Sin nombre fantasía'}</div>
                                            </td>
                                            <td className="px-6 py-4 text-sm font-medium text-slate-500">{p.cuit || 'N/A'}</td>
                                            <td className="px-6 py-4">
                                                <span className="px-2 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest bg-slate-100 dark:bg-zinc-800 text-slate-500 border border-slate-200 dark:border-zinc-700">
                                                    {p.categoria_proveedor || 'Sin rubro'}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-sm text-slate-500 font-medium">{p.telefono || 'N/A'}</td>
                                            <td className="px-6 py-4 text-right">
                                                <span className={`font-black text-sm ${p.saldo_actual > 0 ? 'text-red-500' : 'text-emerald-500'}`}>
                                                    $ {Math.abs(p.saldo_actual).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex justify-center gap-1">
                                                    <button
                                                        onClick={() => handleEdit(p)}
                                                        className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-primary hover:bg-primary/10 transition-all active:scale-90"
                                                    >
                                                        <span className="material-symbols-outlined text-lg">edit</span>
                                                    </button>
                                                    <Link
                                                        to={`/proveedores/${p.id}`}
                                                        className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-amber-500 hover:bg-amber-500/10 transition-all active:scale-90"
                                                        title="Ver detalle"
                                                    >
                                                        <span className="material-symbols-outlined text-lg focus:fill-1">visibility</span>
                                                    </Link>
                                                    <button
                                                        onClick={() => handlePago(p)}
                                                        className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-emerald-500 hover:bg-emerald-500/10 transition-all active:scale-90"
                                                        title="Registrar Pago"
                                                    >
                                                        <span className="material-symbols-outlined text-lg">payments</span>
                                                    </button>
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

            {isModalOpen && (
                <ProveedorModal
                    isOpen={isModalOpen}
                    onClose={() => setIsModalOpen(false)}
                    onSuccess={() => {
                        setIsModalOpen(false);
                        fetchData();
                    }}
                    proveedor={editingProveedor}
                />
            )}
            {showPagoModal && (
                <PagoProveedorModal
                    isOpen={showPagoModal}
                    onClose={() => setShowPagoModal(false)}
                    onSuccess={fetchData}
                    proveedor={pagoProveedor}
                />
            )}
        </Layout>
    );
};

export default Proveedores;
