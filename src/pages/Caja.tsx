import { useState, useEffect } from 'react';
import { format, parseISO } from 'date-fns';
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
    const [saldoInicial, setSaldoInicial] = useState<number>(0);
    
    // Ingresos
    const [ingresosEfvo, setIngresosEfvo] = useState<number>(0);
    const [ingresosTransf, setIngresosTransf] = useState<number>(0);
    const [ingresosCheque, setIngresosCheque] = useState<number>(0);
    const [ingresosICheque, setIngresosICheque] = useState<number>(0);
    
    // Egresos
    const [egresosEfvo, setEgresosEfvo] = useState<number>(0);
    const [egresosTransf, setEgresosTransf] = useState<number>(0);
    const [montoRetirar, setMontoRetirar] = useState<number>(0);
    const [fondoCaja, setFondoCaja] = useState<number>(0);
    const [notasCierre, setNotasCierre] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const [selectedCierre, setSelectedCierre] = useState<any>(null);
    const [detalleCierreOpen, setDetalleCierreOpen] = useState(false);
    
    // ESTADO DEL TURNO REAL (Independiente de filtros)
    const [turnoActual, setTurnoActual] = useState({
        saldoInicial: 0,
        ingresosEfvo: 0,
        ingresosTotales: 0,
        ingresosTransf: 0,
        ingresosCheque: 0,
        ingresosICheque: 0,
        egresosEfvo: 0,
        egresosTotales: 0,
        egresosTransf: 0,
        balanceFisico: 0,
        fechaApertura: ''
    });
    const [egresoForm, setEgresoForm] = useState({ monto: '', concepto: '', categoria_gasto_id: '', forma_pago: 'efectivo' });
    const [categoriasGasto, setCategoriasGasto] = useState<any[]>([]);

    // Filter State
    const [dateRange, setDateRange] = useState({ from: '', to: '' });

    // Timeline State
    const [movimientos, setMovimientos] = useState<any[]>([]);
    const [historialCierres, setHistorialCierres] = useState<any[]>([]);

    useEffect(() => {
        fetchCajaResumen();
    }, [dateRange]);

    const fetchCajaResumen = async () => {
        setLoading(true);
        try {
            let fromDate: string | null = null;
            let toDate: string | null = null;
            let currentSaldoInicial = 0;
            const isCustomDate = dateRange.from !== '' || dateRange.to !== '';

            if (!isCustomDate) {
                // Modo Turno Actual
                const { data: cierres } = await supabase
                    .from('caja_cierres')
                    .select('*')
                    .order('fecha_cierre', { ascending: false })
                    .limit(1);

                if (cierres && cierres.length > 0) {
                    fromDate = cierres[0].fecha_cierre;
                    currentSaldoInicial = cierres[0].saldo_real;
                }

                if (!fromDate) {
                    const startOfDay = new Date();
                    startOfDay.setHours(0, 0, 0, 0);
                    fromDate = format(startOfDay, 'yyyy-MM-dd');
                }
            } else {
                if (dateRange.from) fromDate = new Date(dateRange.from + 'T00:00:00').toISOString();
                if (dateRange.to) toDate = new Date(dateRange.to + 'T23:59:59.999').toISOString();
                currentSaldoInicial = 0;
            }

            setSaldoInicial(currentSaldoInicial);

            // 1. Ingresos y Egresos de EFECTIVO (Siempre por TURNO o Filtro)
            const { data: pagosEfvoData } = await supabase
                .from('pagos')
                .select('id, monto, created_at')
                .eq('forma_pago', 'efectivo')
                .gte('created_at', fromDate)
                .lte('created_at', toDate || new Date().toISOString());

            const { data: gastosEfvoData } = await supabase
                .from('gastos')
                .select('id, monto, created_at')
                .eq('forma_pago', 'efectivo')
                .gte('created_at', fromDate)
                .lte('created_at', toDate || new Date().toISOString());

            const iEfvo = (pagosEfvoData || []).reduce((acc, curr) => acc + Number(curr.monto), 0);
            const eEfvo = (gastosEfvoData || []).reduce((acc, curr) => acc + Number(curr.monto), 0);

            setIngresosEfvo(iEfvo);
            setEgresosEfvo(eEfvo);

            // 2. Cobros y Egresos DIGITALES (Siempre CONSOLIDADO TOTAL a menos que haya filtro de fecha)
            let queryBancos = supabase
                .from('pagos')
                .select('id, monto, forma_pago, created_at')
                .neq('forma_pago', 'efectivo');
            
            let queryEgresosBancos = supabase
                .from('gastos')
                .select('id, monto, forma_pago, created_at')
                .eq('forma_pago', 'transferencia');

            // Si hay filtro de fecha (dashboard), lo aplicamos. 
            // Si no (modo turno), traemos los últimos 50 digitales para no sobrecargar.
            if (isCustomDate) {
                if (fromDate) queryBancos = queryBancos.gte('created_at', fromDate);
                if (toDate) queryBancos = queryBancos.lte('created_at', toDate);
                if (fromDate) queryEgresosBancos = queryEgresosBancos.gte('created_at', fromDate);
                if (toDate) queryEgresosBancos = queryEgresosBancos.lte('created_at', toDate);
            } else {
                queryBancos = queryBancos.order('created_at', { ascending: false }).limit(50);
                queryEgresosBancos = queryEgresosBancos.order('created_at', { ascending: false }).limit(50);
            }

            const { data: bancosData } = await queryBancos;
            const { data: eBancosData } = await queryEgresosBancos;
            
            let iTransf = 0, iCheque = 0, iICheque = 0;
            (bancosData || []).forEach(p => {
                const m = Number(p.monto);
                if (p.forma_pago === 'transferencia') iTransf += m;
                else if (p.forma_pago === 'cheque_terceros' || p.forma_pago === 'cheque') iCheque += m;
                else if (p.forma_pago === 'icheque') iICheque += m;
            });

            const eTransf = (eBancosData || []).reduce((acc, curr) => acc + Number(curr.monto), 0);

            setIngresosTransf(iTransf);
            setIngresosCheque(iCheque);
            setIngresosICheque(iICheque);
            setEgresosTransf(eTransf);
            
            // 3. Cálculo del Turno Actual (Para el modal de cierre)
            // Esto siempre debe ser desde el último cierre hasta AHORA
            setTurnoActual({
                saldoInicial: currentSaldoInicial,
                ingresosEfvo: iEfvo,
                egresosEfvo: eEfvo,
                balanceFisico: currentSaldoInicial + iEfvo - eEfvo,
                fechaApertura: fromDate || '',
                ingresosTotales: iEfvo + iTransf + iCheque + iICheque,
                ingresosTransf: iTransf,
                ingresosCheque: iCheque,
                ingresosICheque: iICheque,
                egresosTotales: eEfvo + eTransf,
                egresosTransf: eTransf
            });
            // 4. Movimientos combinados para la lista (Basados en el contexto actual)
            const combined = ([
                ...(pagosEfvoData || []).map(p => ({ ...p, forma_pago: 'efectivo', tipo: 'ingreso', label: 'COBRO EFECTIVO' })),
                ...(bancosData || []).map(p => ({ ...p, tipo: 'ingreso', label: `COBRO ${(p.forma_pago || 'digital').toUpperCase()}` })),
                ...(gastosEfvoData || []).map(g => ({ ...g, forma_pago: 'efectivo', tipo: 'egreso', label: 'GASTO EFECTIVO' })),
                ...(eBancosData || []).map(g => ({ ...g, forma_pago: 'transferencia', tipo: 'egreso', label: 'GASTO BANCARIO' }))
            ] as any[]).sort((a, b) => {
                const dateA = new Date(a.created_at || 0).getTime();
                const dateB = new Date(b.created_at || 0).getTime();
                return dateB - dateA;
            });

            setMovimientos(combined);

            // 4. Historial de Cierres (Enriquecimiento Manual para evitar errores de Join)
            const { data: cierresRaw, error: hError } = await supabase
                .from('caja_cierres')
                .select('*')
                .order('fecha_cierre', { ascending: false })
                .limit(10);
            
            if (hError) {
                console.error("Error cargando historial:", hError);
                setHistorialCierres([]);
            } else {
                // Enriquecer con perfiles uno a uno (como en StockHistorial)
                const cierresEnriquecidos = await Promise.all((cierresRaw || []).map(async (c) => {
                    if (c.usuario_id) {
                        const { data: prof } = await supabase
                            .from('profiles')
                            .select('nombre, apellido')
                            .eq('id', c.usuario_id)
                            .maybeSingle();
                        return { ...c, profiles: prof };
                    }
                    return c;
                }));
                setHistorialCierres(cierresEnriquecidos);
            }

            // Categorias
            const { data: catsData } = await supabase.from('categorias_gasto').select('*').order('nombre');
            setCategoriasGasto(catsData || []);

            // NUEVA LÓGICA: CALCULAR TURNO REAL PARA EL CIERRE (Independiente de filtros)
            const { data: cierresData } = await supabase
                .from('caja_cierres')
                .select('*')
                .order('fecha_cierre', { ascending: false })
                .limit(1);

            let realFrom = cierresData?.[0]?.fecha_cierre || null;
            let realSaldoIni = cierresData?.[0]?.saldo_real || 0;

            let queryActualPagos = supabase.from('pagos').select('monto, forma_pago');
            let queryActualGastos = supabase.from('gastos').select('monto, forma_pago');
            
            if (realFrom) {
                queryActualPagos = queryActualPagos.gte('created_at', realFrom);
                queryActualGastos = queryActualGastos.gte('created_at', realFrom);
            }

            const [{ data: aPagos }, { data: aGastos }] = await Promise.all([
                queryActualPagos,
                queryActualGastos
            ]);

            let aIngEfvo = 0, aIngTot = 0, aEgrEfvo = 0, aEgrTot = 0;
            let aIngTransf = 0, aIngCheque = 0, aIngICheque = 0, aEgrTransf = 0;

            (aPagos || []).forEach(p => {
                const m = Number(p.monto);
                aIngTot += m;
                if (p.forma_pago === 'efectivo') aIngEfvo += m;
                else if (p.forma_pago === 'transferencia') aIngTransf += m;
                else if (p.forma_pago === 'cheque_terceros') aIngCheque += m;
                else if (p.forma_pago === 'icheque') aIngICheque += m;
            });

            (aGastos || []).forEach(g => {
                const m = Number(g.monto);
                aEgrTot += m;
                if (g.forma_pago === 'efectivo') aEgrEfvo += m;
                else if (g.forma_pago === 'transferencia') aEgrTransf += m;
            });

            setTurnoActual({
                saldoInicial: realSaldoIni,
                ingresosEfvo: aIngEfvo,
                ingresosTotales: aIngTot,
                ingresosTransf: aIngTransf,
                ingresosCheque: aIngCheque,
                ingresosICheque: aIngICheque,
                egresosEfvo: aEgrEfvo,
                egresosTotales: aEgrTot,
                egresosTransf: aEgrTransf,
                balanceFisico: realSaldoIni + aIngEfvo - aEgrEfvo,
                fechaApertura: realFrom || ''
            });

        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const handleRealizarCierre = async () => {
        // En el nuevo sistema, el usuario declara cuanto retira y cuanto deja
        // La suma de ambos es lo que físicamente "había" en la caja.
        const efectivoTotalDeclarado = Number(montoRetirar) + Number(fondoCaja);
        
        setIsSaving(true);
        try {
            // USAMOS LOS VALORES DEL TURNO REAL, NO LOS FILTRADOS
            const saldoTeoricoFisico = turnoActual.balanceFisico;
            const diferencia = efectivoTotalDeclarado - saldoTeoricoFisico;

            const notaFinal = `RETIRO: $${montoRetirar.toLocaleString()} | FONDO: $${fondoCaja.toLocaleString()} ${notasCierre ? ' - ' + notasCierre : ''}`;

            const nuevoCierre = {
                fecha_apertura: turnoActual.fechaApertura && turnoActual.fechaApertura !== 'Inicio de sistema' ? turnoActual.fechaApertura : new Date().toISOString(),
                fecha_cierre: new Date().toISOString(),
                saldo_inicial: turnoActual.saldoInicial,
                total_ingresos: turnoActual.ingresosTotales,
                total_egresos: turnoActual.egresosTotales,
                total_efectivo: turnoActual.ingresosEfvo,
                total_transferencia: turnoActual.ingresosTransf,
                total_cheque: turnoActual.ingresosCheque,
                total_icheque: turnoActual.ingresosICheque,
                saldo_teorico: saldoTeoricoFisico,
                saldo_real: fondoCaja, // El saldo real que QUEDA para el próximo turno
                diferencia: diferencia,
                usuario_id: user?.id,
                notas: notaFinal
            };

            const { error } = await supabase.from('caja_cierres').insert([nuevoCierre]);
            if (error) throw error;

            alert("Cierre de caja guardado exitosamente.");
            setCierreModalOpen(false);
            fetchCajaResumen();
        } catch (err) {
            console.error(err);
            alert("Error al guardar el cierre");
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
                forma_pago: egresoForm.forma_pago,
                fecha: new Date().toISOString().split('T')[0],
                usuario_id: user?.id,
                created_at: new Date().toISOString()
            }]);

            if (error) throw error;

            alert("Egreso registrado correctamente");
            setEgresoModalOpen(false);
            setEgresoForm({ monto: '', concepto: '', categoria_gasto_id: '', forma_pago: 'efectivo' });
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

    // Cálculos de Balance
    const balanceFisico = saldoInicial + ingresosEfvo - egresosEfvo;
    const balanceBancario = ingresosTransf + ingresosICheque - egresosTransf;

    return (
        <Layout>
            <MainHeader title="Balance y Control de Caja">
                <span className="px-3 py-1 bg-primary/10 text-primary text-[10px] font-black uppercase tracking-widest rounded-full border border-primary/20">Finanzas Globales</span>
            </MainHeader>

            <div className="p-4 lg:p-8 max-w-[1600px] mx-auto w-full space-y-6 pb-24 lg:pb-8">
                
                {/* Filtros */}
                <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-[2rem] p-6 shadow-sm flex flex-col lg:flex-row items-center gap-6 justify-between">
                    <div className="flex items-center gap-4">
                        <div className="bg-primary/10 p-3 rounded-2xl">
                            <span className="material-symbols-outlined text-primary text-3xl">account_balance</span>
                        </div>
                        <div>
                            <h2 className="text-xl font-black tracking-tight">Estado de Cuentas</h2>
                            <p className="text-xs text-slate-500 font-medium">Control de flujos físico y digital</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-4 w-full lg:w-auto">
                        <div className="flex-1 lg:w-48">
                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1 ml-1">Desde</label>
                            <input
                                type="date"
                                className="w-full bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-2xl px-4 py-2 text-xs font-bold"
                                value={dateRange.from}
                                onChange={(e) => setDateRange(prev => ({ ...prev, from: e.target.value }))}
                            />
                        </div>
                        <div className="flex-1 lg:w-48">
                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1 ml-1">Hasta</label>
                            <input
                                type="date"
                                className="w-full bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-2xl px-4 py-2 text-xs font-bold"
                                value={dateRange.to}
                                onChange={(e) => setDateRange(prev => ({ ...prev, to: e.target.value }))}
                            />
                        </div>
                        <button 
                            onClick={() => setDateRange({ from: '', to: '' })}
                            className="mt-5 h-[40px] px-3 bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 text-slate-500 rounded-xl transition-all"
                            title="Limpiar filtros"
                        >
                            <span className="material-symbols-outlined">restart_alt</span>
                        </button>
                    </div>
                </div>

                {/* NUEVO: Balance Total de la Empresa */}
                <div className="bg-gradient-to-br from-slate-900 to-zinc-900 dark:from-black dark:to-zinc-950 rounded-[3rem] p-8 lg:p-12 shadow-2xl border border-white/10 relative overflow-hidden mb-8">
                    <div className="absolute top-0 right-0 w-96 h-96 bg-primary/20 rounded-full blur-[100px] -mr-48 -mt-48 animate-pulse"></div>
                    <div className="relative z-10 flex flex-col lg:flex-row items-center justify-between gap-8">
                        <div className="flex-1 text-center lg:text-left">
                            <div className="inline-flex items-center gap-2 px-3 py-1 bg-white/10 backdrop-blur-md rounded-full border border-white/20 mb-6">
                                <span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse"></span>
                                <span className="text-[10px] font-black uppercase tracking-widest text-white/70">Situación Patrimonial</span>
                            </div>
                            <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-white/40 mb-2">Capital Total de la Empresa</h2>
                            <div className="flex items-baseline gap-4 justify-center lg:justify-start">
                                <span className="text-4xl lg:text-6xl font-black text-white">$</span>
                                <h1 className="text-5xl lg:text-7xl xl:text-8xl font-black text-white tracking-tighter leading-none">
                                    {(balanceFisico + balanceBancario + ingresosCheque).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                                    <span className="text-xl lg:text-3xl text-white/30 ml-4">ARS</span>
                                </h1>
                            </div>
                        </div>
                        
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 w-full lg:w-auto">
                            <div className="bg-white/5 backdrop-blur-md p-6 rounded-3xl border border-white/10">
                                <p className="text-[10px] font-black text-white/40 uppercase tracking-widest mb-2">Efectivo</p>
                                <p className="text-2xl font-black text-white">$ {balanceFisico.toLocaleString('es-AR')}</p>
                            </div>
                            <div className="bg-white/5 backdrop-blur-md p-6 rounded-3xl border border-white/10">
                                <p className="text-[10px] font-black text-white/40 uppercase tracking-widest mb-2">Bancos / Digital</p>
                                <p className="text-2xl font-black text-white">$ {balanceBancario.toLocaleString('es-AR')}</p>
                            </div>
                            <div className="bg-white/5 backdrop-blur-md p-6 rounded-3xl border border-white/10">
                                <p className="text-[10px] font-black text-white/40 uppercase tracking-widest mb-2">Cheques Cartera</p>
                                <p className="text-2xl font-black text-white">$ {ingresosCheque.toLocaleString('es-AR')}</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Balances Principales */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Tarjeta Efectivo */}
                    <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-[2.5rem] p-8 shadow-xl relative overflow-hidden group">
                        <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:scale-110 transition-transform">
                            <span className="material-symbols-outlined text-8xl text-primary">payments</span>
                        </div>
                        <div className="relative z-10 space-y-6">
                            <div className="flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full bg-primary animate-pulse"></span>
                                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Caja Física (En Mano)</span>
                            </div>
                            <h3 className="text-5xl font-black text-slate-900 dark:text-white tracking-tighter">
                                $ {balanceFisico.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                            </h3>
                            <div className="grid grid-cols-2 gap-4 pt-4 border-t border-slate-100 dark:border-zinc-800">
                                <div>
                                    <p className="text-[9px] font-black text-slate-400 uppercase mb-1">Cobros Efvo (+)</p>
                                    <p className="text-sm font-black text-emerald-500">$ {ingresosEfvo.toLocaleString('es-AR')}</p>
                                </div>
                                <div>
                                    <p className="text-[9px] font-black text-slate-400 uppercase mb-1">Pagos Efvo (-)</p>
                                    <p className="text-sm font-black text-rose-500">$ {egresosEfvo.toLocaleString('es-AR')}</p>
                                </div>
                            </div>
                            <button 
                                onClick={() => setCierreModalOpen(true)}
                                className="w-full bg-slate-900 dark:bg-white dark:text-zinc-900 text-white font-black py-4 rounded-2xl hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-2"
                            >
                                <span className="material-symbols-outlined">point_of_sale</span>
                                REALIZAR CIERRE DE CAJA
                            </button>
                        </div>
                    </div>

                    {/* Tarjeta Bancaria */}
                    <div className="bg-emerald-500 dark:bg-emerald-600 border border-emerald-400 dark:border-emerald-700 rounded-[2.5rem] p-8 shadow-xl relative overflow-hidden group">
                        <div className="absolute top-0 right-0 p-8 opacity-20 group-hover:scale-110 transition-transform text-white">
                            <span className="material-symbols-outlined text-8xl">account_balance</span>
                        </div>
                        <div className="relative z-10 space-y-6">
                            <div className="flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full bg-white"></span>
                                <span className="text-[10px] font-black uppercase tracking-widest text-white/60">Cuentas Digitales / Bancos</span>
                            </div>
                            <h3 className="text-5xl font-black text-white tracking-tighter">
                                $ {balanceBancario.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                            </h3>
                            <div className="grid grid-cols-2 gap-4 pt-4 border-t border-white/20">
                                <div>
                                    <p className="text-[9px] font-black text-white/60 uppercase mb-1">Transferencias Recibidas (+)</p>
                                    <p className="text-sm font-black text-white">+ $ {(ingresosTransf + ingresosICheque).toLocaleString('es-AR')}</p>
                                </div>
                                <div>
                                    <p className="text-[9px] font-black text-white/60 uppercase mb-1">Egresos Bancarios (-)</p>
                                    <p className="text-sm font-black text-emerald-900">- $ {egresosTransf.toLocaleString('es-AR')}</p>
                                </div>
                            </div>
                            <div className="bg-black/10 rounded-2xl p-4 flex items-center justify-between border border-white/10">
                                <span className="text-[10px] font-black text-white/60 uppercase">Impacto en Turno</span>
                                <span className="text-sm font-black text-white">Consolidado Digital</span>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Botón de Egreso Rápido */}
                    <div className="lg:col-span-1">
                        <button 
                            onClick={() => setEgresoModalOpen(true)}
                            className="w-full h-full bg-rose-500 hover:bg-rose-600 text-white rounded-[2rem] p-8 flex flex-col items-center justify-center gap-4 transition-all hover:shadow-2xl hover:shadow-rose-500/30 group"
                        >
                            <div className="bg-white/20 p-4 rounded-full group-hover:scale-110 transition-transform">
                                <span className="material-symbols-outlined text-4xl">logout</span>
                            </div>
                            <div className="text-center">
                                <span className="text-xl font-black block uppercase">Registrar Retiro / Gasto</span>
                                <span className="text-[10px] font-bold opacity-80 uppercase tracking-widest italic">Sacar dinero de caja o banco</span>
                            </div>
                        </button>
                    </div>

                    {/* Tabla de Medios de Pago */}
                    <div className="lg:col-span-2 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-[2.5rem] p-8 shadow-sm overflow-hidden">
                        <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-6">Desglose Detallado por Medio de Pago</h4>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            {[
                                { label: 'Efectivo', ing: ingresosEfvo, egr: egresosEfvo, icon: 'payments', color: 'bg-emerald-500' },
                                { label: 'Transferencia', ing: ingresosTransf, egr: egresosTransf, icon: 'sync_alt', color: 'bg-primary' },
                                { label: 'iCheque', ing: ingresosICheque, egr: 0, icon: 'contactless', color: 'bg-indigo-500' },
                                { label: 'Cheque Físico', ing: ingresosCheque, egr: 0, icon: 'description', color: 'bg-amber-500' },
                            ].map((m) => (
                                <div key={m.label} className="p-4 bg-slate-50 dark:bg-zinc-800/50 rounded-2xl border border-slate-100 dark:border-zinc-800 hover:shadow-lg transition-shadow">
                                    <div className="flex items-center gap-3 mb-4">
                                        <div className={`p-2 rounded-xl ${m.color} text-white shadow-lg`}>
                                            <span className="material-symbols-outlined text-base leading-none block">{m.icon}</span>
                                        </div>
                                        <span className="text-xs font-black uppercase tracking-tight">{m.label}</span>
                                    </div>
                                    <div className="flex justify-between items-end">
                                        <div>
                                            <span className="block text-[8px] font-bold text-slate-400 uppercase mb-1">Ingresos (+)</span>
                                            <span className="text-sm font-black text-emerald-500">+${m.ing.toLocaleString('es-AR')}</span>
                                        </div>
                                        <div className="text-right">
                                            <span className="block text-[8px] font-bold text-slate-400 uppercase mb-1">Egresos (-)</span>
                                            <span className="text-sm font-black text-rose-500">-${m.egr.toLocaleString('es-AR')}</span>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Movimientos del Turno */}
                <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-[2.5rem] overflow-hidden shadow-sm">
                    <div className="p-6 border-b border-slate-100 dark:border-zinc-800 flex justify-between items-center">
                        <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400">Movimientos del Período ({movimientos.length})</h4>
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
                                {movimientos.map((mov) => (
                                    <tr key={`${mov.tipo}-${mov.id}`} className="hover:bg-slate-50 dark:hover:bg-zinc-800/40 transition-colors">
                                        <td className="px-6 py-4 text-xs font-bold text-slate-500">
                                            {mov.created_at ? format(parseISO(mov.created_at), 'dd/MM/yyyy, HH:mm:ss') : 'S/F'}
                                        </td>
                                        <td className="px-6 py-4 text-xs font-black uppercase tracking-tighter">
                                            {mov.label}
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className={`px-2 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest ${
                                                mov.tipo === 'ingreso' ? 'bg-emerald-100 text-emerald-600' : 'bg-rose-100 text-rose-600'
                                            }`}>
                                                {mov.tipo}
                                            </span>
                                        </td>
                                        <td className={`px-6 py-4 text-right text-sm font-black ${
                                            mov.tipo === 'ingreso' ? 'text-emerald-600' : 'text-rose-600'
                                        }`}>
                                            {mov.tipo === 'ingreso' ? '+' : '-'} $ {Number(mov.monto).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Historial de Cierres */}
                <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-[2.5rem] overflow-hidden shadow-sm">
                    <div className="p-6 border-b border-slate-100 dark:border-zinc-800 flex justify-between items-center">
                        <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400">Historial de Cierres Recientes</h4>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead>
                                <tr className="bg-slate-50 dark:bg-zinc-800/50 border-b border-slate-200 dark:border-zinc-800">
                                    <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Fecha Cierre</th>
                                    <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Responsable</th>
                                    <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400 text-right">Saldo Real (Fondo)</th>
                                    <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400 text-right">Diferencia</th>
                                    <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400 text-center">Acción</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
                                {historialCierres.map((cierre) => (
                                    <tr key={cierre.id} className="hover:bg-slate-50 dark:hover:bg-zinc-800/40 transition-colors">
                                        <td className="px-6 py-4 text-xs font-bold text-slate-500">
                                            {format(parseISO(cierre.fecha_cierre), 'dd/MM/yyyy, HH:mm')}
                                        </td>
                                        <td className="px-6 py-4 text-xs font-black uppercase tracking-tighter">
                                            {cierre.profiles ? `${cierre.profiles.nombre} ${cierre.profiles.apellido}` : 'SISTEMA / NO ASIGNADO'}
                                        </td>
                                        <td className="px-6 py-4 text-right text-sm font-black text-primary">
                                            $ {Number(cierre.saldo_real).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                                        </td>
                                        <td className={`px-6 py-4 text-right text-sm font-black ${
                                            cierre.diferencia === 0 ? 'text-emerald-600' : 'text-amber-600'
                                        }`}>
                                            $ {Number(cierre.diferencia).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            <button 
                                                onClick={() => {
                                                    setSelectedCierre(cierre);
                                                    setDetalleCierreOpen(true);
                                                }}
                                                className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-zinc-800 text-slate-400 hover:bg-primary hover:text-white transition-all inline-flex items-center justify-center"
                                            >
                                                <span className="material-symbols-outlined text-sm">visibility</span>
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                                {historialCierres.length === 0 && (
                                    <tr>
                                        <td colSpan={5} className="px-6 py-12 text-center">
                                            <span className="material-symbols-outlined text-slate-200 text-5xl mb-2">history</span>
                                            <p className="text-xs font-black text-slate-400 uppercase tracking-widest">No hay cierres registrados aún</p>
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {/* Modal Cierre */}
            {cierreModalOpen && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
                    <div className="bg-white dark:bg-zinc-900 rounded-[2.5rem] w-full max-w-md shadow-2xl overflow-hidden border border-slate-200 dark:border-zinc-800">
                        <div className="p-8 border-b border-slate-100 dark:border-zinc-800 flex justify-between items-center bg-slate-900 text-white">
                            <h2 className="text-xl font-black uppercase tracking-tight flex items-center gap-2">
                                <span className="material-symbols-outlined">point_of_sale</span>
                                Cierre de Caja
                            </h2>
                            <button onClick={() => setCierreModalOpen(false)} className="text-white/50 hover:text-white">
                                <span className="material-symbols-outlined">close</span>
                            </button>
                        </div>

                        <div className="p-8 space-y-6">
                            <div className="bg-primary/5 p-6 rounded-3xl border border-primary/10">
                                <p className="text-[10px] font-black uppercase tracking-widest text-primary mb-1">Saldo Teórico (Turno Actual)</p>
                                <p className="text-4xl font-black text-primary">$ {turnoActual.balanceFisico.toLocaleString('es-AR')}</p>
                                <p className="text-[8px] font-bold text-slate-400 mt-2 uppercase tracking-tighter italic">
                                    Calculado desde: {turnoActual.fechaApertura && turnoActual.fechaApertura !== 'Inicio de sistema' 
                                        ? format(parseISO(turnoActual.fechaApertura), 'dd/MM/yyyy HH:mm') 
                                        : 'Primera apertura'}
                                </p>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black uppercase text-slate-400 ml-1 text-left block">Monto a Retirar ($)</label>
                                    <div className="relative">
                                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold">$</span>
                                        <input
                                            type="number"
                                            className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-8 py-4 font-black text-xl text-primary focus:border-primary focus:ring-0 transition-all outline-none"
                                            value={montoRetirar}
                                            onChange={(e) => setMontoRetirar(Number(e.target.value))}
                                            placeholder="0.00"
                                        />
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black uppercase text-slate-400 ml-1 text-left block">Fondo de Caja (Se queda)</label>
                                    <div className="relative">
                                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold">$</span>
                                        <input
                                            type="number"
                                            className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-8 py-4 font-black text-xl text-primary focus:border-primary focus:ring-0 transition-all outline-none"
                                            value={fondoCaja}
                                            onChange={(e) => setFondoCaja(Number(e.target.value))}
                                            placeholder="0.00"
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className={`p-4 rounded-2xl border-2 flex items-center justify-between ${
                                Math.abs((Number(montoRetirar) + Number(fondoCaja)) - turnoActual.balanceFisico) < 1 
                                ? 'bg-emerald-50 border-emerald-100 text-emerald-600'
                                : 'bg-amber-50 border-amber-100 text-amber-600'
                            }`}>
                                <div className="text-left">
                                    <p className="text-[10px] font-black uppercase">Diferencia de Arqueo</p>
                                    <p className="text-xl font-black">
                                        $ {((Number(montoRetirar) + Number(fondoCaja)) - turnoActual.balanceFisico).toLocaleString('es-AR')}
                                    </p>
                                </div>
                                <div className="text-right">
                                    <p className="text-[8px] font-bold uppercase opacity-60 text-right">Total Contado</p>
                                    <p className="text-sm font-black">$ {(Number(montoRetirar) + Number(fondoCaja)).toLocaleString('es-AR')}</p>
                                </div>
                            </div>

                            <div>
                                <label className="text-[10px] font-black uppercase text-slate-400 ml-1 text-left block mb-2">Observaciones</label>
                                <textarea
                                    className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-4 py-3 text-sm text-slate-600 focus:border-primary focus:ring-0 transition-all outline-none min-h-[80px]"
                                    value={notasCierre}
                                    onChange={(e) => setNotasCierre(e.target.value)}
                                    placeholder="Detalles sobre sobrantes, faltantes o aclaraciones..."
                                />
                            </div>

                            <button
                                onClick={handleRealizarCierre}
                                disabled={isSaving}
                                className="w-full bg-slate-900 dark:bg-white dark:text-zinc-900 text-white font-black py-5 rounded-2xl shadow-xl transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                            >
                                {isSaving ? 'GUARDANDO...' : 'CONFIRMAR Y CERRAR TURNO'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal Egreso */}
            {egresoModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
                    <div className="bg-white dark:bg-zinc-900 rounded-[2.5rem] w-full max-w-md shadow-2xl overflow-hidden border border-slate-200 dark:border-zinc-800 animate-in fade-in zoom-in-95 duration-200">
                        <div className="p-8 border-b border-slate-100 dark:border-zinc-800 flex justify-between items-center bg-rose-500 text-white">
                            <h2 className="text-xl font-black uppercase tracking-tight flex items-center gap-2">
                                <span className="material-symbols-outlined">outbox</span>
                                Registrar Retiro / Gasto
                            </h2>
                            <button onClick={() => setEgresoModalOpen(false)} className="text-white/50 hover:text-white transition-colors">
                                <span className="material-symbols-outlined">close</span>
                            </button>
                        </div>

                        <div className="p-8 space-y-6">
                            <div>
                                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-2 text-left">Monto a Retirar / Gastar</label>
                                <div className="relative">
                                    <span className="absolute left-4 top-1/2 -translate-y-1/2 font-black text-slate-400 text-xl">$</span>
                                    <input
                                        type="number"
                                        className="w-full bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-2xl pl-10 pr-4 py-4 font-black text-2xl text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-rose-500/50 transition-all"
                                        placeholder="0.00"
                                        value={egresoForm.monto}
                                        onChange={(e) => setEgresoForm(prev => ({ ...prev, monto: e.target.value }))}
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-2 text-left">Concepto / Motivo Detallado</label>
                                <input
                                    type="text"
                                    className="w-full bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-2xl px-4 py-4 font-bold text-slate-900 dark:text-white placeholder:text-slate-400 uppercase outline-none focus:ring-2 focus:ring-rose-500/50"
                                    placeholder="Ej: RETIRO DE DUEÑO, PAGO DE LUZ..."
                                    value={egresoForm.concepto}
                                    onChange={(e) => setEgresoForm(prev => ({ ...prev, concepto: e.target.value }))}
                                />
                            </div>

                            <div className="grid grid-cols-1 gap-4">
                                <div>
                                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-2 text-left">Categoría de Egreso</label>
                                    <select
                                        className="w-full bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-2xl px-4 py-4 font-bold text-slate-900 dark:text-white outline-none focus:border-rose-500 transition-colors"
                                        value={egresoForm.categoria_gasto_id}
                                        onChange={(e) => setEgresoForm(prev => ({ ...prev, categoria_gasto_id: e.target.value }))}
                                    >
                                        <option value="">Seleccionar Categoría...</option>
                                        {categoriasGasto.map(cat => (
                                            <option key={cat.id} value={cat.id}>{cat.nombre}</option>
                                        ))}
                                    </select>
                                </div>

                                <div>
                                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-2 text-left">Forma de Pago / Salida</label>
                                    <div className="grid grid-cols-2 gap-3">
                                        <button
                                            onClick={() => setEgresoForm(prev => ({ ...prev, forma_pago: 'efectivo' }))}
                                            className={`py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest border transition-all flex flex-col items-center gap-1 ${
                                                egresoForm.forma_pago === 'efectivo' 
                                                ? 'bg-rose-500 border-rose-500 text-white shadow-xl shadow-rose-500/30' 
                                                : 'bg-slate-50 dark:bg-zinc-800 border-slate-200 dark:border-zinc-700 text-slate-400 hover:bg-slate-100'
                                            }`}
                                        >
                                            <span className="material-symbols-outlined text-base">payments</span>
                                            Efectivo
                                        </button>
                                        <button
                                            onClick={() => setEgresoForm(prev => ({ ...prev, forma_pago: 'transferencia' }))}
                                            className={`py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest border transition-all flex flex-col items-center gap-1 ${
                                                egresoForm.forma_pago === 'transferencia' 
                                                ? 'bg-primary border-primary text-white shadow-xl shadow-primary/30' 
                                                : 'bg-slate-50 dark:bg-zinc-800 border-slate-200 dark:border-zinc-700 text-slate-400 hover:bg-slate-100'
                                            }`}
                                        >
                                            <span className="material-symbols-outlined text-base">sync_alt</span>
                                            Transferencia
                                        </button>
                                    </div>
                                </div>
                            </div>

                            <button
                                onClick={handleGuardarEgreso}
                                disabled={isSaving}
                                className="w-full bg-slate-900 dark:bg-white dark:text-zinc-900 text-white font-black py-5 rounded-2xl shadow-2xl transition-all flex items-center justify-center gap-3 mt-4 disabled:opacity-50 hover:scale-[1.02] active:scale-[0.98]"
                            >
                                <span className="material-symbols-outlined">check_circle</span>
                                {isSaving ? 'GUARDANDO...' : 'CONFIRMAR RETIRO / GASTO'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
            {/* Modal Detalle Cierre */}
            {detalleCierreOpen && selectedCierre && (
                <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
                    <div className="bg-white dark:bg-zinc-900 rounded-[2.5rem] w-full max-w-lg shadow-2xl overflow-hidden border border-slate-200 dark:border-zinc-800 animate-in fade-in zoom-in-95 duration-200">
                        <div className="p-8 border-b border-slate-100 dark:border-zinc-800 flex justify-between items-center bg-primary text-white">
                            <div>
                                <h2 className="text-xl font-black uppercase tracking-tight flex items-center gap-2">
                                    <span className="material-symbols-outlined">receipt_long</span>
                                    Detalle de Cierre
                                </h2>
                                <p className="text-[10px] font-bold opacity-60 uppercase tracking-widest mt-1">
                                    Cerrado el {format(parseISO(selectedCierre.fecha_cierre), 'dd/MM/yyyy HH:mm')}
                                </p>
                            </div>
                            <button onClick={() => setDetalleCierreOpen(false)} className="text-white/50 hover:text-white transition-colors">
                                <span className="material-symbols-outlined">close</span>
                            </button>
                        </div>

                        <div className="p-8 space-y-6">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="p-4 bg-slate-50 dark:bg-zinc-800 rounded-2xl border border-slate-100 dark:border-zinc-700">
                                    <p className="text-[8px] font-black uppercase text-slate-400 mb-1">Saldo Inicial</p>
                                    <p className="text-lg font-black text-slate-600">$ {Number(selectedCierre.saldo_inicial).toLocaleString('es-AR')}</p>
                                </div>
                                <div className="p-4 bg-slate-50 dark:bg-zinc-800 rounded-2xl border border-slate-100 dark:border-zinc-700">
                                    <p className="text-[8px] font-black uppercase text-slate-400 mb-1">Efectivo Rendido</p>
                                    <p className="text-lg font-black text-emerald-600">$ {Number(selectedCierre.total_efectivo).toLocaleString('es-AR')}</p>
                                </div>
                            </div>

                            <div className="space-y-4">
                                <div className="flex justify-between items-center border-b border-slate-100 dark:border-zinc-800 pb-2">
                                    <p className="text-[10px] font-black uppercase text-slate-400">Total Ingresos</p>
                                    <p className="text-sm font-black text-emerald-600">$ {Number(selectedCierre.total_ingresos).toLocaleString('es-AR')}</p>
                                </div>
                                <div className="flex justify-between items-center border-b border-slate-100 dark:border-zinc-800 pb-2">
                                    <p className="text-[10px] font-black uppercase text-slate-400">Total Egresos</p>
                                    <p className="text-sm font-black text-rose-600">$ {Number(selectedCierre.total_egresos).toLocaleString('es-AR')}</p>
                                </div>
                                <div className="flex justify-between items-center border-b border-slate-100 dark:border-zinc-800 pb-2">
                                    <p className="text-[10px] font-black uppercase text-slate-400">Transferencias</p>
                                    <p className="text-sm font-black text-primary">$ {Number(selectedCierre.total_transferencia).toLocaleString('es-AR')}</p>
                                </div>
                                <div className="flex justify-between items-center border-b border-slate-100 dark:border-zinc-800 pb-2">
                                    <p className="text-[10px] font-black uppercase text-slate-400">Diferencia de Arqueo</p>
                                    <p className={`text-sm font-black ${selectedCierre.diferencia < 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                                        $ {Number(selectedCierre.diferencia).toLocaleString('es-AR')}
                                    </p>
                                </div>
                            </div>

                            <div className="p-5 bg-primary/5 rounded-3xl border border-primary/10">
                                <p className="text-[10px] font-black uppercase text-primary mb-1">Saldo que quedó en caja (Fondo)</p>
                                <p className="text-3xl font-black text-primary">$ {Number(selectedCierre.saldo_real).toLocaleString('es-AR')}</p>
                            </div>

                            {selectedCierre.notas && (
                                <div className="p-4 bg-amber-50 rounded-2xl border border-amber-100">
                                    <p className="text-[8px] font-black uppercase text-amber-400 mb-1">Notas del Cierre</p>
                                    <p className="text-xs font-bold text-amber-700 italic">"{selectedCierre.notas}"</p>
                                </div>
                            )}

                            <button
                                onClick={() => setDetalleCierreOpen(false)}
                                className="w-full bg-slate-900 text-white font-black py-4 rounded-2xl shadow-xl transition-all"
                            >
                                CERRAR DETALLE
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </Layout>
    );
}
