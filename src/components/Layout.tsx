import React from 'react';
import Sidebar from './Sidebar';

interface LayoutProps {
    children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
    return (
        <div className="flex min-h-screen bg-background-light dark:bg-background-dark text-slate-900 dark:text-slate-100 font-display transition-colors duration-300">
            <Sidebar />
            <main className="flex-1 flex flex-col h-screen overflow-y-auto w-full relative">
                {children}
            </main>
        </div>
    );
};

export default Layout;
