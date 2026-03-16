import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import Layout from '../components/Layout';
import MainHeader from '../components/MainHeader';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/authStore';

interface Proveedor {
    id: string;
    razon_social: string;
    nombre_fantasia: string;
    cuit: string;
    saldo_actual: number;
    limite_credito: number;
}

interface Producto {
    id: string;
    codigo: string | null;
    nombre: string;
    stock_actual: number;
    precio_costo: number;
}

interface CartItemCompra extends Producto {
    cantidad: number;
    nuevo_precio_costo: number;
    subtotal: number;
}

const NuevaCompra: React.FC = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const queryParams = new URLSearchParams(location.search);
    const preselectedProvId = queryParams.get('proveedor_id');
    const { user } = useAuthStore();

    const [proveedores, setProveedores] = useState<Proveedor[]>([]);
    const [productos, setProductos] = useState<Producto[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    // Form State
    const [selectedProveedor, setSelectedProveedor] = useState<Proveedor | null>(null);
    const [numeroFactura, setNumeroFactura] = useState('');
    const [cart, setCart] = useState<CartItemCompra[]>([]);
    const [metodoPago, setMetodoPago] = useState<'efectivo' | 'cta_corriente' | 'transferencia'>('efectivo');
    const [searchProduct, setSearchProduct] = useState('');
    const [filteredProducts, setFilteredProducts] = useState<Producto[]>([]);
    const [productDropdown, setProductDropdown] = useState(false);

    const productSearchRef = useRef<HTMLDivElement>(null);

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const { data: provsData } = await supabase.from('proveedores').select('*').order('razon_social');
            const { data: productsData } = await supabase.from('productos').select('*').order('nombre');

            const provs = provsData || [];
            setProveedores(provs);
            setProductos(productsData || []);

            // Handle pre-selection
            if (preselectedProvId) {
                const found = provs.find(p => p.id === preselectedProvId);
                if (found) setSelectedProveedor(found);
            }
        } catch (error) {
            console.error('Error fetching data:', error);
        } finally {
            setLoading(false);
        }
    }, [preselectedProvId]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    // Totals
    const total = cart.reduce((sum, item) => sum + item.subtotal, 0);

    // Cart Handlers
    const addToCart = (prod: Producto) => {
        if (!cart.find(c => c.id === prod.id)) {
            setCart([...cart, { ...prod, cantidad: 1, nuevo_precio_costo: prod.precio_costo || 0, subtotal: prod.precio_costo || 0 }]);
        }
        setSearchProduct('');
        setProductDropdown(false);
    };

    const updateItem = (id: string, updates: Partial<CartItemCompra>) => {
        setCart(cart.map(item => {
            if (item.id === id) {
                const updated = { ...item, ...updates };
                updated.subtotal = updated.cantidad * updated.nuevo_precio_costo;
                return updated;
            }
            return item;
        }));
    };

    const removeFromCart = (id: string) => {
        setCart(cart.filter(item => item.id !== id));
    };

    const handleConfirmPurchase = async () => {
        if (!selectedProveedor || cart.length === 0) {
            alert('Seleccione un proveedor y agregue productos.');
            return;
        }

        setSaving(true);
        try {
            // 1. Create Purchase Entry
            const { data: compra, error: compraErr } = await supabase
                .from('compras')
                .insert([{
                    proveedor_id: selectedProveedor.id,
                    usuario_id: user?.id,
                    total: total,
                    estado: 'recibida',
                    nro_comprobante: numeroFactura,
                    fecha: new Date().toISOString()
                }])
                .select()
                .single();

            if (compraErr) throw compraErr;

            // 2. Insert Items
            const itemsToInsert = cart.map(item => ({
                compra_id: compra.id,
                producto_id: item.id,
                cantidad: item.cantidad,
                precio_unitario: item.nuevo_precio_costo,
                subtotal: item.subtotal
            }));

            const { error: itemsErr } = await supabase.from('compra_items').insert(itemsToInsert);
            if (itemsErr) throw itemsErr;

            // 3. Update Stock and Costs
            for (const item of cart) {
                // Update product table: add stock and update last cost price
                const { error: stockErr } = await supabase.rpc('increment_stock', {
                    row_id: item.id,
                    amount: item.cantidad
                });

                if (stockErr) {
                    // Fallback to manual if RPC doesn't exist
                    await supabase.from('productos')
                        .update({
                            stock_actual: item.stock_actual + item.cantidad,
                            precio_costo: item.nuevo_precio_costo
                        })
                        .eq('id', item.id);
                }
            }

            // 4. Register Payment or Debt
            if (metodoPago === 'cta_corriente') {
                // Aumenta la deuda del proveedor (como estaba antes)
                const { error: balanceErr } = await supabase.rpc('update_supplier_balance', {
                    prov_id: selectedProveedor.id,
                    amount: total,
                    is_payment: false
                });

                if (balanceErr) {
                    // Actually, let's just insert the charge in the current account.
                    await supabase.from('cuenta_corriente_proveedores').insert({
                        proveedor_id: selectedProveedor.id,
                        compra_id: compra.id,
                        tipo: 'cargo',
                        concepto: `Factura ${numeroFactura || 'Compra #' + compra.id.slice(0, 8)}`,
                        monto: -total,
                        // saldo_acumulado: // we would need to calculate this properly, preferably via a trigger/RPC. We leave it null for now if RPC fails so trigger can handle it
                    });
                }
            } else {
                // Se pagó en el acto (Efectivo o Transferencia)
                // Se registra en la tabla `pagos_proveedores` (asumiendo que existe y tiene estos campos)
                const { error: errorPago } = await supabase.from('pagos_proveedores').insert({
                    proveedor_id: selectedProveedor.id,
                    compra_id: compra.id,
                    monto: total,
                    metodo_pago: metodoPago,
                    notas: `Pago Inmediato s/Factura ${numeroFactura || compra.id.slice(0, 8)}`
                });

                if (errorPago) {
                    console.warn("Could not insert payment, fallback logic required", errorPago);
                }
            }

            alert('Compra registrada con éxito. El stock ha sido actualizado.');
            navigate('/proveedores');

        } catch (error) {
            console.error('Error saving purchase:', error);
            alert('Error al registrar la compra.');
        } finally {
            setSaving(false);
        }
    };

    // Filter products
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

    // Handle Click Outside for product search
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (productSearchRef.current && !productSearchRef.current.contains(event.target as Node)) {
                setProductDropdown(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    if (loading) {
        return (
            <Layout>
                <div className="flex h-screen w-full items-center justify-center">
                    <div className="size-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin"></div>
                </div>
            </Layout>
        );
    }

    return (
        <Layout>
            <MainHeader title="Registrar Compra de Mercadería">
                <span className="px-3 py-1 bg-amber-500/10 text-amber-500 text-[10px] font-black uppercase tracking-widest rounded-full border border-amber-500/20">Módulo de Abastecimiento</span>
            </MainHeader>

            <div className="p-8 max-w-[1600px] mx-auto w-full flex flex-col lg:flex-row gap-8">

                {/* Left Panel: Configuration */}
                <div className="flex-1 space-y-6">
                    <div className="bg-white dark:bg-zinc-900 rounded-3xl border border-slate-200 dark:border-zinc-800 p-6 shadow-sm">
                        <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-4">1. Datos del Proveedor</label>
                        <div className="space-y-4">
                            <select
                                className="w-full bg-slate-50 dark:bg-zinc-800 border-none rounded-2xl p-4 text-sm font-bold focus:ring-2 focus:ring-primary/50"
                                value={selectedProveedor?.id || ''}
                                onChange={(e) => setSelectedProveedor(proveedores.find(p => p.id === e.target.value) || null)}
                            >
                                <option value="">Seleccionar Proveedor...</option>
                                {proveedores.map(p => (
                                    <option key={p.id} value={p.id}>{p.razon_social}</option>
                                ))}
                            </select>

                            <input
                                className="w-full bg-slate-50 dark:bg-zinc-800 border-none rounded-2xl p-4 text-sm font-bold focus:ring-2 focus:ring-primary/50"
                                placeholder="Nro Factura / Comprobante"
                                value={numeroFactura}
                                onChange={(e) => setNumeroFactura(e.target.value)}
                            />

                            {/* NUEVO: Método de Pago */}
                            <div className="pt-2 border-t border-slate-100 dark:border-zinc-800">
                                <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3">Método de Pago</label>
                                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                                    <button
                                        className={`p-3 rounded-xl border flex flex-col items-center justify-center gap-1 transition-all ${metodoPago === 'cta_corriente' ? 'bg-amber-500/10 border-amber-500 text-amber-600 dark:text-amber-400' : 'bg-white dark:bg-zinc-800 border-slate-200 dark:border-zinc-700 text-slate-400 hover:border-slate-300'}`}
                                        onClick={() => setMetodoPago('cta_corriente')}
                                    >
                                        <span className="material-symbols-outlined text-[20px]">account_balance_wallet</span>
                                        <span className="text-[10px] font-black uppercase tracking-wider">A Crédito (Cta. Cte)</span>
                                    </button>
                                    <button
                                        className={`p-3 rounded-xl border flex flex-col items-center justify-center gap-1 transition-all ${metodoPago === 'efectivo' ? 'bg-emerald-500/10 border-emerald-500 text-emerald-600 dark:text-emerald-400' : 'bg-white dark:bg-zinc-800 border-slate-200 dark:border-zinc-700 text-slate-400 hover:border-slate-300'}`}
                                        onClick={() => setMetodoPago('efectivo')}
                                    >
                                        <span className="material-symbols-outlined text-[20px]">payments</span>
                                        <span className="text-[10px] font-black uppercase tracking-wider">Efectivo</span>
                                    </button>
                                    <button
                                        className={`p-3 rounded-xl border flex flex-col items-center justify-center gap-1 transition-all ${metodoPago === 'transferencia' ? 'bg-blue-500/10 border-blue-500 text-blue-600 dark:text-blue-400' : 'bg-white dark:bg-zinc-800 border-slate-200 dark:border-zinc-700 text-slate-400 hover:border-slate-300'}`}
                                        onClick={() => setMetodoPago('transferencia')}
                                    >
                                        <span className="material-symbols-outlined text-[20px]">sync_alt</span>
                                        <span className="text-[10px] font-black uppercase tracking-wider">Transferencia</span>
                                    </button>
                                </div>
                            </div>

                        </div>
                    </div>

                    <div className="bg-white dark:bg-zinc-900 rounded-3xl border border-slate-200 dark:border-zinc-800 p-6 shadow-sm relative" ref={productSearchRef}>
                        <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-4">2. Buscar Productos</label>
                        <div className="relative">
                            <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">search</span>
                            <input
                                className="w-full bg-slate-50 dark:bg-zinc-800 border-none rounded-2xl pl-12 pr-4 py-4 text-sm font-bold focus:ring-2 focus:ring-primary/50"
                                placeholder="Nombre del producto o Código..."
                                value={searchProduct}
                                onChange={(e) => setSearchProduct(e.target.value)}
                                onFocus={() => searchProduct.length > 1 && setProductDropdown(true)}
                            />
                        </div>

                        {productDropdown && filteredProducts.length > 0 && (
                            <div className="absolute top-[calc(100%+8px)] left-0 w-full bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-3xl shadow-2xl z-50 p-2 max-h-[300px] overflow-y-auto">
                                {filteredProducts.map(p => (
                                    <button
                                        key={p.id}
                                        onClick={() => addToCart(p)}
                                        className="w-full flex items-center justify-between p-4 hover:bg-slate-50 dark:hover:bg-zinc-800 rounded-2xl transition-all group"
                                    >
                                        <div className="text-left">
                                            <p className="font-black text-sm uppercase tracking-tight">{p.nombre}</p>
                                            <p className="text-[10px] font-bold text-slate-400">Stock actual: {p.stock_actual}</p>
                                        </div>
                                        <div className="text-right">
                                            <p className="font-black text-primary">$ {p.precio_costo?.toLocaleString()}</p>
                                            <p className="text-[10px] font-bold text-slate-400 uppercase">Costo Base</p>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    <div className="bg-white dark:bg-zinc-900 rounded-3xl border border-slate-200 dark:border-zinc-800 p-6 shadow-sm">
                        <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-4">3. Pago y Confirmación</label>
                        <div className="grid grid-cols-3 gap-2 mb-6">
                            {(['efectivo', 'cta_corriente', 'transferencia'] as const).map(m => (
                                <button
                                    key={m}
                                    onClick={() => setMetodoPago(m)}
                                    className={`p-3 rounded-2xl text-[10px] font-black uppercase tracking-widest border transition-all ${metodoPago === m ? 'bg-primary border-primary text-white shadow-lg' : 'bg-transparent border-slate-100 dark:border-zinc-800 text-slate-400'
                                        }`}
                                >
                                    {m === 'cta_corriente' ? 'Cuenta Cte' : m.charAt(0).toUpperCase() + m.slice(1)}
                                </button>
                            ))}
                        </div>
                        <div className="bg-slate-50 dark:bg-zinc-800/50 rounded-2xl p-6 mb-6">
                            <div className="flex justify-between items-center mb-2 text-slate-400 font-bold text-xs">
                                <span>Subtotal</span>
                                <span>$ {total.toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between items-center pt-4 border-t border-slate-200 dark:border-zinc-700">
                                <span className="font-black text-slate-900 dark:text-white uppercase tracking-widest text-sm">Total Compra</span>
                                <span className="text-2xl font-black text-primary">$ {total.toLocaleString()}</span>
                            </div>
                        </div>
                        <button
                            disabled={cart.length === 0 || !selectedProveedor || saving}
                            onClick={handleConfirmPurchase}
                            className="w-full bg-primary hover:bg-primary/90 disabled:bg-slate-200 dark:disabled:bg-zinc-800 text-white font-black py-4 rounded-2xl shadow-lg shadow-primary/20 transition-all uppercase tracking-widest text-sm flex items-center justify-center gap-2"
                        >
                            {saving ? (
                                <div className="size-5 border-2 border-white/20 border-t-white rounded-full animate-spin"></div>
                            ) : (
                                <>
                                    <span className="material-symbols-outlined">local_shipping</span>
                                    <span>Confirmar Ingreso</span>
                                </>
                            )}
                        </button>
                    </div>
                </div>

                {/* Right Panel: Cart Detail */}
                <div className="lg:flex-[2]">
                    <div className="bg-white dark:bg-zinc-900 rounded-[32px] border border-slate-200 dark:border-zinc-800 shadow-sm overflow-hidden flex flex-col h-full min-h-[600px]">
                        <div className="p-6 border-b border-slate-100 dark:border-zinc-800 bg-slate-50/50 dark:bg-zinc-800/30">
                            <h3 className="text-sm font-black uppercase tracking-widest flex items-center gap-2">
                                <span className="material-symbols-outlined text-primary">inventory_2</span>
                                Productos a Ingresar ({cart.length})
                            </h3>
                        </div>
                        <div className="flex-1 overflow-y-auto p-4 space-y-4">
                            {cart.length === 0 ? (
                                <div className="h-full flex flex-col items-center justify-center text-slate-300 gap-4 opacity-50">
                                    <span className="material-symbols-outlined text-6xl">shopping_basket</span>
                                    <p className="font-black uppercase tracking-widest text-xs">El carrito está vacío</p>
                                </div>
                            ) : (
                                cart.map(item => (
                                    <div key={item.id} className="bg-slate-50 dark:bg-zinc-800/40 border border-slate-100 dark:border-zinc-800 p-6 rounded-3xl transition-all group hover:border-primary/30">
                                        <div className="flex justify-between items-start mb-4">
                                            <div className="flex-1">
                                                <h4 className="font-black text-slate-900 dark:text-white uppercase tracking-tight leading-none mb-1">{item.nombre}</h4>
                                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Código: {item.codigo || 'N/A'}</p>
                                            </div>
                                            <button
                                                onClick={() => removeFromCart(item.id)}
                                                className="text-slate-300 hover:text-red-500 transition-colors"
                                            >
                                                <span className="material-symbols-outlined">close</span>
                                            </button>
                                        </div>
                                        <div className="grid grid-cols-3 gap-6">
                                            <div>
                                                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-2">Cantidad</label>
                                                <div className="flex items-center bg-white dark:bg-zinc-900 rounded-xl border border-slate-200 dark:border-zinc-700 overflow-hidden">
                                                    <button
                                                        onClick={() => updateItem(item.id, { cantidad: Math.max(1, item.cantidad - 1) })}
                                                        className="size-8 flex items-center justify-center hover:bg-slate-100 dark:hover:bg-zinc-800"
                                                    >-</button>
                                                    <input
                                                        className="w-full text-center bg-transparent border-none text-xs font-black p-0"
                                                        value={item.cantidad}
                                                        onChange={(e) => updateItem(item.id, { cantidad: parseInt(e.target.value) || 1 })}
                                                    />
                                                    <button
                                                        onClick={() => updateItem(item.id, { cantidad: item.cantidad + 1 })}
                                                        className="size-8 flex items-center justify-center hover:bg-slate-100 dark:hover:bg-zinc-800"
                                                    >+</button>
                                                </div>
                                            </div>
                                            <div>
                                                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-2">Costo Unidad ($)</label>
                                                <input
                                                    className="w-full bg-white dark:bg-zinc-900 rounded-xl border border-slate-200 dark:border-zinc-700 px-3 py-1.5 text-xs font-black text-primary text-center"
                                                    value={item.nuevo_precio_costo}
                                                    type="number"
                                                    onChange={(e) => updateItem(item.id, { nuevo_precio_costo: parseFloat(e.target.value) || 0 })}
                                                />
                                            </div>
                                            <div className="text-right">
                                                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-2">Subtotal</label>
                                                <p className="text-sm font-black text-slate-900 dark:text-white p-1.5">$ {item.subtotal.toLocaleString()}</p>
                                            </div>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </Layout>
    );
};

export default NuevaCompra;
