import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

interface Categoria {
    id: string;
    nombre: string;
}

interface Producto {
    id?: string;
    codigo: string;
    nombre: string;
    descripcion: string;
    categoria_id: string | null;
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

interface ProductoModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
    producto?: Producto | null;
}

const ProductoModal: React.FC<ProductoModalProps> = ({ isOpen, onClose, onSuccess, producto }) => {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [categorias, setCategorias] = useState<Categoria[]>([]);

    const [formData, setFormData] = useState<Producto>({
        codigo: '',
        nombre: '',
        descripcion: '',
        categoria_id: null,
        unidad_medida: 'unidad',
        precio_costo: 0,
        precio_minorista: 0,
        precio_mayorista: 0,
        precio_revendedor: 0,
        stock_actual: 0,
        stock_minimo: 0,
        activo: true,
        imagen_url: ''
    });

    useEffect(() => {
        fetchCategorias();
    }, []);

    useEffect(() => {
        if (producto) {
            setFormData(producto);
        } else {
            setFormData({
                codigo: '',
                nombre: '',
                descripcion: '',
                categoria_id: null,
                unidad_medida: 'unidad',
                precio_costo: 0,
                precio_minorista: 0,
                precio_mayorista: 0,
                precio_revendedor: 0,
                stock_actual: 0,
                stock_minimo: 0,
                activo: true,
                imagen_url: ''
            });
        }
    }, [producto, isOpen]);

    const fetchCategorias = async () => {
        const { data, error } = await supabase.from('categorias').select('id, nombre').order('nombre');
        if (!error && data) setCategorias(data);
    };

    if (!isOpen) return null;

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        const { name, value, type } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: (type === 'number') ? parseFloat(value) : (value === "null" ? null : value)
        }));
    };

    const handleToggleActive = () => {
        setFormData(prev => ({ ...prev, activo: !prev.activo }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        try {
            if (producto?.id) {
                const { error: updateError } = await supabase
                    .from('productos')
                    .update(formData)
                    .eq('id', producto.id);
                if (updateError) throw updateError;
            } else {
                const { error: insertError } = await supabase
                    .from('productos')
                    .insert([formData]);
                if (insertError) throw insertError;
            }

            onSuccess();
            onClose();
        } catch (err: any) {
            setError(err.message || 'Error al guardar el producto');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300" onClick={onClose}></div>

            <div className="relative w-full max-w-3xl bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-zinc-800 overflow-hidden animate-in zoom-in-95 duration-200">
                {/* Modal Header */}
                <div className="flex items-center justify-between p-6 border-b border-slate-100 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-800/50">
                    <div className="flex items-center gap-3">
                        <div className="size-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                            <span className="material-symbols-outlined">
                                {producto ? 'edit_square' : 'add_box'}
                            </span>
                        </div>
                        <div>
                            <h3 className="text-xl font-bold">{producto ? 'Editar Producto' : 'Nuevo Producto'}</h3>
                            <p className="text-xs text-slate-500 font-medium">Gestión del catálogo maestro</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 text-slate-400 hover:text-red-500 transition-colors rounded-lg hover:bg-red-50 dark:hover:bg-red-900/10">
                        <span className="material-symbols-outlined">close</span>
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6">
                    {error && (
                        <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border-l-4 border-red-500 text-red-700 dark:text-red-400 flex items-center gap-3 rounded-r-lg">
                            <span className="material-symbols-outlined">error</span>
                            <p className="text-sm font-medium">{error}</p>
                        </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-h-[65vh] overflow-y-auto px-1 scrollbar-thin scrollbar-thumb-slate-200 dark:scrollbar-thumb-zinc-800">

                        {/* Column 1: Core Info */}
                        <div className="space-y-4 md:col-span-1">
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Código Barra / SKU</label>
                                <input
                                    name="codigo"
                                    value={formData.codigo}
                                    onChange={handleChange}
                                    className="w-full h-11 px-4 bg-slate-50 dark:bg-zinc-800 border-none rounded-xl text-sm focus:ring-2 focus:ring-primary/50 font-mono"
                                    placeholder="ART-0001"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Nombre del Producto *</label>
                                <input
                                    name="nombre"
                                    value={formData.nombre}
                                    onChange={handleChange}
                                    required
                                    className="w-full h-11 px-4 bg-slate-50 dark:bg-zinc-800 border-none rounded-xl text-sm focus:ring-2 focus:ring-primary/50 font-bold"
                                    placeholder="Ej: Leche Entera 1L"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Categoría</label>
                                <select
                                    name="categoria_id"
                                    value={formData.categoria_id || "null"}
                                    onChange={handleChange}
                                    className="w-full h-11 px-4 bg-slate-50 dark:bg-zinc-800 border-none rounded-xl text-sm focus:ring-2 focus:ring-primary/50"
                                >
                                    <option value="null">Sin Categoría</option>
                                    {categorias.map(cat => (
                                        <option key={cat.id} value={cat.id}>{cat.nombre}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Unidad de Medida</label>
                                <select
                                    name="unidad_medida"
                                    value={formData.unidad_medida}
                                    onChange={handleChange}
                                    className="w-full h-11 px-4 bg-slate-50 dark:bg-zinc-800 border-none rounded-xl text-sm focus:ring-2 focus:ring-primary/50"
                                >
                                    <option value="unidad">Unidad</option>
                                    <option value="kg">Kilogramos</option>
                                    <option value="caja">Caja</option>
                                    <option value="pack">Pack</option>
                                </select>
                            </div>
                        </div>

                        {/* Column 2: Prices & Stock */}
                        <div className="space-y-4 md:col-span-1 border-x border-slate-100 dark:border-zinc-800 px-4">
                            <label className="block text-[10px] font-black text-primary uppercase tracking-widest mb-1">Estructura de Precios</label>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Costo ($)</label>
                                    <input
                                        name="precio_costo"
                                        type="number"
                                        step="0.01"
                                        value={formData.precio_costo}
                                        onChange={handleChange}
                                        className="w-full h-10 px-3 bg-slate-50 dark:bg-zinc-800 border-none rounded-lg text-sm focus:ring-2 focus:ring-primary/50"
                                    />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Minorista ($)</label>
                                    <input
                                        name="precio_minorista"
                                        type="number"
                                        step="0.01"
                                        value={formData.precio_minorista}
                                        onChange={handleChange}
                                        className="w-full h-10 px-3 border-2 border-primary/20 bg-primary/5 dark:bg-primary/5 rounded-lg text-sm focus:ring-2 focus:ring-primary font-bold"
                                    />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Mayorista ($)</label>
                                    <input
                                        name="precio_mayorista"
                                        type="number"
                                        step="0.01"
                                        value={formData.precio_mayorista}
                                        onChange={handleChange}
                                        className="w-full h-10 px-3 bg-slate-50 dark:bg-zinc-800 border-none rounded-lg text-sm focus:ring-2 focus:ring-primary/50"
                                    />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Revendedor ($)</label>
                                    <input
                                        name="precio_revendedor"
                                        type="number"
                                        step="0.01"
                                        value={formData.precio_revendedor}
                                        onChange={handleChange}
                                        className="w-full h-10 px-3 bg-slate-50 dark:bg-zinc-800 border-none rounded-lg text-sm focus:ring-2 focus:ring-primary/50"
                                    />
                                </div>
                            </div>

                            <label className="block text-[10px] font-black text-primary uppercase tracking-widest mt-4 mb-1">Control de Inventario</label>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Stock Actual</label>
                                    <input
                                        name="stock_actual"
                                        type="number"
                                        value={formData.stock_actual}
                                        onChange={handleChange}
                                        className={`w-full h-10 px-3 rounded-lg text-sm focus:ring-2 focus:ring-primary/50 font-bold ${formData.stock_actual <= formData.stock_minimo ? 'bg-red-50 dark:bg-red-900/10 text-red-600' : 'bg-slate-50 dark:bg-zinc-800 text-slate-900 dark:text-white border-none'}`}
                                    />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Stock Mínimo</label>
                                    <input
                                        name="stock_minimo"
                                        type="number"
                                        value={formData.stock_minimo}
                                        onChange={handleChange}
                                        className="w-full h-10 px-3 bg-slate-50 dark:bg-zinc-800 border-none rounded-lg text-sm focus:ring-2 focus:ring-primary/50"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Column 3: Description & Image */}
                        <div className="space-y-4 md:col-span-1">
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Descripción General</label>
                                <textarea
                                    name="descripcion"
                                    value={formData.descripcion}
                                    onChange={handleChange}
                                    className="w-full p-3 bg-slate-50 dark:bg-zinc-800 border-none rounded-xl text-sm focus:ring-2 focus:ring-primary/50 min-h-[100px]"
                                    placeholder="Detalles sobre el producto, peso neto, etc..."
                                />
                            </div>

                            <div className="flex items-center gap-3 p-4 bg-slate-50 dark:bg-zinc-800/50 rounded-xl border border-dashed border-slate-200 dark:border-zinc-700">
                                <button
                                    type="button"
                                    onClick={handleToggleActive}
                                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${formData.activo ? 'bg-green-500' : 'bg-red-500'}`}
                                >
                                    <span className={`inline-block size-4 transform rounded-full bg-white transition-transform ${formData.activo ? 'translate-x-6' : 'translate-x-1'}`} />
                                </button>
                                <div className="flex-1">
                                    <p className="text-sm font-bold">{formData.activo ? 'Producto Habilitado' : 'Producto Pausado'}</p>
                                    <p className="text-[10px] text-slate-500 uppercase font-black">Disponibilidad en ventas</p>
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Imagen (URL)</label>
                                <input
                                    name="imagen_url"
                                    value={formData.imagen_url}
                                    onChange={handleChange}
                                    className="w-full h-11 px-4 bg-slate-50 dark:bg-zinc-800 border-none rounded-xl text-sm focus:ring-2 focus:ring-primary/50"
                                    placeholder="https://ejemplo.com/foto.jpg"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Footer Actions */}
                    <div className="mt-8 flex gap-3 border-t border-slate-100 dark:border-zinc-800 pt-6">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 h-12 rounded-xl bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 font-bold hover:bg-slate-200 transition-colors"
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            disabled={loading}
                            className="flex-[2] h-12 rounded-xl bg-primary text-white font-bold shadow-lg shadow-primary/25 hover:bg-primary/90 transition-all active:scale-[0.98] flex items-center justify-center gap-2"
                        >
                            {loading ? (
                                <span className="size-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                            ) : (
                                <>
                                    <span className="material-symbols-outlined">{producto ? 'save' : 'add_box'}</span>
                                    <span>{producto ? 'Actualizar Producto' : 'Crear Producto Nuevo'}</span>
                                </>
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default ProductoModal;
