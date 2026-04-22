import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import Layout from '../components/Layout';
import MainHeader from '../components/MainHeader';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/authStore';
import { generateSaleTicket } from '../utils/pdfGenerator';

interface Cliente {
    id: string;
    razon_social: string;
    nombre_fantasia: string | null;
    cuit: string;
    dni: string;
    tipo: 'minorista' | 'mayorista' | 'revendedor';
    saldo_actual: number;
    limite_credito: number;
}

interface Producto {
    id: string;
    codigo: string | null;
    nombre: string;
    stock_actual: number;
    precio_costo: number;
    precio_minorista: number;
    precio_mayorista: number;
    precio_revendedor: number;
}

interface CartItem extends Producto {
    cantidad: number;
    precio_unitario: number;
    subtotal: number;
    tipo_precio: 'minorista' | 'mayorista' | 'revendedor';
}

const NuevaVenta: React.FC = () => {
    const navigate = useNavigate();
    const { user } = useAuthStore();

    const [clientes, setClientes] = useState<Cliente[]>([]);
    const [productos, setProductos] = useState<Producto[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    // Form State
    const [selectedCliente, setSelectedCliente] = useState<Cliente | null>(null);
    const [cart, setCart] = useState<CartItem[]>([]);
    const [formaPago, setFormaPago] = useState<'efectivo' | 'transferencia' | 'cheque' | 'icheque' | 'cuenta_corriente'>('cuenta_corriente');
    const [montoPago, setMontoPago] = useState<number>(0);
    const [referenciaPago, setReferenciaPago] = useState('');
    const [fechaVencimiento, setFechaVencimiento] = useState(new Date().toISOString().split('T')[0]);
    const [searchProduct, setSearchProduct] = useState('');
    const [filteredProducts, setFilteredProducts] = useState<Producto[]>([]);
    const [productDropdown, setProductDropdown] = useState(false);

    const [searchCliente, setSearchCliente] = useState('');
    const [filteredClientes, setFilteredClientes] = useState<Cliente[]>([]);
    const [clienteDropdown, setClienteDropdown] = useState(false);

    const productSearchRef = useRef<HTMLDivElement>(null);
    const clienteSearchRef = useRef<HTMLDivElement>(null);

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const { data: clientsData } = await supabase.from('clientes').select('*').order('razon_social');
            const { data: productsData } = await supabase.from('productos').select('*').order('nombre');
            setClientes(clientsData || []);
            setProductos(productsData || []);
        } catch (error) {
            console.error('Error fetching data:', error);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    // Derived Totals
    const subtotal = cart.reduce((acc, item) => acc + item.subtotal, 0);
    const total = subtotal; 
    const vuelto = montoPago > total ? montoPago - total : 0;
    // Cart Handlers
    const addToCart = (prod: Producto) => {
        const existing = cart.find(item => item.id === prod.id);
        const tipoPrecio = selectedCliente?.tipo || 'minorista';
        const precio = getPriceForClient(prod, selectedCliente);

        if (existing) {
            setCart(cart.map(item =>
                item.id === prod.id
                    ? { ...item, cantidad: item.cantidad + 1, subtotal: (item.cantidad + 1) * item.precio_unitario }
                    : item
            ));
        } else {
            setCart([...cart, {
                ...prod,
                cantidad: 1,
                precio_unitario: precio,
                subtotal: precio,
                tipo_precio: tipoPrecio
            }]);
        }
        setSearchProduct('');
        setProductDropdown(false);
    };

    const updateQuantity = (id: string, delta: number) => {
        setCart(cart.map(item => {
            if (item.id === id) {
                const newQty = Math.max(0.1, Math.round((item.cantidad + delta) * 100) / 100);
                return { ...item, cantidad: newQty, subtotal: Math.round(newQty * item.precio_unitario * 100) / 100 };
            }
            return item;
        }));
    };

    const handleSetQuantity = (id: string, value: string) => {
        if (value === '') {
            setCart(cart.map(item => item.id === id ? { ...item, cantidad: 0, subtotal: 0 } : item));
            return;
        }

        const newQty = parseFloat(value);
        if (isNaN(newQty)) return;

        setCart(cart.map(item => {
            if (item.id === id) {
                return { ...item, cantidad: newQty, subtotal: Math.round(newQty * item.precio_unitario * 100) / 100 };
            }
            return item;
        }));
    };

    const handleQuantityBlur = (id: string, currentQty: number) => {
        if (currentQty <= 0) {
            setCart(cart.map(item => {
                if (item.id === id) {
                    const fallbackQty = 1;
                    return { ...item, cantidad: fallbackQty, subtotal: fallbackQty * item.precio_unitario };
                }
                return item;
            }));
        }
    };

    const updateItemPriceType = (id: string, tipo: 'minorista' | 'mayorista' | 'revendedor') => {
        setCart(cart.map(item => {
            if (item.id === id) {
                let nuevoPrecio = item.precio_minorista;
                if (tipo === 'mayorista') nuevoPrecio = item.precio_mayorista;
                if (tipo === 'revendedor') nuevoPrecio = item.precio_revendedor;

                return {
                    ...item,
                    tipo_precio: tipo,
                    precio_unitario: nuevoPrecio,
                    subtotal: Math.round(item.cantidad * nuevoPrecio * 100) / 100
                };
            }
            return item;
        }));
    };

    const removeFromCart = (id: string) => {
        setCart(cart.filter(item => item.id !== id));
    };

    const getPriceForClient = (prod: Producto, cliente: Cliente | null) => {
        if (!cliente) return prod.precio_minorista;
        switch (cliente.tipo) {
            case 'mayorista': return prod.precio_mayorista;
            case 'revendedor': return prod.precio_revendedor;
            default: return prod.precio_minorista;
        }
    };

    // Confirm Sale
    const handleConfirmSale = async () => {
        if (!selectedCliente || cart.length === 0) {
            alert('Debe seleccionar un cliente y agregar al menos un producto.');
            return;
        }

        setSaving(true);
        try {
            const { data: venta, error: ventaErr } = await supabase
                .from('ventas')
                .insert([{
                    cliente_id: selectedCliente.id,
                    vendedor_id: user?.id,
                    total: total,
                    saldo_pendiente: formaPago === 'cuenta_corriente' ? total : 0,
                    estado: 'en distribucion',
                    tipo_comprobante: 'ticket',
                    fecha: format(new Date(), 'yyyy-MM-dd')
                }])
                .select()
                .single();

            if (ventaErr) throw ventaErr;

            const itemsToInsert = cart.map(item => ({
                venta_id: venta.id,
                producto_id: item.id,
                cantidad: item.cantidad,
                precio_unitario: item.precio_unitario,
                subtotal: item.subtotal
            }));

            const { error: itemsErr } = await supabase.from('venta_items').insert(itemsToInsert);
            if (itemsErr) throw itemsErr;

            if (formaPago !== 'cuenta_corriente') {
                await supabase.from('pagos').insert({
                    cliente_id: selectedCliente.id,
                    venta_id: venta.id,
                    monto: total,
                    forma_pago: formaPago,
                    referencia: referenciaPago,
                    fecha_vencimiento: (formaPago === 'cheque' || formaPago === 'icheque') ? fechaVencimiento : null,
                    fecha: format(new Date(), 'yyyy-MM-dd')
                });
            }

            try {
                const pdfItems = cart.map(item => ({
                    id: '',
                    producto_id: item.id,
                    cantidad: item.cantidad,
                    precio_unitario: item.precio_unitario,
                    subtotal: item.subtotal,
                    productos: {
                        id: item.id,
                        nombre: item.nombre,
                        codigo: item.codigo || undefined
                    }
                }));

                const pdfVenta = {
                    ...venta,
                    clientes: selectedCliente,
                    venta_items: pdfItems
                };

                generateSaleTicket(pdfVenta, pdfItems);
            } catch (pdfErr) {
                console.error("Error generating PDF:", pdfErr);
            }

            alert('Venta confirmada con éxito!');
            navigate('/ventas');

        } catch (error) {
            console.error('Error saving sale:', error);
            alert('Ocurrió un error al procesar la venta.');
        } finally {
            setSaving(false);
        }
    };

    // Product Search Filter
    useEffect(() => {
        if (searchProduct.length > 1) {
            const filtered = productos.filter(p =>
                p.nombre.toLowerCase().includes(searchProduct.toLowerCase()) ||
                p.codigo?.toLowerCase().includes(searchProduct.toLowerCase())
            );
            setFilteredProducts(filtered);
            setProductDropdown(true);
        } else {
            setFilteredProducts([]);
            setProductDropdown(false);
        }
    }, [searchProduct, productos]);

    // Cliente Search Filter
    useEffect(() => {
        if (searchCliente.length > 1) {
            const filtered = clientes.filter(c =>
                c.razon_social.toLowerCase().includes(searchCliente.toLowerCase()) ||
                c.nombre_fantasia?.toLowerCase().includes(searchCliente.toLowerCase()) ||
                c.cuit?.toLowerCase().includes(searchCliente.toLowerCase())
            );
            setFilteredClientes(filtered);
            setClienteDropdown(true);
        } else {
            setFilteredClientes([]);
            setClienteDropdown(false);
        }
    }, [searchCliente, clientes]);

    // Handle Click Outside for product and cliente search
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (productSearchRef.current && !productSearchRef.current.contains(event.target as Node)) {
                setProductDropdown(false);
            }
            if (clienteSearchRef.current && !clienteSearchRef.current.contains(event.target as Node)) {
                setClienteDropdown(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    if (loading) {
        return (
            <Layout>
                <div className="flex h-screen w-full items-center justify-center bg-background-light dark:bg-background-dark">
                    <div className="flex flex-col items-center gap-4">
                        <div className="size-12 border-4 border-primary/30 border-t-primary rounded-full animate-spin"></div>
                        <p className="text-stone-500 font-medium">Cargando venta...</p>
                    </div>
                </div>
            </Layout>
        );
    }

    return (
        <Layout>
            <MainHeader title={`Nueva Venta ${selectedCliente ? '• ' + selectedCliente.razon_social : ''}`}>
                <span className="px-3 py-1 bg-green-500/10 text-green-500 text-[10px] font-black uppercase tracking-widest rounded-full border border-green-500/20">Terminal Activo</span>
            </MainHeader>

            <div className="flex-1 flex flex-col lg:flex-row gap-6 p-4 lg:p-6 overflow-x-hidden overflow-y-auto lg:overflow-hidden">
                <div className="flex-shrink-0 lg:flex-[2] flex flex-col gap-6 lg:overflow-hidden overflow-visible">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 shrink-0">
                        <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 p-5 rounded-2xl shadow-sm transition-all hover:shadow-md relative" ref={clienteSearchRef}>
                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">1. Seleccionar Cliente</label>
                            <div className="relative group">
                                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-primary transition-colors">person_search</span>
                                <input
                                    className="w-full pl-10 pr-4 py-3 bg-slate-50 dark:bg-zinc-800 border-none rounded-xl text-sm font-bold focus:ring-2 focus:ring-primary/50 transition-all"
                                    placeholder={selectedCliente ? selectedCliente.razon_social : "Buscar cliente..."}
                                    value={searchCliente}
                                    onChange={(e) => setSearchCliente(e.target.value)}
                                    onFocus={() => searchCliente.length > 1 && setClienteDropdown(true)}
                                />
                                {selectedCliente && !searchCliente && (
                                    <button 
                                        onClick={() => {
                                            setSelectedCliente(null);
                                            setSearchCliente('');
                                        }}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-red-500"
                                    >
                                        <span className="material-symbols-outlined text-sm">close</span>
                                    </button>
                                )}
                            </div>

                            {clienteDropdown && filteredClientes.length > 0 && (
                                <div className="absolute top-[calc(100%+8px)] left-0 w-full bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl shadow-2xl z-50 max-h-[300px] overflow-y-auto p-2">
                                    {filteredClientes.map(c => (
                                        <button
                                            key={c.id}
                                            onClick={() => {
                                                setSelectedCliente(c);
                                                setSearchCliente('');
                                                setClienteDropdown(false);
                                            }}
                                            className="w-full flex flex-col p-3 hover:bg-slate-50 dark:hover:bg-zinc-800 rounded-xl transition-colors text-left"
                                        >
                                            <span className="text-sm font-black">{c.razon_social}</span>
                                            <div className="flex justify-between items-center mt-1">
                                                <span className="text-[10px] text-slate-400 font-bold uppercase">{c.nombre_fantasia || 'S/N'} • {c.cuit?.length === 11 ? `CUIT ${c.cuit}` : c.cuit || 'Sin CUIT'}</span>
                                                <span className={`px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-widest ${c.tipo === 'mayorista' ? 'bg-amber-100 text-amber-700' : c.tipo === 'revendedor' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}>
                                                    {c.tipo}
                                                </span>
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>

                        <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 p-5 rounded-2xl shadow-sm transition-all hover:shadow-md relative" ref={productSearchRef}>
                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">2. Agregar Producto</label>
                            <div className="relative group">
                                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-primary transition-colors">barcode_scanner</span>
                                <input
                                    className="w-full pl-10 pr-4 py-3 bg-slate-50 dark:bg-zinc-800 border-none rounded-xl text-sm font-bold focus:ring-2 focus:ring-primary/50 transition-all"
                                    placeholder="Escriba nombre o código..."
                                    value={searchProduct}
                                    onChange={(e) => setSearchProduct(e.target.value)}
                                    onFocus={() => searchProduct.length > 1 && setProductDropdown(true)}
                                />
                            </div>

                            {/* Product Search Dropdown */}
                            {productDropdown && filteredProducts.length > 0 && (
                                <div className="absolute top-[calc(100%+8px)] left-0 w-full bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl shadow-2xl z-50 max-h-[400px] overflow-y-auto overflow-x-hidden p-2">
                                    {filteredProducts.map(p => (
                                        <button
                                            key={p.id}
                                            onClick={() => addToCart(p)}
                                            className="w-full flex items-center justify-between p-3 hover:bg-slate-50 dark:hover:bg-zinc-800 rounded-xl transition-colors text-left group"
                                        >
                                            <div className="flex flex-col min-w-0 pr-4">
                                                <span className="text-sm font-black truncate">{p.nombre}</span>
                                                <span className={`text-[10px] font-bold ${p.stock_actual < 10 ? 'text-red-500 animate-pulse' : 'text-slate-400'}`}>Stock: {p.stock_actual} unidades</span>
                                            </div>
                                            <div className="flex flex-col items-end shrink-0">
                                                <span className="text-sm font-black text-primary">$ {getPriceForClient(p, selectedCliente).toLocaleString()}</span>
                                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Precio {selectedCliente?.tipo || 'Minorista'}</span>
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Items Table Section */}
                    <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl shadow-sm overflow-hidden flex-1 flex flex-col transition-all hover:shadow-md">
                        <div className="px-6 py-4 border-b border-slate-100 dark:border-zinc-800 flex justify-between items-center bg-slate-50/50 dark:bg-zinc-800/30">
                            <h3 className="text-sm font-black uppercase tracking-widest text-slate-900 dark:text-white flex items-center gap-2">
                                <span className="material-symbols-outlined text-primary">list_alt</span>
                                Detalle de la Venta
                            </h3>
                            <span className="text-[10px] font-black bg-primary text-white px-2 py-0.5 rounded-full">{cart.length} Items</span>
                        </div>

                        <div className="flex-1 overflow-y-auto overflow-x-hidden p-4">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="text-[10px] font-black uppercase text-slate-400 tracking-widest">
                                        <th className="px-4 py-3">Producto</th>
                                        <th className="px-4 py-3 text-center w-32">Cantidad</th>
                                        <th className="px-4 py-3 text-right">Unitario</th>
                                        <th className="px-4 py-3 text-right">Subtotal</th>
                                        <th className="px-4 py-3 text-center w-16"></th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
                                    {cart.map(item => (
                                        <tr key={item.id} className="group hover:bg-slate-50 dark:hover:bg-zinc-800/20 transition-colors">
                                            <td className="px-4 py-4 min-w-[150px]">
                                                <div className="flex flex-col">
                                                    <span className="font-black text-sm text-slate-900 dark:text-white line-clamp-2">{item.nombre}</span>
                                                    <span className="text-[10px] font-bold text-slate-400">{item.codigo || 'S/N'}</span>
                                                </div>
                                            </td>
                                            <td className="px-4 py-4">
                                                <div className="flex items-center justify-center bg-slate-100 dark:bg-zinc-800 rounded-xl p-1 shrink-0 min-w-[140px]">
                                                    <button
                                                        onClick={() => updateQuantity(item.id, -1)}
                                                        className="size-8 flex items-center justify-center hover:bg-white dark:hover:bg-zinc-700 rounded-lg transition-all text-lg font-black"
                                                    >-</button>
                                                    <input
                                                        className="w-20 text-center bg-transparent border-none p-0 text-sm font-black focus:ring-0"
                                                        type="number"
                                                        step="any"
                                                        value={item.cantidad === 0 ? '' : item.cantidad}
                                                        onChange={(e) => handleSetQuantity(item.id, e.target.value)}
                                                        onBlur={() => handleQuantityBlur(item.id, item.cantidad)}
                                                    />
                                                    <button
                                                        onClick={() => updateQuantity(item.id, 1)}
                                                        className="size-8 flex items-center justify-center hover:bg-white dark:hover:bg-zinc-700 rounded-lg transition-all text-lg font-black"
                                                    >+</button>
                                                </div>
                                            </td>
                                            <td className="px-4 py-4 text-right">
                                                <div className="flex flex-col items-end">
                                                    <span className="text-sm font-black text-slate-900 dark:text-white">$ {item.precio_unitario.toLocaleString()}</span>
                                                    <select 
                                                        value={item.tipo_precio}
                                                        onChange={(e) => updateItemPriceType(item.id, e.target.value as any)}
                                                        className="text-[10px] font-bold text-green-500 tracking-tighter uppercase bg-transparent border-none p-0 focus:ring-0 cursor-pointer hover:text-green-600 transition-colors text-right"
                                                    >
                                                        <option value="minorista">Minorista</option>
                                                        <option value="mayorista">Mayorista</option>
                                                        <option value="revendedor">Revendedor</option>
                                                    </select>
                                                </div>
                                            </td>
                                            <td className="px-4 py-4 text-right font-black text-sm">$ {item.subtotal.toLocaleString()}</td>
                                            <td className="px-4 py-4 text-center">
                                                <button
                                                    onClick={() => removeFromCart(item.id)}
                                                    className="size-10 flex items-center justify-center text-slate-300 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-xl transition-all"
                                                >
                                                    <span className="material-symbols-outlined text-xl">delete</span>
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                    {cart.length === 0 && (
                                        <tr>
                                            <td colSpan={5} className="py-20 text-center text-slate-400">
                                                <span className="material-symbols-outlined text-6xl mb-4 block opacity-10">production_quantity_limits</span>
                                                <p className="font-black text-sm uppercase tracking-widest opacity-40">No hay productos agregados</p>
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>

                {/* Right Panel: Totals & Payments (W-96) */}
                <div className="w-full lg:w-[420px] flex flex-col gap-6 overflow-y-visible lg:overflow-y-auto shrink-0 lg:pr-2 lg:pb-6 lg:custom-scrollbar">

                    <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 p-6 rounded-2xl shadow-sm transition-all hover:shadow-md">
                        <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 ml-1">3. Método de Pago</h3>
                        <div className="grid grid-cols-2 gap-3 mb-6">
                            {[
                                { id: 'efectivo', label: 'Efectivo', icon: 'payments' },
                                { id: 'transferencia', label: 'Transferencia', icon: 'account_balance' },
                                { id: 'cheque', label: 'Cheque', icon: 'payments' },
                                { id: 'icheque', label: 'iCheque', icon: 'account_balance' },
                                { id: 'cuenta_corriente', label: 'Cta. Corriente', icon: 'history_edu' }
                            ].map(metodo => (
                                <button
                                    key={metodo.id}
                                    onClick={() => setFormaPago(metodo.id as any)}
                                    className={`flex flex-col items-center justify-center p-4 rounded-xl border-2 transition-all group ${formaPago === metodo.id ? 'border-primary bg-primary/10 text-primary' : 'border-slate-100 dark:border-zinc-800 hover:border-primary/30 text-slate-400'}`}
                                >
                                    <span className={`material-symbols-outlined text-3xl mb-1 group-hover:scale-110 transition-transform ${formaPago === metodo.id ? 'fill-1' : ''}`}>{metodo.icon}</span>
                                    <span className="text-[10px] font-black uppercase tracking-tighter">{metodo.label}</span>
                                </button>
                            ))}
                        </div>

                        <div className="space-y-4">
                            {(formaPago === 'cheque' || formaPago === 'icheque') && (
                                <div className="animate-in slide-in-from-top-2">
                                    <label className="block text-[10px] font-black text-rose-500 uppercase tracking-widest mb-1 ml-1">Vencimiento del Cheque</label>
                                    <input
                                        type="date"
                                        value={fechaVencimiento}
                                        onChange={(e) => setFechaVencimiento(e.target.value)}
                                        className="w-full h-12 px-4 bg-rose-50/50 border-2 border-rose-100 rounded-xl text-lg font-bold text-rose-600 focus:ring-4 focus:ring-rose-500/10 outline-none"
                                        required
                                    />
                                </div>
                            )}

                            {formaPago !== 'cuenta_corriente' && (
                                <>
                                    <div>
                                        <label className="block text-[10px] font-black text-slate-400 uppercase ml-1 mb-1">Monto Recibido</label>
                                        <div className="relative">
                                            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-black">$</span>
                                            <input
                                                className="w-full pl-8 pr-4 py-4 bg-slate-50 dark:bg-zinc-800 border-none rounded-2xl font-black text-2xl text-right focus:ring-2 focus:ring-primary/50 transition-all text-primary"
                                                type="number"
                                                value={montoPago || ''}
                                                onChange={(e) => setMontoPago(Number(e.target.value))}
                                            />
                                        </div>
                                    </div>
                                    <div className="flex justify-between items-center p-4 bg-slate-50 dark:bg-zinc-800/50 rounded-2xl border border-dashed border-slate-200 dark:border-zinc-700">
                                        <span className="text-sm font-bold text-slate-500">Vuelto Sugerido:</span>
                                        <span className={`text-xl font-black ${vuelto > 0 ? 'text-green-500' : 'text-slate-300'}`}>$ {vuelto.toLocaleString()}</span>
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 ml-1">
                                            Referencia / Comprobante
                                        </label>
                                        <input
                                            type="text"
                                            value={referenciaPago}
                                            onChange={(e) => setReferenciaPago(e.target.value)}
                                            className="w-full h-10 px-4 bg-slate-50 border-none rounded-xl text-sm focus:ring-2 focus:ring-primary/50"
                                            placeholder="Nro transacción, banco, etc..."
                                        />
                                    </div>
                                </>
                            )}
                            {formaPago === 'cuenta_corriente' && (
                                <div className="p-4 bg-primary/5 rounded-2xl border border-primary/20">
                                    <p className="text-xs text-primary font-bold flex items-center gap-2">
                                        <span className="material-symbols-outlined text-sm">info</span>
                                        Venta a cuenta corriente
                                    </p>
                                    {selectedCliente && (
                                        <div className="mt-2 text-[10px] text-slate-500 font-bold uppercase">
                                            Límite disponible: <span className="text-slate-900 dark:text-white">$ {(selectedCliente.limite_credito - selectedCliente.saldo_actual).toLocaleString()}</span>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Summary Section */}
                    <div className="bg-white dark:bg-zinc-900 p-8 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-2xl transition-all relative overflow-hidden flex-1">
                        <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
                            <span className="material-symbols-outlined text-9xl">shopping_basket</span>
                        </div>

                        <div className="space-y-4 mb-8">
                            <div className="flex justify-between items-center text-slate-400">
                                <span className="text-xs font-bold uppercase tracking-widest italic">Subtotal</span>
                                <span className="font-black text-slate-900 dark:text-white">$ {subtotal.toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between items-center text-slate-400">
                                <span className="text-xs font-bold uppercase tracking-widest italic">Descuento</span>
                                <div className="flex items-center gap-2">
                                    <span className="text-[10px] bg-red-500/10 text-red-500 px-2 py-0.5 rounded-full font-black">0%</span>
                                    <span className="font-black text-slate-900 dark:text-white">$ 0</span>
                                </div>
                            </div>
                            <div className="h-px bg-slate-100 dark:bg-zinc-800 my-4"></div>
                            <div className="flex justify-between items-end">
                                <span className="text-sm font-black uppercase tracking-[0.2em] text-slate-500 mb-2">Total Final</span>
                                <span className="text-5xl font-black text-primary">$ {total.toLocaleString()}</span>
                            </div>
                        </div>

                        <div className="flex flex-col gap-3 mt-auto">
                            <button
                                onClick={handleConfirmSale}
                                disabled={saving || cart.length === 0}
                                className="w-full py-5 bg-primary hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-2xl font-black text-xl shadow-lg shadow-primary/30 flex items-center justify-center gap-3 transition-all active:scale-95 group"
                            >
                                {saving ? (
                                    <div className="size-6 border-3 border-white/30 border-t-white rounded-full animate-spin"></div>
                                ) : (
                                    <>
                                        <span className="material-symbols-outlined text-3xl group-hover:rotate-12 transition-transform">check_circle</span>
                                        CONFIRMAR VENTA
                                    </>
                                )}
                            </button>
                            <button className="w-full py-4 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 hover:bg-slate-100 dark:hover:bg-zinc-700 text-slate-500 dark:text-slate-300 rounded-2xl font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2 transition-all">
                                <span className="material-symbols-outlined text-xl">description</span>
                                Generar Comprobante
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </Layout>
    );
};

export default NuevaVenta;
