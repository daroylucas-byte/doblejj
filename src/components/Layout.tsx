import React, { useState } from 'react';
import Sidebar from './Sidebar';
import MobileHeader from './MobileHeader';

interface LayoutProps {
    children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);

    return (
        <div className="flex flex-col lg:flex-row min-h-[100dvh] bg-background-light dark:bg-background-dark text-slate-900 dark:text-slate-100 font-display transition-colors duration-300 overflow-hidden h-[100dvh] w-full">
            {/* Cabecera Móvil */}
            <MobileHeader onMenuClick={() => setIsSidebarOpen(true)} />

            {/* Overlay para cerrar en móvil */}
            {isSidebarOpen && (
                <div 
                    className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-40 lg:hidden"
                    onClick={() => setIsSidebarOpen(false)}
                />
            )}

            {/* Menú Lateral */}
            <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />

            {/* Contenido Principal */}
            <main className="flex-1 flex flex-col h-full overflow-y-auto w-full relative">
                {children}
            </main>
        </div>
    );
};

export default Layout;
