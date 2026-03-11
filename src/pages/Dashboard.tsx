import React from 'react';
import { Link } from 'react-router-dom';
import Layout from '../components/Layout';
import MainHeader from '../components/MainHeader';

const Dashboard: React.FC = () => {
    return (
        <Layout>
            <MainHeader title="Dashboard General" />

            <div className="p-8 space-y-8 flex-1">
                {/* KPI Section */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    <div className="bg-white dark:bg-zinc-900 p-6 rounded-xl border border-slate-200 dark:border-zinc-800 shadow-sm transition-transform hover:scale-[1.02]">
                        <div className="flex justify-between items-start mb-4">
                            <div className="p-2 bg-green-100 dark:bg-green-500/10 text-green-600 dark:text-green-400 rounded-lg">
                                <span className="material-symbols-outlined">trending_up</span>
                            </div>
                            <span className="text-xs font-bold text-green-600">+12.5%</span>
                        </div>
                        <p className="text-slate-500 dark:text-zinc-400 text-sm font-medium">Ventas del día</p>
                        <h3 className="text-2xl font-bold mt-1">$ 150.430,00</h3>
                    </div>

                    <div className="bg-white dark:bg-zinc-900 p-6 rounded-xl border border-slate-200 dark:border-zinc-800 shadow-sm transition-transform hover:scale-[1.02]">
                        <div className="flex justify-between items-start mb-4">
                            <div className="p-2 bg-amber-100 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 rounded-lg">
                                <span className="material-symbols-outlined">pending_actions</span>
                            </div>
                        </div>
                        <p className="text-slate-500 dark:text-zinc-400 text-sm font-medium">Cobros Pendientes</p>
                        <h3 className="text-2xl font-bold mt-1">$ 42.100,50</h3>
                    </div>

                    <div className="bg-white dark:bg-zinc-900 p-6 rounded-xl border border-slate-200 dark:border-zinc-800 shadow-sm transition-transform hover:scale-[1.02]">
                        <div className="flex justify-between items-start mb-4">
                            <div className="p-2 bg-red-100 dark:bg-red-500/10 text-red-600 dark:text-red-400 rounded-lg">
                                <span className="material-symbols-outlined">priority_high</span>
                            </div>
                            <span className="px-2 py-1 bg-red-100 dark:bg-red-500/20 text-red-600 dark:text-red-400 text-[10px] rounded-full font-bold uppercase tracking-wider">Crítico</span>
                        </div>
                        <p className="text-slate-500 dark:text-zinc-400 text-sm font-medium">Stock Bajo Mínimo</p>
                        <h3 className="text-2xl font-bold mt-1">12 Productos</h3>
                    </div>

                    <div className="bg-white dark:bg-zinc-900 p-6 rounded-xl border border-slate-200 dark:border-zinc-800 shadow-sm transition-transform hover:scale-[1.02]">
                        <div className="flex justify-between items-start mb-4">
                            <div className="p-2 bg-blue-100 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 rounded-lg">
                                <span className="material-symbols-outlined">account_balance</span>
                            </div>
                            <span className="text-xs font-bold text-slate-400">8 Clientes</span>
                        </div>
                        <p className="text-slate-500 dark:text-zinc-400 text-sm font-medium">Clientes con Saldo</p>
                        <h3 className="text-2xl font-bold mt-1">$ 88.640,00</h3>
                    </div>
                </div>

                {/* Main Charts & Middle Section */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Sales Chart */}
                    <div className="lg:col-span-2 bg-white dark:bg-zinc-900 p-6 rounded-xl border border-slate-200 dark:border-zinc-800 shadow-sm">
                        <div className="flex items-center justify-between mb-8">
                            <div>
                                <h3 className="font-bold text-lg">Rendimiento Semanal</h3>
                                <p className="text-sm text-slate-500 dark:text-zinc-500">Ventas brutas comparadas con semana anterior</p>
                            </div>
                            <select className="bg-slate-100 dark:bg-zinc-800 border-none rounded-lg text-sm px-4 py-1.5 focus:ring-primary text-slate-900 dark:text-slate-100">
                                <option>Esta Semana</option>
                                <option>Semana Pasada</option>
                            </select>
                        </div>
                        <div className="h-64 flex flex-col justify-end">
                            <div className="flex items-end gap-2 h-48 w-full">
                                <div className="flex-1 bg-primary/20 hover:bg-primary transition-all rounded-t-lg relative group" style={{ height: '40%' }}>
                                    <span className="absolute -top-8 left-1/2 -translate-x-1/2 bg-zinc-800 text-white text-[10px] px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-20">$120k</span>
                                </div>
                                <div className="flex-1 bg-primary/20 hover:bg-primary transition-all rounded-t-lg relative group" style={{ height: '65%' }}>
                                    <span className="absolute -top-8 left-1/2 -translate-x-1/2 bg-zinc-800 text-white text-[10px] px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-20">$185k</span>
                                </div>
                                <div className="flex-1 bg-primary hover:bg-primary transition-all rounded-t-lg relative group" style={{ height: '85%' }}>
                                    <span className="absolute -top-8 left-1/2 -translate-x-1/2 bg-zinc-800 text-white text-[10px] px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-20">$240k</span>
                                </div>
                                <div className="flex-1 bg-primary/20 hover:bg-primary transition-all rounded-t-lg relative group" style={{ height: '55%' }}>
                                    <span className="absolute -top-8 left-1/2 -translate-x-1/2 bg-zinc-800 text-white text-[10px] px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-20">$160k</span>
                                </div>
                                <div className="flex-1 bg-primary/20 hover:bg-primary transition-all rounded-t-lg relative group" style={{ height: '95%' }}>
                                    <span className="absolute -top-8 left-1/2 -translate-x-1/2 bg-zinc-800 text-white text-[10px] px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-20">$280k</span>
                                </div>
                                <div className="flex-1 bg-primary/20 hover:bg-primary transition-all rounded-t-lg relative group" style={{ height: '45%' }}>
                                    <span className="absolute -top-8 left-1/2 -translate-x-1/2 bg-zinc-800 text-white text-[10px] px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-20">$130k</span>
                                </div>
                                <div className="flex-1 bg-primary/20 hover:bg-primary transition-all rounded-t-lg relative group" style={{ height: '20%' }}>
                                    <span className="absolute -top-8 left-1/2 -translate-x-1/2 bg-zinc-800 text-white text-[10px] px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-20">$60k</span>
                                </div>
                            </div>
                            <div className="flex justify-between mt-4 text-xs font-medium text-slate-400 uppercase tracking-tighter">
                                <span className="flex-1 text-center">Lun</span>
                                <span className="flex-1 text-center">Mar</span>
                                <span className="flex-1 text-center">Mie</span>
                                <span className="flex-1 text-center">Jue</span>
                                <span className="flex-1 text-center">Vie</span>
                                <span className="flex-1 text-center">Sab</span>
                                <span className="flex-1 text-center">Dom</span>
                            </div>
                        </div>
                    </div>

                    {/* Low Stock Alerts */}
                    <div className="bg-white dark:bg-zinc-900 p-6 rounded-xl border border-slate-200 dark:border-zinc-800 shadow-sm flex flex-col">
                        <div className="flex items-center justify-between mb-6">
                            <h3 className="font-bold text-lg">Alertas de Stock</h3>
                            <Link className="text-xs text-primary font-bold hover:underline" to="/stock">Ver todo</Link>
                        </div>
                        <div className="space-y-4 flex-1 overflow-y-auto max-h-[250px] pr-2 scrollbar-thin scrollbar-thumb-primary/20">
                            <div className="flex items-center gap-4 p-3 rounded-lg bg-red-50 dark:bg-red-500/5 border border-red-100 dark:border-red-500/10">
                                <div className="size-10 rounded bg-red-100 dark:bg-red-500/20 flex items-center justify-center text-red-600">
                                    <span className="material-symbols-outlined">inventory</span>
                                </div>
                                <div className="flex-1">
                                    <p className="text-sm font-bold truncate">Harina 0000 1kg</p>
                                    <p className="text-xs text-red-600 dark:text-red-400">Stock: 5 bultos (Mín: 20)</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-4 p-3 rounded-lg bg-amber-50 dark:bg-amber-500/5 border border-amber-100 dark:border-amber-500/10">
                                <div className="size-10 rounded bg-amber-100 dark:bg-amber-500/20 flex items-center justify-center text-amber-600">
                                    <span className="material-symbols-outlined">inventory</span>
                                </div>
                                <div className="flex-1">
                                    <p className="text-sm font-bold truncate">Aceite de Girasol 1.5L</p>
                                    <p className="text-xs text-amber-600 dark:text-amber-400">Stock: 12 bultos (Mín: 15)</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-4 p-3 rounded-lg bg-red-50 dark:bg-red-500/5 border border-red-100 dark:border-red-500/10">
                                <div className="size-10 rounded bg-red-100 dark:bg-red-500/20 flex items-center justify-center text-red-600">
                                    <span className="material-symbols-outlined">inventory</span>
                                </div>
                                <div className="flex-1">
                                    <p className="text-sm font-bold truncate">Yerba Mate 500g</p>
                                    <p className="text-xs text-red-600 dark:text-red-400">Stock: 2 bultos (Mín: 10)</p>
                                </div>
                            </div>
                        </div>
                        <button className="mt-6 w-full py-2.5 bg-primary text-white rounded-lg text-sm font-bold shadow-md shadow-primary/20 hover:bg-primary/90 transition-colors">
                            Generar Orden de Compra
                        </button>
                    </div>
                </div>

                {/* Recent Sales Table */}
                <div className="bg-white dark:bg-zinc-900 rounded-xl border border-slate-200 dark:border-zinc-800 shadow-sm overflow-hidden mb-8">
                    <div className="p-6 border-b border-slate-100 dark:border-zinc-800 flex justify-between items-center bg-white dark:bg-zinc-900">
                        <h3 className="font-bold text-lg">Ventas Recientes</h3>
                        <button className="flex items-center gap-2 px-4 py-2 border border-slate-200 dark:border-zinc-700 rounded-lg text-sm font-medium hover:bg-slate-50 dark:hover:bg-zinc-800 transition-colors">
                            <span className="material-symbols-outlined text-sm">filter_list</span>
                            Filtros
                        </button>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead>
                                <tr className="bg-slate-50 dark:bg-zinc-800/50 text-slate-500 dark:text-zinc-400 text-xs font-bold uppercase tracking-wider">
                                    <th className="px-6 py-4">Orden</th>
                                    <th className="px-6 py-4">Cliente</th>
                                    <th className="px-6 py-4">Fecha</th>
                                    <th className="px-6 py-4">Monto</th>
                                    <th className="px-6 py-4">Estado</th>
                                    <th className="px-6 py-4 text-right">Acciones</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
                                <tr className="hover:bg-slate-50 dark:hover:bg-zinc-800/30 transition-colors">
                                    <td className="px-6 py-4 font-bold text-slate-900 dark:text-slate-100">#ORD-4582</td>
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-3">
                                            <div className="size-8 rounded-full bg-primary/10 flex items-center justify-center text-primary text-[10px] font-bold">MS</div>
                                            <div>
                                                <p className="text-sm font-semibold">Mercado Santa Rita</p>
                                                <p className="text-[10px] text-slate-500">CUIT: 20-34556788-2</p>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-sm">Hoy, 14:30</td>
                                    <td className="px-6 py-4 text-sm font-bold">$ 24.500,00</td>
                                    <td className="px-6 py-4">
                                        <span className="px-3 py-1 bg-green-100 dark:bg-green-500/20 text-green-700 dark:text-green-400 text-xs font-bold rounded-full">Confirmada</span>
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <button className="text-slate-400 hover:text-primary transition-colors">
                                            <span className="material-symbols-outlined">more_vert</span>
                                        </button>
                                    </td>
                                </tr>
                                <tr className="hover:bg-slate-50 dark:hover:bg-zinc-800/30 transition-colors">
                                    <td className="px-6 py-4 font-bold text-slate-900 dark:text-slate-100">#ORD-4581</td>
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-3">
                                            <div className="size-8 rounded-full bg-primary/10 flex items-center justify-center text-primary text-[10px] font-bold">AK</div>
                                            <div>
                                                <p className="text-sm font-semibold">Autoservicio Kios</p>
                                                <p className="text-[10px] text-slate-500">CUIT: 27-44990123-1</p>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-sm">Hoy, 12:15</td>
                                    <td className="px-6 py-4 text-sm font-bold">$ 18.230,00</td>
                                    <td className="px-6 py-4">
                                        <span className="px-3 py-1 bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-400 text-xs font-bold rounded-full">Preparando</span>
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <button className="text-slate-400 hover:text-primary transition-colors">
                                            <span className="material-symbols-outlined">more_vert</span>
                                        </button>
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </Layout>
    );
};

export default Dashboard;
