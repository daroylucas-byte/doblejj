import React from 'react';
import { NavLink } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';

const Sidebar: React.FC = () => {
    const { user, signOut } = useAuthStore();

    const nombre = user?.user_metadata?.nombre || '';
    const apellido = user?.user_metadata?.apellido || '';
    const fullName = (nombre + ' ' + apellido).trim() || user?.email?.split('@')[0] || 'Usuario';
    const userRole = user?.user_metadata?.rol || 'Usuario';

    const handleSignOut = async () => {
        try {
            await signOut();
        } catch (error) {
            console.error('Error signing out:', error);
        }
    };

    return (
        <aside className="w-64 flex-shrink-0 bg-white dark:bg-zinc-900 border-r border-slate-200 dark:border-zinc-800 flex flex-col hidden lg:flex h-screen sticky top-0">
            <div className="p-6 flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-white dark:bg-zinc-800 flex items-center justify-center p-1 shadow-md">
                    <img src="/logo_ticket.png" alt="Doble JJ Logo" className="w-full h-full object-contain" />
                </div>
                <div>
                    <h1 className="font-bold text-lg leading-none">Doble JJ</h1>
                    <p className="text-[10px] text-slate-500 dark:text-zinc-500 font-medium uppercase tracking-tighter">Abastecimiento Mayorista</p>
                </div>
            </div>
            <nav className="flex-1 px-4 py-4 space-y-1 overflow-y-auto scrollbar-thin scrollbar-thumb-slate-200 dark:scrollbar-thumb-zinc-800">
                <NavLink
                    to="/dashboard"
                    className={({ isActive }) =>
                        `flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors ${isActive ? 'bg-primary/10 text-primary font-semibold' : 'text-slate-600 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-zinc-800'
                        }`
                    }
                >
                    <span className="material-symbols-outlined">dashboard</span>
                    <span>Dashboard</span>
                </NavLink>
                <NavLink
                    to="/clientes"
                    className={({ isActive }) =>
                        `flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors ${isActive ? 'bg-primary/10 text-primary font-semibold' : 'text-slate-600 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-zinc-800'
                        }`
                    }
                >
                    <span className="material-symbols-outlined">group</span>
                    <span>Clientes</span>
                </NavLink>
                <NavLink
                    to="/productos"
                    className={({ isActive }) =>
                        `flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors ${isActive ? 'bg-primary/10 text-primary font-semibold' : 'text-slate-600 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-zinc-800'
                        }`
                    }
                >
                    <span className="material-symbols-outlined">inventory_2</span>
                    <span>Productos</span>
                </NavLink>
                <NavLink
                    to="/ventas"
                    className={({ isActive }) =>
                        `flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors ${isActive ? 'bg-primary/10 text-primary font-semibold' : 'text-slate-600 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-zinc-800'
                        }`
                    }
                >
                    <span className="material-symbols-outlined">shopping_cart</span>
                    <span>Ventas</span>
                </NavLink>
                <NavLink
                    to="/caja"
                    className={({ isActive }) =>
                        `flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors ${isActive ? 'bg-primary/10 text-primary font-semibold' : 'text-slate-600 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-zinc-800'
                        }`
                    }
                >
                    <span className="material-symbols-outlined">account_balance_wallet</span>
                    <span>Caja</span>
                </NavLink>
                <NavLink
                    to="/elaboracion"
                    className={({ isActive }) =>
                        `flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors ${isActive ? 'bg-primary/10 text-primary font-semibold' : 'text-slate-600 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-zinc-800'
                        }`
                    }
                >
                    <span className="material-symbols-outlined">outdoor_grill</span>
                    <span>Elaboración</span>
                </NavLink>
                <NavLink
                    to="/proveedores"
                    className={({ isActive }) =>
                        `flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors ${isActive ? 'bg-primary/10 text-primary font-semibold' : 'text-slate-600 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-zinc-800'
                        }`
                    }
                >
                    <span className="material-symbols-outlined">local_shipping</span>
                    <span>Proveedores</span>
                </NavLink>
            </nav>
            <div className="p-4 border-t border-slate-200 dark:border-zinc-800">
                <div className="flex items-center gap-3 p-2 bg-slate-50 dark:bg-zinc-800/50 rounded-xl">
                    <div className="size-10 rounded-full bg-slate-200 dark:bg-zinc-800 overflow-hidden ring-2 ring-primary/20">
                        <img
                            className="w-full h-full object-cover"
                            src={`https://ui-avatars.com/api/?name=${encodeURIComponent(fullName)}&background=random`}
                            alt="Avatar"
                            onError={(e) => {
                                (e.target as HTMLImageElement).src = 'https://ui-avatars.com/api/?name=U&background=random';
                            }}
                        />
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold truncate capitalize">{fullName.trim() || user?.email?.split('@')[0]}</p>
                        <p className="text-[10px] font-bold text-primary uppercase tracking-wider">{userRole}</p>
                    </div>
                    <button
                        onClick={handleSignOut}
                        className="text-slate-400 hover:text-primary transition-colors p-1.5 hover:bg-primary/10 rounded-lg"
                        title="Cerrar sesión"
                    >
                        <span className="material-symbols-outlined text-xl">logout</span>
                    </button>
                </div>
            </div>
        </aside>
    );
};

export default Sidebar;
