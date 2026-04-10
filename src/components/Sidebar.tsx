import React from 'react';
import { NavLink } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { LAST_UPDATE } from '../version';

interface SidebarProps {
    isOpen: boolean;
    onClose: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ isOpen, onClose }) => {
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
        <aside 
            className={`
                fixed inset-y-0 left-0 z-50 w-72 bg-white dark:bg-zinc-900 border-r border-slate-200 dark:border-zinc-800 
                flex flex-col transition-transform duration-300 ease-in-out lg:static lg:translate-x-0
                ${isOpen ? 'translate-x-0' : '-translate-x-full'}
            `}
        >
            <div className="p-6 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-white dark:bg-zinc-800 flex items-center justify-center p-1 shadow-md">
                        <img src="/logo_ticket.png" alt="Doble JJ Logo" className="w-full h-full object-contain" />
                    </div>
                    <div>
                        <h1 className="font-bold text-base leading-none">Doble JJ</h1>
                        <p className="text-[9px] text-slate-500 dark:text-zinc-500 font-medium uppercase tracking-tighter">Abastecimiento</p>
                    </div>
                </div>
                
                <button 
                    onClick={onClose}
                    className="lg:hidden p-2 text-slate-400 hover:text-primary transition-colors"
                >
                    <span className="material-symbols-outlined">close</span>
                </button>
            </div>
            <nav className="flex-1 px-4 py-4 space-y-1 overflow-y-auto scrollbar-thin scrollbar-thumb-slate-200 dark:scrollbar-thumb-zinc-800">
                <NavLink
                    to="/dashboard"
                    onClick={() => window.innerWidth < 1024 && onClose()}
                    className={({ isActive }) =>
                        `flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors ${isActive ? 'bg-primary/10 text-primary font-semibold' : 'text-slate-600 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-zinc-800'
                        }`
                    }
                >
                    <span className="material-symbols-outlined text-[22px] w-6 flex justify-center">dashboard</span>
                    <span className="font-medium tracking-tight truncate">Dashboard</span>
                </NavLink>
                <NavLink
                    to="/clientes"
                    onClick={() => window.innerWidth < 1024 && onClose()}
                    className={({ isActive }) =>
                        `flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors ${isActive ? 'bg-primary/10 text-primary font-semibold' : 'text-slate-600 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-zinc-800'
                        }`
                    }
                >
                    <span className="material-symbols-outlined text-[22px] w-6 flex justify-center">group</span>
                    <span className="font-medium tracking-tight truncate">Clientes</span>
                </NavLink>
                <NavLink
                    to="/productos"
                    onClick={() => window.innerWidth < 1024 && onClose()}
                    className={({ isActive }) =>
                        `flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors ${isActive ? 'bg-primary/10 text-primary font-semibold' : 'text-slate-600 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-zinc-800'
                        }`
                    }
                >
                    <span className="material-symbols-outlined text-[22px] w-6 flex justify-center">inventory_2</span>
                    <span className="font-medium tracking-tight truncate">Productos</span>
                </NavLink>
                <NavLink
                    to="/ventas"
                    onClick={() => window.innerWidth < 1024 && onClose()}
                    className={({ isActive }) =>
                        `flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors ${isActive ? 'bg-primary/10 text-primary font-semibold' : 'text-slate-600 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-zinc-800'
                        }`
                    }
                >
                    <span className="material-symbols-outlined text-[22px] w-6 flex justify-center">shopping_cart</span>
                    <span className="font-medium tracking-tight truncate">Ventas</span>
                </NavLink>
                <NavLink
                    to="/caja"
                    onClick={() => window.innerWidth < 1024 && onClose()}
                    className={({ isActive }) =>
                        `flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors ${isActive ? 'bg-primary/10 text-primary font-semibold' : 'text-slate-600 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-zinc-800'
                        }`
                    }
                >
                    <span className="material-symbols-outlined text-[22px] w-6 flex justify-center">account_balance_wallet</span>
                    <span className="font-medium tracking-tight truncate">Caja</span>
                </NavLink>
                <NavLink
                    to="/elaboracion"
                    onClick={() => window.innerWidth < 1024 && onClose()}
                    className={({ isActive }) =>
                        `flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors ${isActive ? 'bg-primary/10 text-primary font-semibold' : 'text-slate-600 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-zinc-800'
                        }`
                    }
                >
                    <span className="material-symbols-outlined text-[22px] w-6 flex justify-center">outdoor_grill</span>
                    <span className="font-medium tracking-tight truncate">Elaboración</span>
                </NavLink>
                <NavLink
                    to="/proveedores"
                    onClick={() => window.innerWidth < 1024 && onClose()}
                    className={({ isActive }) =>
                        `flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors ${isActive ? 'bg-primary/10 text-primary font-semibold' : 'text-slate-600 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-zinc-800'
                        }`
                    }
                >
                    <span className="material-symbols-outlined text-[22px] w-6 flex justify-center">local_shipping</span>
                    <span className="font-medium tracking-tight truncate">Proveedores</span>
                </NavLink>
            </nav>
            <div className="p-4 border-t border-slate-200 dark:border-zinc-800 space-y-3">
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
                        className="text-slate-400 hover:text-rose-500 transition-colors p-2 hover:bg-rose-50 dark:hover:bg-rose-500/10 rounded-xl"
                        title="Cerrar sesión"
                    >
                        <span className="material-symbols-outlined text-xl">logout</span>
                    </button>
                </div>
                
                <div className="px-2 flex items-center justify-between text-slate-400">
                    <div className="flex items-center gap-1.5 overflow-hidden w-full">
                        <span className="material-symbols-outlined text-xs flex-shrink-0">history</span>
                        <span className="text-[8px] sm:text-[9px] font-bold uppercase tracking-widest truncate flex-1 block" title={`Actualizado: ${LAST_UPDATE}`}>
                            Actualizado: {LAST_UPDATE}
                        </span>
                    </div>
                </div>
            </div>
        </aside>
    );
};

export default Sidebar;
