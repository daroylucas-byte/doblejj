import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import Layout from '../components/Layout';
import MainHeader from '../components/MainHeader';
import ClienteModal from '../components/ClienteModal';
import CobroModal from '../components/CobroModal';
import { supabase } from '../lib/supabase';

interface Cliente {
    id: string;
    razon_social: string;
    nombre_fantasia: string;
    cuit: string;
    dni: string;
    tipo: 'minorista' | 'mayorista' | 'revendedor';
    telefono: string;
    email: string;
    direccion: string;
    localidad: string;
    limite_credito: number;
    saldo_actual: number;
    activo: boolean;
    notas: string;
    created_at: string;
}

const Clientes: React.FC = () => {
    const [clientes, setClientes] = useState<Cliente[]>([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isCobroModalOpen, setIsCobroModalOpen] = useState(false);
    const [selectedCliente, setSelectedCliente] = useState<Cliente | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterTipo, setFilterTipo] = useState('Todos');

    const fetchClientes = useCallback(async () => {
        setLoading(true);
        try {
            let query = supabase.from('clientes').select('*').order('razon_social', { ascending: true });

            if (searchTerm) {
                query = query.or(`razon_social.ilike.%${searchTerm}%,cuit.ilike.%${searchTerm}%,nombre_fantasia.ilike.%${searchTerm}%`);
            }

            if (filterTipo !== 'Todos') {
                query = query.eq('tipo', filterTipo.toLowerCase());
            }

            const { data, error } = await query;
            if (error) throw error;
            setClientes(data || []);
        } catch (error) {
            console.error('Error fetching clientes:', error);
        } finally {
            setLoading(false);
        }
    }, [searchTerm, filterTipo]);

    useEffect(() => {
        fetchClientes();
    }, [fetchClientes]);

    const handleEdit = (cliente: Cliente) => {
        setSelectedCliente(cliente);
        setIsModalOpen(true);
    };

    const handleNew = () => {
        setSelectedCliente(null);
        setIsModalOpen(true);
    };

    const handleCobro = (cliente: Cliente) => {
        setSelectedCliente(cliente);
        setIsCobroModalOpen(true);
    };

    return (
        <Layout>
            <MainHeader title="Gestión de Clientes">
                <button
                    onClick={handleNew}
                    className="flex items-center justify-center gap-2 rounded-lg h-10 px-4 bg-primary text-white text-sm font-bold shadow-md hover:bg-primary/90 transition-all active:scale-95"
                >
                    <span className="material-symbols-outlined text-sm">person_add</span>
                    <span>Nuevo Cliente</span>
                </button>
            </MainHeader>

            <div className="p-8 space-y-8 max-w-[1400px] mx-auto w-full">
                {/* Filters Section */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end bg-white dark:bg-zinc-900 p-6 rounded-xl border border-slate-200 dark:border-zinc-800 shadow-sm transition-all duration-300">
                    <div className="md:col-span-2 space-y-2">
                        <label className="text-xs font-bold uppercase text-slate-500 tracking-wider">Búsqueda Rápida</label>
                        <div className="relative group">
                            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-primary transition-colors">search</span>
                            <input
                                className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-zinc-800 border-none rounded-lg text-sm focus:ring-2 focus:ring-primary/50 transition-all"
                                placeholder="Razón Social, Fantasía o CUIT..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                    </div>
                    <div className="space-y-2">
                        <label className="text-xs font-bold uppercase text-slate-500 tracking-wider">Tipo de Cliente</label>
                        <select
                            className="w-full h-10 rounded-lg bg-slate-50 dark:bg-zinc-800 border-none text-sm focus:ring-2 focus:ring-primary/50 text-slate-700 dark:text-slate-200 transition-all cursor-pointer"
                            value={filterTipo}
                            onChange={(e) => setFilterTipo(e.target.value)}
                        >
                            <option>Todos</option>
                            <option>Minorista</option>
                            <option>Mayorista</option>
                            <option>Revendedor</option>
                        </select>
                    </div>
                    <div className="flex gap-2">
                        <button
                            onClick={() => { setSearchTerm(''); setFilterTipo('Todos'); }}
                            className="flex-1 h-10 rounded-lg bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-slate-200 font-bold text-xs uppercase tracking-widest transition-all hover:bg-slate-200 active:scale-95"
                        >
                            Limpiar
                        </button>
                    </div>
                </div>

                {/* Clients Table */}
                <div className="bg-white dark:bg-zinc-900 rounded-xl border border-slate-200 dark:border-zinc-800 shadow-sm overflow-hidden transition-all duration-300">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-slate-50 dark:bg-zinc-800/50 border-b border-slate-200 dark:border-zinc-800">
                                    <th className="px-6 py-4 text-xs font-bold uppercase text-slate-500 tracking-wider">Identificación / Razón Social</th>
                                    <th className="px-6 py-4 text-xs font-bold uppercase text-slate-500 tracking-wider">CUIT / DNI</th>
                                    <th className="px-6 py-4 text-xs font-bold uppercase text-slate-500 tracking-wider">Tipo</th>
                                    <th className="px-6 py-4 text-xs font-bold uppercase text-slate-500 tracking-wider">Contacto</th>
                                    <th className="px-6 py-4 text-xs font-bold uppercase text-slate-500 tracking-wider text-right">Saldo Actual</th>
                                    <th className="px-6 py-4 text-xs font-bold uppercase text-slate-500 tracking-wider text-center">Acciones</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
                                {loading ? (
                                    <tr>
                                        <td colSpan={6} className="px-6 py-12 text-center text-slate-400">
                                            <div className="flex flex-col items-center gap-3">
                                                <div className="size-8 border-3 border-primary/20 border-t-primary rounded-full animate-spin"></div>
                                                <span className="text-xs font-bold uppercase tracking-widest">Cargando Clientes...</span>
                                            </div>
                                        </td>
                                    </tr>
                                ) : clientes.length === 0 ? (
                                    <tr>
                                        <td colSpan={6} className="px-6 py-12 text-center text-slate-400">
                                            <span className="material-symbols-outlined text-4xl mb-2 block">person_search</span>
                                            <p className="font-bold text-sm">No se encontraron clientes</p>
                                        </td>
                                    </tr>
                                ) : (
                                    clientes.map((cliente) => (
                                        <tr
                                            key={cliente.id}
                                            className={`group hover:bg-slate-50 dark:hover:bg-zinc-800/30 transition-colors ${!cliente.activo ? 'opacity-60 grayscale' : ''}`}
                                        >
                                            <td className="px-6 py-4">
                                                <Link to={`/clientes/${cliente.id}`} className="flex flex-col group/name">
                                                    <span className="font-bold text-slate-900 dark:text-slate-100 group-hover/name:text-primary transition-colors underline-offset-4 decoration-primary/30 hover:underline">{cliente.razon_social}</span>
                                                    {cliente.nombre_fantasia && (
                                                        <span className="text-xs text-slate-400 italic">"{cliente.nombre_fantasia}"</span>
                                                    )}
                                                </Link>
                                            </td>
                                            <td className="px-6 py-4 text-slate-500 text-sm font-mono">
                                                {cliente.cuit || cliente.dni || '-'}
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${cliente.tipo === 'mayorista'
                                                    ? 'bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-400'
                                                    : cliente.tipo === 'revendedor'
                                                        ? 'bg-purple-100 dark:bg-purple-500/20 text-purple-700 dark:text-purple-400'
                                                        : 'bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-400'
                                                    }`}>
                                                    {cliente.tipo}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex flex-col text-xs text-slate-500 gap-0.5">
                                                    <div className="flex items-center gap-1.5 font-medium">
                                                        <span className="material-symbols-outlined text-sm">call</span>
                                                        {cliente.telefono || '-'}
                                                    </div>
                                                    <div className="flex items-center gap-1.5">
                                                        <span className="material-symbols-outlined text-sm">mail</span>
                                                        {cliente.email || '-'}
                                                    </div>
                                                </div>
                                            </td>
                                            <td className={`px-6 py-4 text-right font-black ${cliente.saldo_actual > 0 ? 'text-rose-600' : cliente.saldo_actual < 0 ? 'text-emerald-600' : 'text-slate-400'}`}>
                                                $ {Math.abs(cliente.saldo_actual).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                                                {cliente.saldo_actual > 0 && <span className="block text-[10px] font-bold uppercase tracking-widest opacity-70">Deuda</span>}
                                                {cliente.saldo_actual < 0 && <span className="block text-[10px] font-bold uppercase tracking-widest opacity-70">A Favor</span>}
                                            </td>
                                            <td className="px-6 py-4 text-center">
                                                <div className="flex items-center justify-center gap-1">
                                                    <Link
                                                        to={`/clientes/${cliente.id}`}
                                                        className="p-2 text-slate-400 hover:text-primary transition-all hover:bg-primary/10 rounded-lg group"
                                                        title="Ver Detalle / Cuenta Corriente"
                                                    >
                                                        <span className="material-symbols-outlined group-hover:scale-110 transition-transform">visibility</span>
                                                    </Link>
                                                    <button
                                                        onClick={(e) => { e.preventDefault(); handleEdit(cliente); }}
                                                        className="p-2 text-slate-400 hover:text-amber-500 transition-all hover:bg-amber-500/10 rounded-lg group"
                                                        title="Editar Datos"
                                                    >
                                                        <span className="material-symbols-outlined group-hover:scale-110 transition-transform">edit_square</span>
                                                    </button>
                                                    <button
                                                        onClick={(e) => { e.preventDefault(); handleCobro(cliente); }}
                                                        className="p-2 text-emerald-500 hover:text-emerald-600 transition-all hover:bg-emerald-500/10 rounded-lg group"
                                                        title="Registrar Cobro"
                                                    >
                                                        <span className="material-symbols-outlined group-hover:scale-125 transition-transform font-bold">payments</span>
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

            <ClienteModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                onSuccess={fetchClientes}
                cliente={selectedCliente}
            />

            <CobroModal
                isOpen={isCobroModalOpen}
                onClose={() => setIsCobroModalOpen(false)}
                onSuccess={fetchClientes}
                cliente={selectedCliente}
            />
        </Layout>
    );
};

export default Clientes;
