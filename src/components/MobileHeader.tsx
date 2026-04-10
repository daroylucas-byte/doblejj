import React from 'react';

interface MobileHeaderProps {
    onMenuClick: () => void;
}

const MobileHeader: React.FC<MobileHeaderProps> = ({ onMenuClick }) => {
    return (
        <header className="lg:hidden border-b border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 flex items-center justify-between px-4 sticky top-0 z-50 w-full transition-colors duration-300 pt-[calc(env(safe-area-inset-top)+0.5rem)] pb-2 min-h-[4rem]">
            <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-xl bg-white dark:bg-zinc-800 flex items-center justify-center p-1 shadow-sm border border-slate-100 dark:border-zinc-800">
                    <img src="/logo_ticket.png" alt="Logo" className="w-full h-full object-contain" />
                </div>
                <div>
                    <h1 className="font-bold text-sm leading-none">Doble JJ</h1>
                    <p className="text-[8px] text-slate-500 font-bold uppercase tracking-tighter">Abastecimiento</p>
                </div>
            </div>
            
            <button 
                onClick={onMenuClick}
                className="w-10 h-10 flex items-center justify-center text-slate-600 dark:text-zinc-400 active:scale-90 transition-all rounded-xl hover:bg-slate-50 dark:hover:bg-zinc-800"
                aria-label="Menú"
            >
                <span className="material-symbols-outlined text-2xl">menu</span>
            </button>
        </header>
    );
};

export default MobileHeader;
