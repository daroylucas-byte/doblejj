import { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import MainHeader from '../components/MainHeader';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/authStore';

export default function Caja() {
    const { user } = useAuthStore();
    const [loading, setLoading] = useState(true);
    const [cierreModalOpen, setCierreModalOpen] = useState(false);
    const [egresoModalOpen, setEgresoModalOpen] = useState(false);

    // Resume State
    const [fechaApertura, setFechaApertura] = useState<string>('');
    const [saldoInicial, setSaldoInicial] = useState<number>(0);
    const [ingresos, setIngresos] = useState<number>(0);
    const [ingresosEfvo, setIngresosEfvo] = useState<number>(0);
    const [ingresosTransf, setIngresosTransf] = useState<number>(0);
    const [ingresosTarjeta, setIngresosTarjeta] = useState<number>(0);
    const [egresos, setEgresos] = useState<number>(0);
    const [egresosEfvo, setEgresosEfvo] = useState<number>(0);
    const [saldoReal, setSaldoReal] = useState<number>(0);
    const [notasCierre, setNotasCierre] = useState('');
    const [isSaving, setIsSaving] = useState(false);

    // Manual Expense State
    const [egresoForm, setEgresoForm] = useState({ monto: '', concepto: '', categoria_gasto_id: '' });
    const [categoriasGasto, setCategoriasGasto] = useState<any[]>([]);

    // Filter State
    const [dateRange, setDateRange] = useState({ from: '', to: '' });

    // Timeline State
    const [movimientos, setMovimientos] = useState<any[]>([]);
    const [historialCierres, setHistorialCierres] = useState<any[]>([]);

    useEffect(() => {
        fetchCajaResumen();
    }, [dateRange]); // Refetch when date filter changes

    const fetchCajaResumen = async () => {
        setLoading(true);
        try {
            let fromDate: string | null = null;
            let toDate: string | null = null;
            let currentSaldoInicial = 0;
            const isCustomDate = dateRange.from !== '' || dateRange.to !== '';

            if (!isCustomDate) {
                // Modo Turno Actual
                try {
                    const { data: cierres } = await supabase
                        .from('caja_cierres')
                        .select('*')
                        .order('fecha_cierre', { ascending: false })
                        .limit(1);

                    if (cierres && cierres.length > 0) {
                        fromDate = cierres[0].fecha_cierre;
                        currentSaldoInicial = cierres[0].saldo_real; // El saldo final real del último cierre es mi inicial hoy
                    }
                } catch (err) {
                    console.warn('Tabla caja_cierres no existe aún o hubo un error.', err);
                }

                // Si no hay cierre previo, usamos el inicio del día
                if (!fromDate) {
                    const startOfDay = new Date();
                    startOfDay.setHours(0, 0, 0, 0);
                    fromDate = startOfDay.toISOString();
                }
            } else {
                // Modo filtro de fechas (ignora el cierre anterior)
                if (dateRange.from) {
                    fromDate = new Date(dateRange.from + 'T00:00:00').toISOString();
                } else {
                    fromDate = new Date(2000, 0, 1).toISOString(); // Origen de los tiempos si solo pone 'hasta'
                }

                if (dateRange.to) {
                    toDate = new Date(dateRange.to + 'T23:59:59.999').toISOString();
                }
                currentSaldoInicial = 0; // Para reportes históricos no arrastramos saldo salvo que calculemos todo el historial
            }

            setFechaApertura(fromDate || new Date().toISOString());
            setSaldoInicial(currentSaldoInicial);

            // 2. Traer Ingresos 
            // NUEVO: Pagos explícitos (Efectivo/Transferencia)
            let queryPagos = supabase
                .from('pagos')
                .select('id, monto, forma_pago, created_at, venta_id')
                .gte('created_at', fromDate);
            if (toDate) queryPagos = queryPagos.lte('created_at', toDate);
            const { data: pagosData } = await queryPagos;

            const pagosRecibidos = (pagosData || []).filter(p => p.forma_pago === 'efectivo' || p.forma_pago === 'transferencia' || p.forma_pago === 'tarjeta');

            // LEGACY: Ventas cobradas en el momento (ventas históricas que no usaban la tabla pagos)
            let queryVentas = supabase.from('ventas').select('id, total, saldo_pendiente, created_at, numero, estado').gte('created_at', fromDate);
            if (toDate) queryVentas = queryVentas.lte('created_at', toDate);
            const { data: ventasData } = await queryVentas;

            const pagosAsociadosIds = new Set((pagosData || []).map(p => p.venta_id));
            const ventasCobradasHistoricas = (ventasData || []).filter(v =>
                v.saldo_pendiente === 0 &&
                v.estado !== 'anulada' &&
                !pagosAsociadosIds.has(v.id) // Solo si no está contada ya por la tabla de pagos
            );

            const ingresosEfvoVal = pagosRecibidos.filter(p => p.forma_pago === 'efectivo').reduce((acc, p) => acc + (p.monto || 0), 0) +
                ventasCobradasHistoricas.reduce((acc, v) => acc + (v.total || 0), 0);
            const ingresosTransfVal = pagosRecibidos.filter(p => p.forma_pago === 'transferencia').reduce((acc, p) => acc + (p.monto || 0), 0);
            const ingresosTarjetaVal = pagosRecibidos.filter(p => p.forma_pago === 'tarjeta').reduce((acc, p) => acc + (p.monto || 0), 0);

            setIngresosEfvo(ingresosEfvoVal);
            setIngresosTransf(ingresosTransfVal);
            setIngresosTarjeta(ingresosTarjetaVal);
            setIngresos(ingresosEfvoVal + ingresosTransfVal + ingresosTarjetaVal);


            // 3. Traer Egresos
            // NUEVO: Pagos realizados a proveedores
            let queryPagosProv = supabase
                .from('pagos_proveedores')
                .select('id, monto, forma_pago, created_at, compra_id')
                .gte('created_at', fromDate);
            if (toDate) queryPagosProv = queryPagosProv.lte('created_at', toDate);
            const { data: pagosProvData } = await queryPagosProv;

            const pagosRealizados = (pagosProvData || []).filter(p => p.forma_pago === 'efectivo' || p.forma_pago === 'transferencia');

            // LEGACY: Compras pagadas (compras históricas que no están en cta. cte.)
            let queryCompras = supabase.from('compras').select('id, total, created_at, nro_comprobante, estado').gte('created_at', fromDate);
            if (toDate) queryCompras = queryCompras.lte('created_at', toDate);
            const { data: comprasData } = await queryCompras;

            let queryCtaCte = supabase.from('cuenta_corriente_proveedores').select('compra_id').gte('created_at', fromDate);
            if (toDate) queryCtaCte = queryCtaCte.lte('created_at', toDate);
            const { data: ctaCteProv } = await queryCtaCte;

            const comprasEnCtaCteIds = new Set((ctaCteProv || []).map(c => c.compra_id));
            const pagosProvAsociadosIds = new Set((pagosProvData || []).map(p => p.compra_id));

            const comprasPagadasHistoricas = (comprasData || []).filter(c =>
                !comprasEnCtaCteIds.has(c.id) &&
                c.estado !== 'anulada' &&
                !pagosProvAsociadosIds.has(c.id) // Evitar duplicar si justo tiene un registro en pagos_proveedores
            );

            // Gastos
            let queryGastos = supabase
                .from('gastos')
                .select('id, monto, created_at, concepto')
                .gte('created_at', fromDate);
            if (toDate) queryGastos = queryGastos.lte('created_at', toDate);
            const { data: gastosData } = await queryGastos;

            const egresosEfvoVal = pagosRealizados.filter(p => p.forma_pago === 'efectivo').reduce((acc, p) => acc + (p.monto || 0), 0) +
                comprasPagadasHistoricas.reduce((acc, c) => acc + (c.total || 0), 0) +
                (gastosData || []).reduce((acc, g) => acc + (g.monto || 0), 0);
            
            const egresosTransfVal = pagosRealizados.filter(p => p.forma_pago === 'transferencia').reduce((acc, p) => acc + (p.monto || 0), 0);

            setEgresosEfvo(egresosEfvoVal);
            setEgresos(egresosEfvoVal + egresosTransfVal);

            // Build the initial real balance just reflecting theoretical balance (CASH ONLY)
            setSaldoReal(currentSaldoInicial + ingresosEfvoVal - egresosEfvoVal);

            // Fetch generic timeline items
            const allMovs = [
                ...pagosRecibidos.map(p => ({
                    tipo: 'ingreso',
                    monto: p.monto,
                    fecha: p.created_at,
                    concepto: `COBRO DE VENTA (${p.forma_pago?.toUpperCase() || 'S/D'})`,
                    forma_pago: p.forma_pago
                })),
                ...ventasCobradasHistoricas.map(v => ({
                    tipo: 'ingreso',
                    monto: v.total,
                    fecha: v.created_at,
                    concepto: `VENTA #${v.numero || v.id.substring(0, 6)} (EFECTIVO)`,
                    forma_pago: 'efectivo'
                })),
                ...pagosRealizados.map(p => ({
                    tipo: 'egreso',
                    monto: p.monto,
                    fecha: p.created_at,
                    concepto: `PAGO A PROVEEDOR (${p.forma_pago?.toUpperCase() || 'S/D'})`,
                    forma_pago: p.forma_pago
                })),
                ...comprasPagadasHistoricas.map(c => ({
                    tipo: 'egreso',
                    monto: c.total,
                    fecha: c.created_at,
                    concepto: `COMPRA #${c.nro_comprobante || c.id.substring(0, 6)} (EFECTIVO)`,
                    forma_pago: 'efectivo'
                })),
                ...(gastosData || []).map(g => ({
                    tipo: 'egreso',
                    monto: g.monto,
                    fecha: g.created_at,
                    concepto: g.concepto || 'Gasto Operativo'
                }))
            ].sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime());

            setMovimientos(allMovs);

            // 4. Fetch History of Closures (Always the last 10)
            const { data: cierresHist } = await supabase
                .from('caja_cierres')
                .select('*')
                .order('fecha_cierre', { ascending: false })
                .limit(10);
            setHistorialCierres(cierresHist || []);

            // 5. Fetch Expense Categories
            const { data: cats } = await supabase
                .from('categorias_gasto')
                .select('*')
                .eq('activo', true)
                .order('nombre');
            setCategoriasGasto(cats || []);

        } catch (error) {
            console.error("Error fetching balance data", error);
        } finally {
            setLoading(false);
        }
    };

    const saldoTeorico = saldoInicial + ingresosEfvo - egresosEfvo;
    const diferencia = saldoReal - saldoTeorico;

    const handleCierre = async () => {
        setIsSaving(true);
        try {
            const nuevoCierre = {
                fecha_apertura: fechaApertura,
                fecha_cierre: new Date().toISOString(),
                saldo_inicial: saldoInicial,
                total_ingresos: ingresos,
                total_egresos: egresos,
                saldo_teorico: saldoTeorico,
                saldo_real: saldoReal,
                diferencia: diferencia,
                usuario_id: user?.id,
                notas: notasCierre
            };

            const { error } = await supabase.from('caja_cierres').insert([nuevoCierre]);

            if (error) {
                // If the error code tells us it doesn't exist, warn the user explicitly.
                if (error.code === '42P01' || error.message.includes('No existe la relación')) {
                    alert("Error: Aún no has creado la tabla 'caja_cierres' en la base de datos de Supabase. Sigue las instrucciones del chat.");
                } else {
                    alert("Error al guardar el cierre: " + error.message);
                }
                throw error;
            }

            alert("Cierre de caja guardado exitosamente.");
            setCierreModalOpen(false);
            fetchCajaResumen(); // Refresca los saldos con el nuevo cierre
        } catch (err) {
            console.error(err);
        } finally {
            setIsSaving(false);
        }
    };

    const handleGuardarEgreso = async () => {
        if (!egresoForm.monto || !egresoForm.concepto || !egresoForm.categoria_gasto_id) {
            return alert("Por favor completá Monto, Concepto y seleccioná una Categoría.");
        }
        
        setIsSaving(true);
        try {
            const { error } = await supabase.from('gastos').insert([{
                monto: Number(egresoForm.monto),
                concepto: egresoForm.concepto.toUpperCase(),
                categoria_gasto_id: egresoForm.categoria_gasto_id,
                forma_pago: 'efectivo',
                fecha: new Date().toISOString().split('T')[0],
                usuario_id: user?.id,
                created_at: new Date().toISOString()
            }]);

            if (error) throw error;

            alert("Egreso registrado correctamente");
            setEgresoModalOpen(false);
            setEgresoForm({ monto: '', concepto: '', categoria_gasto_id: '' });
            fetchCajaResumen();
        } catch (err) {
            console.error(err);
            alert("Error al registrar egreso");
        } finally {
            setIsSaving(false);
        }
    };

    if (loading) {
        return (
            <Layout>
                <div className="flex justify-center items-center h-screen w-full">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
                </div>
            </Layout>
        );
    }

    const isCustomDate = dateRange.from !== '' || dateRange.to !== '';

    return (
        <Layout>
            <MainHeader title="Control de Caja y Balances">
                <span className="px-3 py-1 bg-emerald-500/10 text-emerald-500 text-[10px] font-black uppercase tracking-widest rounded-full border border-emerald-500/20">Finanzas</span>
            </MainHeader>

            <div className="p-8 max-w-[1600px] mx-auto w-full space-y-6">

                {/* Filtros */}
                <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-[2rem] p-6 shadow-sm flex flex-col md:flex-row items-center gap-4 justify-between">
                    <div>
                        <h2 className="text-lg font-black tracking-tight flex items-center gap-2">
                            <span className="material-symbols-outlined text-primary">calendar_month</span>
                            Filtros de Balance
                        </h2>
                        <p className="text-xs text-slate-500 font-medium mt-1">Seleccioná un rango para ver operaciones pasadas. Dejar vacío para ver el Turno Actual.</p>
                    </div>
                    <div className="flex items-center gap-3 w-full md:w-auto">
                        <div className="flex flex-col">
                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1 ml-1">Desde</label>
                            <input
                                type="date"
                                className="bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-sm font-bold rounded-xl px-4 py-2 outline-none focus:ring-2 focus:ring-primary/50"
                                value={dateRange.from}
                                onChange={(e) => setDateRange(prev => ({ ...prev, from: e.target.value }))}
                            />
                        </div>
                        <div className="flex flex-col">
                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1 ml-1">Hasta</label>
                            <input
                                type="date"
                                className="bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-sm font-bold rounded-xl px-4 py-2 outline-none focus:ring-2 focus:ring-primary/50"
                                value={dateRange.to}
                                onChange={(e) => setDateRange(prev => ({ ...prev, to: e.target.value }))}
                            />
                        </div>
                        {isCustomDate && (
                            <button
                                onClick={() => setDateRange({ from: '', to: '' })}
                                className="mt-5 p-2 rounded-xl text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 transition-colors"
                                title="Limpiar Filtros"
                            >
                                <span className="material-symbols-outlined">close</span>
                            </button>
                        )}
                    </div>
                </div>

                {/* Balance Cards */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                    <div className="bg-white dark:bg-zinc-900 rounded-[2rem] p-6 border border-slate-200 dark:border-zinc-800 shadow-sm relative overflow-hidden group">
                        <div className="absolute top-0 right-0 p-6 opacity-10 group-hover:scale-110 group-hover:-rotate-6 transition-transform duration-500">
                            <span className="material-symbols-outlined text-6xl text-slate-500">account_balance_wallet</span>
                        </div>
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">
                            {isCustomDate ? 'Rango Analizado' : 'Apertura'}
                        </p>
                        <h3 className="text-xl font-black text-slate-800 dark:text-white mb-1">
                            {isCustomDate && dateRange.from ? new Date(dateRange.from + 'T00:00:00').toLocaleDateString() : new Date(fechaApertura).toLocaleDateString()}
                            {isCustomDate && dateRange.to ? ` al ${new Date(dateRange.to + 'T00:00:00').toLocaleDateString()}` : ''}
                        </h3>
                        {!isCustomDate && (
                            <p className="text-xs font-bold text-slate-500">{new Date(fechaApertura).toLocaleTimeString()}</p>
                        )}
                    </div>

                    <div className="bg-white dark:bg-zinc-900 rounded-[2rem] p-6 border border-emerald-200 dark:border-emerald-900/30 shadow-sm flex flex-col justify-between">
                        <div>
                            <p className="text-[10px] font-black uppercase tracking-widest text-emerald-500 mb-2 flex items-center gap-1">
                                <span className="material-symbols-outlined text-[14px]">arrow_downward</span>
                                Ingresos Totales
                            </p>
                            <h3 className="text-3xl font-black text-emerald-600 dark:text-emerald-400">
                                $ {ingresos.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                            </h3>
                        </div>
                        <div className="mt-4 pt-4 border-t border-emerald-50 dark:border-emerald-900/20 space-y-1">
                            <div className="flex justify-between text-[10px] font-bold">
                                <span className="text-slate-400 uppercase">Efectivo:</span>
                                <span className="text-emerald-600 dark:text-emerald-400">$ {ingresosEfvo.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
                            </div>
                            <div className="flex justify-between text-[10px] font-bold">
                                <span className="text-slate-400 uppercase">Transf:</span>
                                <span className="text-blue-500">$ {ingresosTransf.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
                            </div>
                            <div className="flex justify-between text-[10px] font-bold">
                                <span className="text-slate-400 uppercase">Tarjeta:</span>
                                <span className="text-purple-500">$ {ingresosTarjeta.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
                            </div>
                        </div>
                    </div>

                    <div className="bg-white dark:bg-zinc-900 rounded-[2rem] p-6 border border-rose-200 dark:border-rose-900/30 shadow-sm">
                        <p className="text-[10px] font-black uppercase tracking-widest text-rose-500 mb-2 flex items-center gap-1">
                            <span className="material-symbols-outlined text-[14px]">arrow_upward</span>
                            Egresos {isCustomDate ? 'del Período' : 'del Turno'}
                        </p>
                        <h3 className="text-3xl font-black text-rose-600 dark:text-rose-400">
                            $ {egresos.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                        </h3>
                    </div>

                    <div className="bg-primary rounded-[2rem] p-6 text-white shadow-lg shadow-primary/20 flex flex-col justify-center">
                        <p className="text-[10px] font-black uppercase tracking-widest text-white/70 mb-2">
                            Saldo Teórico (EFECTIVO)
                        </p>
                        <h3 className="text-4xl font-black tracking-tighter">
                            $ {saldoReal.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                        </h3>
                        <p className="text-[10px] font-bold text-white/50 mt-2 uppercase tracking-widest">
                            Saldo físico estimado en caja
                        </p>
                    </div>
                </div>

                {!isCustomDate && (
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => setEgresoModalOpen(true)}
                            className="bg-white dark:bg-zinc-800 text-rose-500 border border-rose-200 dark:border-rose-900/30 hover:scale-105 active:scale-95 transition-all outline-none font-black text-sm uppercase tracking-widest rounded-xl px-8 py-4 shadow-lg flex items-center gap-2"
                        >
                            <span className="material-symbols-outlined">money_off</span>
                            Registrar Egreso / Retiro
                        </button>
                        <button
                            onClick={() => setCierreModalOpen(true)}
                            className="bg-slate-900 dark:bg-white text-white dark:text-zinc-900 hover:scale-105 active:scale-95 transition-all outline-none font-black text-sm uppercase tracking-widest rounded-xl px-8 py-4 shadow-lg flex items-center gap-2"
                        >
                            <span className="material-symbols-outlined">point_of_sale</span>
                            Realizar Cierre de Caja
                        </button>
                        <p className="text-xs text-slate-500 font-bold max-w-lg">
                            Al realizar el cierre, este saldo se guardará como Saldo Final y se tomará como Saldo Inicial para el siguiente turno.
                        </p>
                    </div>
                )}

                {/* Movimientos Table */}
                <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-3xl overflow-hidden shadow-sm mt-8">
                    <div className="p-6 border-b border-slate-100 dark:border-zinc-800 bg-slate-50/50 dark:bg-zinc-800/30">
                        <h3 className="text-sm font-black uppercase tracking-widest flex items-center gap-2">
                            <span className="material-symbols-outlined text-primary">receipt_long</span>
                            Movimientos del Turno ({movimientos.length})
                        </h3>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead>
                                <tr className="bg-slate-50 dark:bg-zinc-800/50 border-b border-slate-200 dark:border-zinc-800">
                                    <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Fecha y Hora</th>
                                    <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Concepto</th>
                                    <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Tipo</th>
                                    <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400 text-right">Monto</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
                                {movimientos.length === 0 ? (
                                    <tr>
                                        <td colSpan={4} className="px-6 py-12 text-center text-slate-400">
                                            <span className="material-symbols-outlined text-4xl mb-2 block opacity-20">history</span>
                                            <p className="font-bold text-sm">No hay flujos de efectivo en este turno</p>
                                        </td>
                                    </tr>
                                ) : (
                                    movimientos.map((m, idx) => (
                                        <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-zinc-800/40 transition-colors">
                                            <td className="px-6 py-4 text-xs font-bold text-slate-500">
                                                {new Date(m.fecha).toLocaleString()}
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="font-black text-slate-900 dark:text-white uppercase tracking-tighter">
                                                    {m.concepto}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className={`px-2 py-1 rounded-md text-[10px] font-black uppercase tracking-widest ${m.tipo === 'ingreso' ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400'
                                                    : 'bg-rose-100 text-rose-600 dark:bg-rose-900/30 dark:text-rose-400'
                                                    }`}>
                                                    {m.tipo}
                                                </span>
                                            </td>
                                            <td className={`px-6 py-4 text-right text-sm font-black ${m.tipo === 'ingreso' ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
                                                }`}>
                                                {m.tipo === 'ingreso' ? '+' : '-'} $ {m.monto.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Historial de Cierres */}
                <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-3xl overflow-hidden shadow-sm mt-8">
                    <div className="p-6 border-b border-slate-100 dark:border-zinc-800 bg-slate-50/50 dark:bg-zinc-800/30">
                        <h3 className="text-sm font-black uppercase tracking-widest flex items-center gap-2">
                            <span className="material-symbols-outlined text-primary">history</span>
                            Historial de Últimos Cierres
                        </h3>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead>
                                <tr className="bg-slate-50 dark:bg-zinc-800/50 border-b border-slate-200 dark:border-zinc-800">
                                    <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Fecha Cierre</th>
                                    <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Saldo Inicial</th>
                                    <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Efectivo S/ Sistema</th>
                                    <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Efectivo Real</th>
                                    <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400 text-right">Diferencia</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
                                {historialCierres.length === 0 ? (
                                    <tr>
                                        <td colSpan={5} className="px-6 py-8 text-center text-slate-400 text-xs font-bold">
                                            No hay cierres registrados aún
                                        </td>
                                    </tr>
                                ) : (
                                    historialCierres.map((c, idx) => (
                                        <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-zinc-800/40 transition-colors">
                                            <td className="px-6 py-4 text-xs font-bold text-slate-500">
                                                {new Date(c.fecha_cierre).toLocaleString()}
                                            </td>
                                            <td className="px-6 py-4 text-xs font-bold text-slate-600 dark:text-slate-400">
                                                $ {c.saldo_inicial?.toLocaleString('es-AR')}
                                            </td>
                                            <td className="px-6 py-4 text-xs font-black text-slate-900 dark:text-white">
                                                $ {c.saldo_teorico?.toLocaleString('es-AR')}
                                            </td>
                                            <td className="px-6 py-4 text-xs font-black text-primary">
                                                $ {c.saldo_real?.toLocaleString('es-AR')}
                                            </td>
                                            <td className={`px-6 py-4 text-right text-xs font-black ${c.diferencia === 0 ? 'text-emerald-500' : c.diferencia > 0 ? 'text-blue-500' : 'text-rose-500'}`}>
                                                {c.diferencia === 0 ? 'OK' : `$ ${c.diferencia.toLocaleString('es-AR')}`}
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Cierre Modal */}
                {cierreModalOpen && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
                        <div className="bg-white dark:bg-zinc-900 rounded-3xl w-full max-w-2xl shadow-2xl overflow-hidden border border-slate-200 dark:border-zinc-800 animate-in fade-in zoom-in-95 duration-200">
                            <div className="p-6 border-b border-slate-100 dark:border-zinc-800 flex justify-between items-center">
                                <h2 className="text-xl font-black uppercase tracking-tight flex items-center gap-2">
                                    <span className="material-symbols-outlined text-primary">point_of_sale</span>
                                    Cerrar Caja
                                </h2>
                                <button onClick={() => setCierreModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                                    <span className="material-symbols-outlined">close</span>
                                </button>
                            </div>

                            <div className="p-6 space-y-6">
                                <div className="bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800 p-4 rounded-2xl flex gap-3">
                                    <span className="material-symbols-outlined text-amber-500">info</span>
                                    <p className="text-xs text-amber-800 dark:text-amber-200 font-bold leading-relaxed">
                                        El monto que ingreses aquí como <span className="underline">Saldo Real</span> será el efectivo que el sistema asumirá que queda disponible para comenzar el siguiente turno.
                                    </p>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="bg-slate-50 dark:bg-zinc-800/50 p-4 rounded-2xl">
                                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Efectivo Inicial</p>
                                        <p className="font-bold">$ {saldoInicial.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</p>
                                    </div>
                                    <div className="bg-slate-50 dark:bg-zinc-800/50 p-4 rounded-2xl border border-primary/20">
                                        <p className="text-[10px] font-black uppercase tracking-widest text-primary mb-1">Efectivo Teórico Final</p>
                                        <p className="font-black text-2xl text-primary">$ {saldoTeorico.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</p>
                                    </div>
                                </div>

                                <div>
                                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-2">Recuento de Arqueo Físico (Saldo Real)</label>
                                    <div className="relative">
                                        <span className="absolute left-4 top-1/2 -translate-y-1/2 font-black text-slate-400">$</span>
                                        <input
                                            type="number"
                                            className="w-full bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-2xl pl-10 pr-4 py-4 text-2xl font-black text-slate-900 dark:text-white focus:ring-2 focus:ring-primary/50"
                                            value={saldoReal}
                                            onChange={(e) => setSaldoReal(Number(e.target.value) || 0)}
                                        />
                                    </div>
                                </div>

                                <div className={`p-4 rounded-2xl flex items-center justify-between ${diferencia === 0 ? 'bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-200 dark:border-emerald-800' :
                                    diferencia > 0 ? 'bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-800' :
                                        'bg-rose-50 dark:bg-rose-900/10 border border-rose-200 dark:border-rose-800'
                                    }`}>
                                    <div>
                                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1">Diferencia de Arqueo</p>
                                        <p className={`font-black ${diferencia === 0 ? 'text-emerald-600' : diferencia > 0 ? 'text-blue-600' : 'text-rose-600'}`}>
                                            {diferencia === 0 ? 'Caja Cuadrada' :
                                                diferencia > 0 ? `Sobrante: $${diferencia}` : `Faltante: $${Math.abs(diferencia)}`}
                                        </p>
                                    </div>
                                    <span className="material-symbols-outlined text-4xl opacity-20">
                                        {diferencia === 0 ? 'verified' : 'warning'}
                                    </span>
                                </div>

                                <div>
                                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-2">Observaciones (Opcional)</label>
                                    <textarea
                                        className="w-full bg-slate-50 dark:bg-zinc-800/50 border-none rounded-2xl p-4 text-sm font-bold focus:ring-2 focus:ring-primary/50 resize-none h-24"
                                        placeholder="Motivo de la diferencia, billetes falsos, vales..."
                                        value={notasCierre}
                                        onChange={(e) => setNotasCierre(e.target.value)}
                                    ></textarea>
                                </div>
                            </div>

                            <div className="p-6 border-t border-slate-100 dark:border-zinc-800 flex gap-4 bg-slate-50/50 dark:bg-zinc-800/30">
                                <button
                                    onClick={() => setCierreModalOpen(false)}
                                    className="px-6 py-3 rounded-xl font-bold text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-zinc-700 transition-all"
                                >
                                    Cancelar
                                </button>
                                <button
                                    onClick={handleCierre}
                                    disabled={isSaving}
                                    className="flex-1 bg-primary hover:bg-primary/90 text-white font-black uppercase tracking-widest text-sm py-3 rounded-xl shadow-lg flex justify-center items-center gap-2 transition-all disabled:opacity-50"
                                >
                                    {isSaving ? (
                                        <div className="size-5 border-2 border-white/20 border-t-white rounded-full animate-spin"></div>
                                    ) : (
                                        <>
                                            <span className="material-symbols-outlined">save</span>
                                            Confirmar Cierre de Caja
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>
                )}
                {/* Egreso Modal */}
                {egresoModalOpen && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
                        <div className="bg-white dark:bg-zinc-900 rounded-3xl w-full max-w-md shadow-2xl overflow-hidden border border-slate-200 dark:border-zinc-800 animate-in fade-in zoom-in-95 duration-200">
                            <div className="p-6 border-b border-slate-100 dark:border-zinc-800 flex justify-between items-center">
                                <h2 className="text-xl font-black uppercase tracking-tight flex items-center gap-2">
                                    <span className="material-symbols-outlined text-rose-500">money_off</span>
                                    Registrar Egreso
                                </h2>
                                <button onClick={() => setEgresoModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                                    <span className="material-symbols-outlined">close</span>
                                </button>
                            </div>

                            <div className="p-6 space-y-4">
                                <div>
                                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-2 text-left">Monto a Retirar</label>
                                    <div className="relative">
                                        <span className="absolute left-4 top-1/2 -translate-y-1/2 font-black text-slate-400">$</span>
                                        <input
                                            type="number"
                                            className="w-full bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-2xl pl-10 pr-4 py-3 font-black text-slate-900 dark:text-white"
                                            placeholder="0.00"
                                            value={egresoForm.monto}
                                            onChange={(e) => setEgresoForm(prev => ({ ...prev, monto: e.target.value }))}
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-2 text-left">Concepto / Motivo</label>
                                    <input
                                        type="text"
                                        className="w-full bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-2xl px-4 py-3 font-bold text-slate-900 dark:text-white placeholder:text-slate-400 uppercase"
                                        placeholder="Ej: RETIRO DE DUEÑO, PAGO DE LUZ..."
                                        value={egresoForm.concepto}
                                        onChange={(e) => setEgresoForm(prev => ({ ...prev, concepto: e.target.value }))}
                                    />
                                </div>

                                <div>
                                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-2 text-left">Categoría de Egreso</label>
                                    <select
                                        className="w-full bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-2xl px-4 py-3 font-bold text-slate-900 dark:text-white outline-none focus:border-rose-500 transition-colors"
                                        value={egresoForm.categoria_gasto_id}
                                        onChange={(e) => setEgresoForm(prev => ({ ...prev, categoria_gasto_id: e.target.value }))}
                                    >
                                        <option value="">Seleccionar Categoría...</option>
                                        {categoriasGasto.map(cat => (
                                            <option key={cat.id} value={cat.id}>{cat.nombre}</option>
                                        ))}
                                    </select>
                                    {categoriasGasto.length === 0 && (
                                        <p className="text-[10px] text-rose-500 font-bold mt-1">
                                            No hay categorías de gastos creadas. Por favor, crea una primero.
                                        </p>
                                    )}
                                </div>

                                <button
                                    onClick={handleGuardarEgreso}
                                    disabled={isSaving}
                                    className="w-full bg-rose-500 hover:bg-rose-600 text-white font-black py-4 rounded-2xl shadow-lg shadow-rose-500/20 transition-all flex items-center justify-center gap-2 mt-4 disabled:opacity-50"
                                >
                                    {isSaving ? (
                                        <div className="size-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                    ) : (
                                        <>
                                            <span className="material-symbols-outlined">check_circle</span>
                                            GUARDAR EGRESO
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </Layout>
    );
}
