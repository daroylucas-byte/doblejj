import React from 'react';

interface MainHeaderProps {
    title: string;
    children?: React.ReactNode;
}

const MainHeader: React.FC<MainHeaderProps> = ({ title, children }) => {
    return (
        <header className="h-16 border-b border-slate-200 dark:border-zinc-800 bg-white/80 dark:bg-zinc-900/80 backdrop-blur flex items-center justify-between px-8 sticky top-0 z-10 w-full">
            <h2 className="text-xl font-bold">{title}</h2>
            <div className="flex items-center gap-4">
                {children ? children : (
                    <>
                        <div className="relative w-64 hidden md:block">
                            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">search</span>
                            <input
                                className="w-full pl-10 pr-4 py-1.5 bg-slate-100 dark:bg-zinc-800 border-none rounded-lg text-sm focus:ring-2 focus:ring-primary/50"
                                placeholder="Buscar pedido, cliente..."
                                type="text"
                            />
                        </div>
                        <button className="p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-zinc-800 rounded-lg relative">
                            <span className="material-symbols-outlined">notifications</span>
                            <span className="absolute top-2 right-2 w-2 h-2 bg-primary rounded-full ring-2 ring-white dark:ring-zinc-900"></span>
                        </button>
                    </>
                )}
            </div>
        </header>
    );
};

export default MainHeader;
