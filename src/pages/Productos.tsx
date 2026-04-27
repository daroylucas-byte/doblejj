import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import MainHeader from '../components/MainHeader';
import ProductoModal from '../components/ProductoModal';
import { supabase } from '../lib/supabase';

interface Categoria {
    id: string;
    nombre: string;
}

interface Producto {
    id: string;
    codigo: string;
    nombre: string;
    descripcion: string;
    categoria_id: string | null;
    categorias?: Categoria; // Joined data
    unidad_medida: 'kg' | 'unidad' | 'caja' | 'pack';
    precio_costo: number;
    precio_minorista: number;
    precio_mayorista: number;
    precio_revendedor: number;
    stock_actual: number;
    stock_minimo: number;
    activo: boolean;
    imagen_url: string;
}

const Productos: React.FC = () => {
    const navigate = useNavigate();
    const [productos, setProductos] = useState<Producto[]>([]);
    const [categorias, setCategorias] = useState<Categoria[]>([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedProducto, setSelectedProducto] = useState<Producto | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedCategory, setSelectedCategory] = useState<string>('Todas');

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            // Fetch categories
            const { data: catData } = await supabase.from('categorias').select('*').order('nombre');
            setCategorias(catData || []);

            // Fetch products
            let query = supabase
                .from('productos')
                .select('*, categorias(id, nombre)')
                .order('nombre', { ascending: true });

            if (searchTerm) {
                query = query.or(`nombre.ilike.%${searchTerm}%,codigo.ilike.%${searchTerm}%`);
            }

            if (selectedCategory !== 'Todas') {
                query = query.eq('categoria_id', selectedCategory);
            }

            const { data, error } = await query;
            if (error) throw error;
            setProductos(data || []);
        } catch (error) {
            console.error('Error fetching data:', error);
        } finally {
            setLoading(false);
        }
    }, [searchTerm, selectedCategory]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const handleEdit = (producto: Producto) => {
        setSelectedProducto(producto);
        setIsModalOpen(true);
    };

    const handleNew = () => {
        setSelectedProducto(null);
        setIsModalOpen(true);
    };

    return (
        <Layout>
            <MainHeader title="Catálogo de Productos">
                <div className="flex flex-wrap gap-2 mt-4 sm:mt-0 justify-end">
                    <button
                        className="flex items-center justify-center gap-2 rounded-lg h-10 px-2 sm:px-4 bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-slate-200 text-[10px] sm:text-xs font-bold uppercase tracking-widest hover:bg-slate-200 transition-all active:scale-95 border border-slate-200 dark:border-zinc-700 whitespace-nowrap"
                    >
                        <span className="material-symbols-outlined text-sm">inventory_2</span>
                        <span className="hidden sm:inline">Ajustar Stock</span>
                        <span className="sm:hidden">Stock</span>
                    </button>
                    <button
                        onClick={handleNew}
                        className="flex items-center justify-center gap-2 rounded-lg h-10 px-2 sm:px-4 bg-primary text-white text-[10px] sm:text-sm font-bold shadow-md shadow-primary/20 hover:bg-primary/90 transition-all active:scale-95 whitespace-nowrap"
                    >
                        <span className="material-symbols-outlined text-sm">add_box</span>
                        <span className="hidden sm:inline">Nuevo Producto</span>
                        <span className="sm:hidden">Nuevo</span>
                    </button>
                </div>
            </MainHeader>

            <div className="p-4 sm:p-8 space-y-4 sm:space-y-6 max-w-[1500px] mx-auto w-full">

                {/* Search and Quick Filters */}
                <div className="flex flex-col lg:flex-row gap-4 lg:items-center bg-white dark:bg-zinc-900 p-4 rounded-xl border border-slate-200 dark:border-zinc-800 shadow-sm transition-all duration-300">
                    <div className="relative flex-1">
                        <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">search</span>
                        <input
                            className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-zinc-800 border-none rounded-lg text-sm focus:ring-2 focus:ring-primary/50 transition-all"
                            placeholder="Buscar por código, nombre o categoría..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>

                    <div className="flex flex-wrap gap-2 justify-center">
                        <button
                            onClick={() => setSelectedCategory('Todas')}
                            className={`h-9 px-4 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${selectedCategory === 'Todas' ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'bg-slate-100 dark:bg-zinc-800 text-slate-400 hover:text-slate-600'}`}
                        >
                            Todas
                        </button>
                        {categorias.map(cat => (
                            <button
                                key={cat.id}
                                onClick={() => setSelectedCategory(cat.id)}
                                className={`h-9 px-4 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${selectedCategory === cat.id ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'bg-slate-100 dark:bg-zinc-800 text-slate-400 hover:text-slate-600'}`}
                            >
                                {cat.nombre}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Products Table */}
                <div className="bg-white dark:bg-zinc-900 rounded-xl border border-slate-200 dark:border-zinc-800 shadow-sm overflow-hidden transition-all duration-300">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-slate-50 dark:bg-zinc-800/50 border-b border-slate-200 dark:border-zinc-800">
                                    <th className="px-3 sm:px-6 py-4 text-[10px] font-black uppercase text-slate-400 tracking-widest hidden sm:table-cell">Código</th>
                                    <th className="px-3 sm:px-6 py-4 text-[10px] font-black uppercase text-slate-400 tracking-widest">Producto</th>
                                    <th className="px-3 sm:px-6 py-4 text-[10px] font-black uppercase text-slate-400 tracking-widest hidden md:table-cell">Categoría / Unidad</th>
                                    <th className="px-3 sm:px-6 py-4 text-[10px] font-black uppercase text-slate-400 tracking-widest text-center">Stock</th>
                                    <th className="px-3 sm:px-6 py-4 text-[10px] font-black uppercase text-slate-400 tracking-widest hidden sm:table-cell">Estado</th>
                                    <th className="px-3 sm:px-6 py-4 text-[10px] font-black uppercase text-slate-400 tracking-widest text-right whitespace-nowrap hidden lg:table-cell">Precios (Min/May/Rev)</th>
                                    <th className="px-3 sm:px-6 py-4 text-[10px] font-black uppercase text-slate-400 tracking-widest text-center">Acciones</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
                                {loading ? (
                                    <tr>
                                        <td colSpan={7} className="px-6 py-12 text-center">
                                            <div className="flex flex-col items-center gap-3">
                                                <div className="size-8 border-3 border-primary/20 border-t-primary rounded-full animate-spin"></div>
                                                <span className="text-xs font-bold uppercase text-slate-400 tracking-widest">Sincronizando Catálogo...</span>
                                            </div>
                                        </td>
                                    </tr>
                                ) : productos.length === 0 ? (
                                    <tr>
                                        <td colSpan={7} className="px-6 py-12 text-center text-slate-400">
                                            <span className="material-symbols-outlined text-4xl mb-2 block opacity-20">inventory_2</span>
                                            <p className="font-bold text-sm">No se encontraron productos</p>
                                        </td>
                                    </tr>
                                ) : (
                                    productos.map((prod) => (
                                        <tr
                                            key={prod.id}
                                            className={`group hover:bg-slate-50 dark:hover:bg-zinc-800/40 transition-colors ${!prod.activo ? 'opacity-50 grayscale' : ''}`}
                                        >
                                            <td className="px-3 sm:px-6 py-4 font-mono text-xs font-black text-primary/70 hidden sm:table-cell">{prod.codigo || 'N/A'}</td>
                                            <td className="px-3 sm:px-6 py-4">
                                                <div className="flex flex-col">
                                                    <span className="font-black text-sm text-slate-900 dark:text-slate-100 transition-colors line-clamp-2">{prod.nombre}</span>
                                                    {prod.descripcion && (
                                                        <span className="text-[10px] text-slate-400 line-clamp-1">{prod.descripcion}</span>
                                                    )}
                                                    <div className="sm:hidden mt-0.5 flex items-center gap-2">
                                                        <span className="text-[10px] font-bold text-primary">${prod.precio_minorista.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
                                                        <span className={`text-[9px] font-black uppercase ${prod.stock_actual <= prod.stock_minimo ? 'text-red-500' : 'text-green-500'}`}>
                                                            {prod.stock_actual <= prod.stock_minimo ? 'BAJO' : 'OK'}
                                                        </span>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-3 sm:px-6 py-4 hidden md:table-cell">
                                                <div className="flex flex-col gap-1">
                                                    <span className="text-[10px] font-bold text-slate-500 uppercase">{prod.categorias?.nombre || 'General'}</span>
                                                    <span className="text-[9px] font-black text-slate-400 uppercase bg-slate-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded w-fit">{prod.unidad_medida}</span>
                                                </div>
                                            </td>
                                            <td className="px-3 sm:px-6 py-4 text-center">
                                                <span className={`text-base font-black ${prod.stock_actual <= prod.stock_minimo ? 'text-red-500 animate-pulse' : 'text-slate-900 dark:text-slate-100'}`}>
                                                    {prod.stock_actual}
                                                </span>
                                            </td>
                                            <td className="px-3 sm:px-6 py-4 hidden sm:table-cell">
                                                <div className="flex items-center gap-2">
                                                    <div className={`size-2 rounded-full ${prod.stock_actual <= prod.stock_minimo ? 'bg-red-500' : 'bg-green-500'}`}></div>
                                                    <span className={`text-[10px] font-black uppercase tracking-wider ${prod.stock_actual <= prod.stock_minimo ? 'text-red-500' : 'text-green-500'}`}>
                                                        {prod.stock_actual <= prod.stock_minimo ? 'BAJO STOCK' : 'STOCK OK'}
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="px-3 sm:px-6 py-4 text-right hidden lg:table-cell">
                                                <div className="flex flex-col gap-0.5">
                                                    <span className="text-xs font-black text-primary">$ {prod.precio_minorista.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
                                                    <div className="flex justify-end gap-2 text-[10px] font-bold text-slate-400">
                                                        <span>M: {prod.precio_mayorista.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
                                                        <span>R: {prod.precio_revendedor.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-3 sm:px-6 py-4 text-center border-l border-slate-50 dark:border-zinc-800">
                                                <div className="flex items-center justify-center gap-1">
                                                    <button
                                                        onClick={() => navigate(`/stock/historial?id=${prod.id}`)} // fixed quotes
                                                        className="p-2 text-slate-400 hover:text-primary transition-all hover:bg-primary/10 rounded-lg group"
                                                        title="Ver Historial de Stock"
                                                    >
                                                        <span className="material-symbols-outlined group-hover:scale-110 transition-transform text-sm sm:text-base">history</span>
                                                    </button>
                                                    <button
                                                        onClick={() => handleEdit(prod)}
                                                        className="p-2 text-slate-400 hover:text-primary transition-all hover:bg-primary/10 rounded-lg group"
                                                        title="Editar Producto"
                                                    >
                                                        <span className="material-symbols-outlined group-hover:scale-110 transition-transform text-sm sm:text-base">edit</span>
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

            <ProductoModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                onSuccess={fetchData}
                producto={selectedProducto}
            />
        </Layout>
    );
};

export default Productos;
