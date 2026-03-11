import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

interface ProveedorModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
    proveedor?: any;
}

const ProveedorModal: React.FC<ProveedorModalProps> = ({ isOpen, onClose, onSuccess, proveedor }) => {
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState({
        razon_social: '',
        nombre_fantasia: '',
        cuit: '',
        telefono: '',
        email: '',
        direccion: '',
        localidad: '',
        contacto_nombre: '',
        contacto_telefono: '',
        categoria_proveedor: 'varios',
        condicion_pago: 'contado',
        limite_credito: 0,
        notas: '',
        activo: true
    });

    useEffect(() => {
        if (proveedor) {
            setFormData({
                razon_social: proveedor.razon_social || '',
                nombre_fantasia: proveedor.nombre_fantasia || '',
                cuit: proveedor.cuit || '',
                telefono: proveedor.telefono || '',
                email: proveedor.email || '',
                direccion: proveedor.direccion || '',
                localidad: proveedor.localidad || '',
                contacto_nombre: proveedor.contacto_nombre || '',
                contacto_telefono: proveedor.contacto_telefono || '',
                categoria_proveedor: proveedor.categoria_proveedor || 'varios',
                condicion_pago: proveedor.condicion_pago || 'contado',
                limite_credito: proveedor.limite_credito || 0,
                notas: proveedor.notas || '',
                activo: proveedor.activo ?? true
            });
        } else {
            setFormData({
                razon_social: '',
                nombre_fantasia: '',
                cuit: '',
                telefono: '',
                email: '',
                direccion: '',
                localidad: '',
                contacto_nombre: '',
                contacto_telefono: '',
                categoria_proveedor: 'varios',
                condicion_pago: 'contado',
                limite_credito: 0,
                notas: '',
                activo: true
            });
        }
    }, [proveedor, isOpen]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        try {
            if (proveedor) {
                const { error } = await supabase
                    .from('proveedores')
                    .update(formData)
                    .eq('id', proveedor.id);
                if (error) throw error;
            } else {
                const { error } = await supabase
                    .from('proveedores')
                    .insert([formData]);
                if (error) throw error;
            }
            onSuccess();
        } catch (error) {
            console.error('Error saving supplier:', error);
            alert('Error al guardar el proveedor');
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white dark:bg-zinc-900 w-full max-w-2xl rounded-3xl shadow-2xl border border-slate-200 dark:border-zinc-800 overflow-hidden scale-in zoom-in-95 duration-200">
                <div className="p-6 border-b border-slate-100 dark:border-zinc-800 flex justify-between items-center bg-slate-50/50 dark:bg-zinc-800/20">
                    <div>
                        <h2 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tight">
                            {proveedor ? 'Editar Proveedor' : 'Nuevo Proveedor'}
                        </h2>
                        <p className="text-[10px] font-black uppercase text-primary tracking-widest mt-1">Información de la entidad</p>
                    </div>
                    <button
                        onClick={onClose}
                        className="w-10 h-10 rounded-full flex items-center justify-center text-slate-400 hover:bg-slate-100 dark:hover:bg-zinc-800 transition-all active:scale-90"
                    >
                        <span className="material-symbols-outlined">close</span>
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 overflow-y-auto max-h-[75vh]">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Razón Social */}
                        <div className="flex flex-col gap-1.5 md:col-span-2">
                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Razón Social *</label>
                            <input
                                required
                                value={formData.razon_social}
                                onChange={(e) => setFormData({ ...formData, razon_social: e.target.value })}
                                className="bg-slate-50 dark:bg-zinc-800 border-none rounded-2xl px-4 py-3 text-sm focus:ring-2 focus:ring-primary/50 transition-all"
                                placeholder="Ej: Frigorífico Los Pampas S.A."
                            />
                        </div>

                        {/* Nombre Fantasía */}
                        <div className="flex flex-col gap-1.5">
                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Nombre Fantasía</label>
                            <input
                                value={formData.nombre_fantasia}
                                onChange={(e) => setFormData({ ...formData, nombre_fantasia: e.target.value })}
                                className="bg-slate-50 dark:bg-zinc-800 border-none rounded-2xl px-4 py-3 text-sm focus:ring-2 focus:ring-primary/50 transition-all"
                                placeholder="Nombre comercial"
                            />
                        </div>

                        {/* CUIT */}
                        <div className="flex flex-col gap-1.5">
                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">CUIT</label>
                            <input
                                value={formData.cuit}
                                onChange={(e) => setFormData({ ...formData, cuit: e.target.value })}
                                className="bg-slate-50 dark:bg-zinc-800 border-none rounded-2xl px-4 py-3 text-sm focus:ring-2 focus:ring-primary/50 transition-all"
                                placeholder="30-XXXXXXXX-X"
                            />
                        </div>

                        {/* Email */}
                        <div className="flex flex-col gap-1.5">
                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Email</label>
                            <input
                                type="email"
                                value={formData.email}
                                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                className="bg-slate-50 dark:bg-zinc-800 border-none rounded-2xl px-4 py-3 text-sm focus:ring-2 focus:ring-primary/50 transition-all"
                                placeholder="contacto@proveedor.com"
                            />
                        </div>

                        {/* Teléfono */}
                        <div className="flex flex-col gap-1.5">
                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Teléfono Principal</label>
                            <input
                                value={formData.telefono}
                                onChange={(e) => setFormData({ ...formData, telefono: e.target.value })}
                                className="bg-slate-50 dark:bg-zinc-800 border-none rounded-2xl px-4 py-3 text-sm focus:ring-2 focus:ring-primary/50 transition-all"
                                placeholder="+54 261 XXXXXXX"
                            />
                        </div>

                        <div className="md:col-span-2 border-t border-slate-100 dark:border-zinc-800 my-2 pt-4">
                            <p className="text-[10px] font-black uppercase text-primary tracking-widest mb-4">Ubicación y Contacto</p>
                        </div>

                        {/* Dirección */}
                        <div className="flex flex-col gap-1.5">
                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Dirección</label>
                            <input
                                value={formData.direccion}
                                onChange={(e) => setFormData({ ...formData, direccion: e.target.value })}
                                className="bg-slate-50 dark:bg-zinc-800 border-none rounded-2xl px-4 py-3 text-sm focus:ring-2 focus:ring-primary/50 transition-all"
                                placeholder="Calle y Nro"
                            />
                        </div>

                        {/* Localidad */}
                        <div className="flex flex-col gap-1.5">
                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Localidad</label>
                            <input
                                value={formData.localidad}
                                onChange={(e) => setFormData({ ...formData, localidad: e.target.value })}
                                className="bg-slate-50 dark:bg-zinc-800 border-none rounded-2xl px-4 py-3 text-sm focus:ring-2 focus:ring-primary/50 transition-all"
                                placeholder="Ciudad, Provincia"
                            />
                        </div>

                        {/* Contacto Nombre */}
                        <div className="flex flex-col gap-1.5">
                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Nombre Contacto</label>
                            <input
                                value={formData.contacto_nombre}
                                onChange={(e) => setFormData({ ...formData, contacto_nombre: e.target.value })}
                                className="bg-slate-50 dark:bg-zinc-800 border-none rounded-2xl px-4 py-3 text-sm focus:ring-2 focus:ring-primary/50 transition-all"
                                placeholder="Persona de contacto"
                            />
                        </div>

                        {/* Contacto Teléfono */}
                        <div className="flex flex-col gap-1.5">
                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Teléfono Contacto</label>
                            <input
                                value={formData.contacto_telefono}
                                onChange={(e) => setFormData({ ...formData, contacto_telefono: e.target.value })}
                                className="bg-slate-50 dark:bg-zinc-800 border-none rounded-2xl px-4 py-3 text-sm focus:ring-2 focus:ring-primary/50 transition-all"
                                placeholder="Celular"
                            />
                        </div>

                        <div className="md:col-span-2 border-t border-slate-100 dark:border-zinc-800 my-2 pt-4">
                            <p className="text-[10px] font-black uppercase text-primary tracking-widest mb-4">Configuración Comercial</p>
                        </div>

                        {/* Rubro */}
                        <div className="flex flex-col gap-1.5">
                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Rubro / Categoría</label>
                            <select
                                value={formData.categoria_proveedor}
                                onChange={(e) => setFormData({ ...formData, categoria_proveedor: e.target.value })}
                                className="bg-slate-50 dark:bg-zinc-800 border-none rounded-2xl px-4 py-3 text-sm focus:ring-2 focus:ring-primary/50 cursor-pointer transition-all"
                            >
                                <option value="carnes">Carnes</option>
                                <option value="aves">Aves</option>
                                <option value="lacteos">Lácteos</option>
                                <option value="fiambres">Fiambres</option>
                                <option value="limpieza">Limpieza</option>
                                <option value="varios">Varios</option>
                            </select>
                        </div>

                        {/* Condición Pago */}
                        <div className="flex flex-col gap-1.5">
                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Condición de Pago</label>
                            <select
                                value={formData.condicion_pago}
                                onChange={(e) => setFormData({ ...formData, condicion_pago: e.target.value })}
                                className="bg-slate-50 dark:bg-zinc-800 border-none rounded-2xl px-4 py-3 text-sm focus:ring-2 focus:ring-primary/50 cursor-pointer transition-all"
                            >
                                <option value="contado">Contado</option>
                                <option value="15_dias">15 días</option>
                                <option value="30_dias">30 días</option>
                                <option value="60_dias">60 días</option>
                            </select>
                        </div>

                        {/* Límite Crédito */}
                        <div className="flex flex-col gap-1.5">
                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Límite de Crédito</label>
                            <div className="relative group">
                                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-sm">$</span>
                                <input
                                    type="number"
                                    value={formData.limite_credito}
                                    onChange={(e) => setFormData({ ...formData, limite_credito: Number(e.target.value) })}
                                    className="w-full bg-slate-50 dark:bg-zinc-800 border-none rounded-2xl pl-8 pr-4 py-3 text-sm focus:ring-2 focus:ring-primary/50 transition-all font-bold"
                                />
                            </div>
                        </div>

                        {/* Activo (Switch) */}
                        <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-zinc-800/50 rounded-2xl">
                            <div className="flex flex-col">
                                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Estado del Proveedor</span>
                                <span className="text-xs text-slate-500 font-medium ml-1">Permitir compras y pagos</span>
                            </div>
                            <label className="relative inline-flex items-center cursor-pointer">
                                <input
                                    type="checkbox"
                                    className="sr-only peer"
                                    checked={formData.activo}
                                    onChange={(e) => setFormData({ ...formData, activo: e.target.checked })}
                                />
                                <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-zinc-700 peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                            </label>
                        </div>

                        {/* Notas */}
                        <div className="flex flex-col gap-1.5 md:col-span-2">
                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Notas Internas</label>
                            <textarea
                                rows={3}
                                value={formData.notas}
                                onChange={(e) => setFormData({ ...formData, notas: e.target.value })}
                                className="bg-slate-50 dark:bg-zinc-800 border-none rounded-2xl px-4 py-3 text-sm focus:ring-2 focus:ring-primary/50 transition-all resize-none"
                                placeholder="Observaciones sobre entregas, precios, etc."
                            ></textarea>
                        </div>
                    </div>

                    <div className="mt-8 flex gap-3">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 px-6 py-4 rounded-2xl bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-slate-300 font-black uppercase tracking-widest text-[10px] hover:bg-slate-200 dark:hover:bg-zinc-700 transition-all active:scale-95"
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            disabled={loading}
                            className="flex-[2] px-6 py-4 rounded-2xl bg-primary text-white font-black uppercase tracking-widest text-[10px] shadow-lg shadow-primary/20 hover:bg-primary/90 transition-all active:scale-95 disabled:opacity-50"
                        >
                            {loading ? 'Guardando...' : (proveedor ? 'Actualizar Proveedor' : 'Crear Proveedor')}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default ProveedorModal;
