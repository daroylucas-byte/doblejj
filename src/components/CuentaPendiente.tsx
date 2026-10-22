import React from 'react';
import { useAuthStore } from '../store/authStore';

// Se muestra a quien se registró y todavía no fue aprobado por un administrador.
// La barrera real de seguridad es la base de datos (rol 'pendiente' sin permisos); esto es solo la cara visible.
const CuentaPendiente: React.FC = () => {
    const { user, signOut } = useAuthStore();

    return (
        <div className="flex min-h-screen w-full items-center justify-center bg-stone-50 dark:bg-background-dark p-6">
            <div className="w-full max-w-md bg-white dark:bg-zinc-900 rounded-2xl shadow-xl border border-stone-200 dark:border-zinc-800 p-8 text-center space-y-5">
                <div className="mx-auto size-16 rounded-2xl bg-amber-100 text-amber-600 flex items-center justify-center">
                    <span className="material-symbols-outlined text-3xl">hourglass_top</span>
                </div>
                <div className="space-y-2">
                    <h1 className="text-xl font-black text-stone-900 dark:text-white">Cuenta pendiente de aprobación</h1>
                    <p className="text-sm text-stone-500 dark:text-stone-400">
                        Tu cuenta{user?.email ? ` (${user.email})` : ''} fue creada, pero todavía no tiene un rol asignado.
                        Pedile a un administrador que la apruebe y volvé a ingresar.
                    </p>
                </div>
                <button
                    onClick={() => signOut()}
                    className="w-full h-11 bg-stone-100 dark:bg-zinc-800 text-stone-700 dark:text-zinc-300 font-black text-xs uppercase tracking-widest rounded-xl hover:bg-stone-200 transition-all"
                >
                    Cerrar sesión
                </button>
            </div>
        </div>
    );
};

export default CuentaPendiente;
