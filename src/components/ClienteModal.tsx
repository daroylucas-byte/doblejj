import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

interface Cliente {
    id?: string;
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
    notas: string;
    activo: boolean;
}

interface ClienteModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
    cliente?: Cliente | null;
}

const ClienteModal: React.FC<ClienteModalProps> = ({ isOpen, onClose, onSuccess, cliente }) => {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const [formData, setFormData] = useState<Cliente>({
        razon_social: '',
        nombre_fantasia: '',
        cuit: '',
        dni: '',
        tipo: 'minorista',
        telefono: '',
        email: '',
        direccion: '',
        localidad: '',
        limite_credito: 0,
        notas: '',
        activo: true
    });

    useEffect(() => {
        if (cliente) {
            setFormData(cliente);
        } else {
            setFormData({
                razon_social: '',
                nombre_fantasia: '',
                cuit: '',
                dni: '',
                tipo: 'minorista',
                telefono: '',
                email: '',
                direccion: '',
                localidad: '',
                limite_credito: 0,
                notas: '',
                activo: true
            });
        }
    }, [cliente, isOpen]);

    if (!isOpen) return null;

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        const { name, value, type } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: type === 'number' ? parseFloat(value) : value
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
            if (cliente?.id) {
                // Update
                const { error: updateError } = await supabase
                    .from('clientes')
                    .update(formData)
                    .eq('id', cliente.id);
                if (updateError) throw updateError;
            } else {
                // Insert
                const { error: insertError } = await supabase
                    .from('clientes')
                    .insert([formData]);
                if (insertError) throw insertError;
            }

            onSuccess();
            onClose();
        } catch (err: any) {
            setError(err.message || 'Error al guardar el cliente');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            {/* Backdrop */}
            <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300" onClick={onClose}></div>

            {/* Modal Content */}
            <div className="relative w-full max-w-2xl bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-zinc-800 overflow-hidden animate-in zoom-in-95 duration-200">
                <div className="flex items-center justify-between p-6 border-b border-slate-100 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-800/50">
                    <div className="flex items-center gap-3">
                        <div className="size-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                            <span className="material-symbols-outlined">
                                {cliente ? 'edit_note' : 'person_add'}
                            </span>
                        </div>
                        <div>
                            <h3 className="text-xl font-bold">{cliente ? 'Editar Cliente' : 'Nuevo Cliente'}</h3>
                            <p className="text-xs text-slate-500 font-medium">{cliente ? 'Actualice los datos del cliente' : 'Complete la información para dar de alta'}</p>
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

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-h-[60vh] overflow-y-auto px-1 scrollbar-thin scrollbar-thumb-slate-200 dark:scrollbar-thumb-zinc-800">
                        <div className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Razón Social *</label>
                                <input
                                    name="razon_social"
                                    value={formData.razon_social}
                                    onChange={handleChange}
                                    required
                                    className="w-full h-11 px-4 bg-slate-50 dark:bg-zinc-800 border-none rounded-xl text-sm focus:ring-2 focus:ring-primary/50"
                                    placeholder="Nombre de la empresa o persona"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Nombre Fantasía</label>
                                <input
                                    name="nombre_fantasia"
                                    value={formData.nombre_fantasia}
                                    onChange={handleChange}
                                    className="w-full h-11 px-4 bg-slate-50 dark:bg-zinc-800 border-none rounded-xl text-sm focus:ring-2 focus:ring-primary/50"
                                    placeholder="Nombre comercial"
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-2">CUIT</label>
                                    <input
                                        name="cuit"
                                        value={formData.cuit}
                                        onChange={handleChange}
                                        className="w-full h-11 px-4 bg-slate-50 dark:bg-zinc-800 border-none rounded-xl text-sm focus:ring-2 focus:ring-primary/50"
                                        placeholder="00-00000000-0"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-2">DNI</label>
                                    <input
                                        name="dni"
                                        value={formData.dni}
                                        onChange={handleChange}
                                        className="w-full h-11 px-4 bg-slate-50 dark:bg-zinc-800 border-none rounded-xl text-sm focus:ring-2 focus:ring-primary/50"
                                        placeholder="Solo si no tiene CUIT"
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Tipo de Cliente</label>
                                <select
                                    name="tipo"
                                    value={formData.tipo}
                                    onChange={handleChange}
                                    className="w-full h-11 px-4 bg-slate-50 dark:bg-zinc-800 border-none rounded-xl text-sm focus:ring-2 focus:ring-primary/50"
                                >
                                    <option value="minorista">Minorista</option>
                                    <option value="mayorista">Mayorista</option>
                                    <option value="revendedor">Revendedor</option>
                                </select>
                            </div>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Teléfono</label>
                                <input
                                    name="telefono"
                                    value={formData.telefono}
                                    onChange={handleChange}
                                    className="w-full h-11 px-4 bg-slate-50 dark:bg-zinc-800 border-none rounded-xl text-sm focus:ring-2 focus:ring-primary/50"
                                    placeholder="Ej: 11 1234-5678"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Email</label>
                                <input
                                    name="email"
                                    type="email"
                                    value={formData.email}
                                    onChange={handleChange}
                                    className="w-full h-11 px-4 bg-slate-50 dark:bg-zinc-800 border-none rounded-xl text-sm focus:ring-2 focus:ring-primary/50"
                                    placeholder="correo@ejemplo.com"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Dirección</label>
                                <input
                                    name="direccion"
                                    value={formData.direccion}
                                    onChange={handleChange}
                                    className="w-full h-11 px-4 bg-slate-50 dark:bg-zinc-800 border-none rounded-xl text-sm focus:ring-2 focus:ring-primary/50"
                                    placeholder="Calle, altura, piso/depto"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Límite de Crédito ($)</label>
                                <input
                                    name="limite_credito"
                                    type="number"
                                    value={formData.limite_credito}
                                    onChange={handleChange}
                                    className="w-full h-11 px-4 bg-slate-50 dark:bg-zinc-800 border-none rounded-xl text-sm focus:ring-2 focus:ring-primary/50"
                                />
                            </div>
                        </div>

                        <div className="md:col-span-2 space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Notas / Observaciones</label>
                                <textarea
                                    name="notas"
                                    value={formData.notas}
                                    onChange={handleChange}
                                    className="w-full p-4 bg-slate-50 dark:bg-zinc-800 border-none rounded-xl text-sm focus:ring-2 focus:ring-primary/50 min-h-[100px]"
                                    placeholder="Cualquier información adicional relevante..."
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
                                    <p className="text-sm font-bold">{formData.activo ? 'Cliente Activo' : 'Cliente Inactivo'}</p>
                                    <p className="text-[10px] text-slate-500 uppercase font-black">Control de habilitación</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="mt-8 flex gap-3">
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
                                    <span className="material-symbols-outlined">{cliente ? 'save' : 'person_add'}</span>
                                    <span>{cliente ? 'Guardar Cambios' : 'Registrar Cliente'}</span>
                                </>
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default ClienteModal;
