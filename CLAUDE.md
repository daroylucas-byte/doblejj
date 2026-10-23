# CLAUDE.md — Doble JJ Abastecimientos

## Identidad del proyecto

| Campo | Valor |
|---|---|
| **Nombre** | Doble JJ Abastecimientos |
| **Cliente** | Doble JJ — mayorista de carnes, Carlos Paz, Córdoba, Argentina |
| **Tipo** | PWA · Comercio / PYME |
| **Supabase project-ref** | `txyqovlcftvgthqvfpxk` |
| **Repo GitHub** | `https://github.com/daroylucas-byte/doblejj` |
| **Branch principal** | `main` |
| **Flujo de trabajo** | Una rama por cambio (`feat/…`, `fix/…`, `docs/…`) → Pull Request → merge a `main`. **Mergear a `main` publica en producción** (Vercel despliega desde `main`) |
| **Deploy** | Vercel (proyecto `doblejj`) |
| **Estado** | Producción activa |

---

## Stack técnico

| Tecnología | Versión |
|---|---|
| React | 19.2 |
| TypeScript | 5.9 |
| Vite + vite-plugin-pwa | 7.3 / 1.2 |
| Tailwind CSS | 3.4 |
| React Router | 7.13 |
| Supabase JS | 2.99 |
| date-fns | 4.1 |
| jsPDF + autotable | 2.5 / 3.8 |
| Zustand | 5.0 |
| React Query | 5.90 |
| React Hook Form + Zod | 7.71 / 4.3 |

---

## Estructura de carpetas

```
src/
├── pages/          # Una página por ruta
├── components/     # Modales y componentes reutilizables
├── hooks/          # Custom hooks (ej: useSistemaCreditos)
├── store/          # authStore.ts (sesión y rol del perfil)
├── utils/          # pdfGenerator.ts, promoImageGenerator.ts, anulaciones.ts
├── lib/
│   ├── supabase.ts        # Cliente Supabase
│   └── database.types.ts  # Tipos generados de Supabase
└── App.tsx         # Rutas protegidas con <ProtectedRoute>

supabase/
├── config.toml     # Configuración del Supabase local (CLI + Docker)
└── migrations/     # Migraciones SQL (ver "Migraciones y publicación")
```

---

## Páginas y rutas

| Ruta | Página | Descripción |
|---|---|---|
| `/` | Dashboard | Resumen general del negocio |
| `/ventas` | Ventas | Listado y gestión de ventas |
| `/ventas/nueva` | NuevaVenta | Carrito de venta con búsqueda de productos |
| `/clientes` | Clientes | Listado de clientes |
| `/clientes/:id` | ClienteDetalle | Ficha, cuenta corriente, historial, stats |
| `/proveedores` | Proveedores | Listado de proveedores |
| `/proveedores/:id` | ProveedorDetalle | Ficha y cuenta corriente del proveedor |
| `/compras/nueva` | NuevaCompra | Registro de compra a proveedor |
| `/productos` | Productos | ABM de productos con stock. Selección de productos para generar el **catálogo PDF** |
| `/stock` | StockHistorial | Historial de movimientos de stock |
| `/elaboracion` | Elaboracion | Producción interna |
| `/caja` | Caja | Apertura/cierre y movimientos de caja |
| `/promociones` | Promociones | Gestión de promos generadas por IA |
| `/anulaciones` | Anulaciones | **PROVISORIA** (etapa de limpieza hasta ~21/11/2026): registro de anulaciones y clasificación de las históricas. Se elimina después (ruta, menú y página; la base no cambia) |
| `/login` | Login | Autenticación |
| `/register` | Register | Alta de usuario: queda `pendiente` hasta que un administrador lo apruebe |

---

## Componentes principales

| Componente | Uso |
|---|---|
| `CobroModal` | Registrar cobro a cliente (FIFO automático por trigger) |
| `PagoProveedorModal` | Registrar pago a proveedor |
| `ClienteModal` | Crear/editar cliente |
| `ProveedorModal` | Crear/editar proveedor |
| `ProductoModal` | Crear/editar producto |
| `PDFViewerModal` | Visualizar PDF generado antes de descargar (con botón Compartir opcional) |
| `CatalogoPDFModal` | Opciones del catálogo PDF (tipo de precio, título) y vista previa |
| `AnularMotivoModal` | Modal genérico de motivo de anulación (error de carga, cheque rechazado, devolución, otro) |
| `AnularPagoModal` | Anular un pago desde la ficha del cliente (usa `AnularMotivoModal`) |
| `CuentaPendiente` | Cartel que ve un usuario recién registrado hasta que lo aprueben |
| `Layout` + `Sidebar` | Shell de la app con navegación lateral |
| `MainHeader` | Header de cada página |

---

## Base de datos (Supabase)

### Tablas principales

| Tabla | Descripción |
|---|---|
| `clientes` | Clientes con `saldo_actual` y `limite_credito` |
| `proveedores` | Proveedores con `saldo_actual` |
| `productos` | Catálogo con `stock_actual`, precios por tipo |
| `ventas` | Cabecera de ventas con `estado`, `total`, `saldo_pendiente` |
| `venta_items` | Ítems de cada venta |
| `compras` | Compras a proveedores |
| `compra_items` | Ítems de cada compra |
| `pagos` | Cobros a clientes |
| `pagos_proveedores` | Pagos a proveedores |
| `cuenta_corriente` | Movimientos de CC de clientes |
| `cuenta_corriente_proveedores` | Movimientos de CC de proveedores |
| `movimientos_stock` | Log de entradas/salidas de stock |
| `caja_cierres` | Aperturas y cierres de caja |
| `gastos` | Gastos del negocio |
| `gastos_recurrentes` | Gastos periódicos |
| `categorias` | Categorías de productos |
| `categorias_gasto` | Categorías de gastos |
| `promociones_sugeridas` | Promos generadas por IA (n8n + GPT-4o) |
| `sistema_creditos` | Saldo de créditos IA (única fila, compartido) |
| `sistema_creditos_movimientos` | Historial de consumo de créditos IA |
| `profiles` | Perfiles de usuarios autenticados. `rol` ∈ `admin`, `vendedor`, `deposito`, `caja`, `pendiente`; `activo` |
| `config_anulaciones` | Configuración de la ventana de limpieza de anulaciones (una fila: `limpieza_hasta`, `limite_dias`) |

### Vistas

| Vista | Uso |
|---|---|
| `vista_cuenta_corriente` | CC de clientes con `saldo_acumulado` recalculado dinámicamente |
| `vista_cuenta_corriente_proveedores` | CC de proveedores |
| `vista_cuenta_corriente_resumen` | **La que usa la ficha del cliente.** Movimientos con `saldo_acumulado_historico`, `oculto_en_resumen`, `saldo_resumen` (saldo sin el efecto de los errores de carga corregidos), `anulado_motivo`, `anulacion_tardia` |
| `vista_saldos_proveedores` | **Saldo de cada proveedor** (una fila por proveedor): suma de la cuenta corriente (`cargo`/`nota_debito` suman, `pago`/`nota_credito` restan, con `abs(monto)`). Es el saldo que muestra el listado y la ficha del proveedor. Positivo = deuda |
| `vista_anulaciones_estadisticas` | Conteos de la pantalla `/anulaciones` (total, tardías, por motivo, por usuario, sin clasificar) |
| `vista_productos_para_promociones` | Productos con clasificación de stock (la usaba n8n) |
| `vista_combos_frecuentes` | Pares de productos comprados juntos (la usaba n8n) |

**Todas las vistas son `security_invoker = true`**: respetan el RLS de quien consulta. Nunca crear una vista `SECURITY DEFINER` en `public`.

### Triggers críticos

| Trigger | Qué hace |
|---|---|
| `trg_cc_calcular_saldo` / `trg_ccp_calcular_saldo` | **BEFORE INSERT** — calcula `saldo_acumulado` desde el saldo previo y el `tipo`. Sobreescribe lo que mande el frontend |
| `cc_sync_saldo` / `ccp_sync_saldo` | AFTER INSERT — copia `saldo_acumulado` a `clientes.saldo_actual` / `proveedores.saldo_actual` |
| `trg_reconciliar_ventas_on_saldo_change` | Al bajar saldo de cliente, aplica pagos FIFO sobre ventas pendientes y las marca `entregada` cuando saldo = 0. **No actualiza `total_pagado`** — ese campo no es confiable |
| `trg_calcular_stock_movimiento` | **BEFORE INSERT** en `movimientos_stock` — calcula `stock_anterior` y `stock_nuevo` desde el stock real. Sobreescribe lo que mande el frontend. **`SECURITY DEFINER`** (ver Bugs corregidos: con permisos del usuario, un vendedor calculaba el stock desde 0) |
| `trg_proteger_stock_actual` | **BEFORE UPDATE** en `productos` — revierte en silencio cualquier escritura directa de `stock_actual` |
| `stock_sync` | AFTER INSERT en `movimientos_stock` — copia `stock_nuevo` a `productos.stock_actual`. **`SECURITY DEFINER`**: así la venta de un vendedor mueve el stock aunque `productos` solo deje actualizar a admin/depósito |
| `handle_stock_on_venta_status_change` | Al cambiar estado de venta, ajusta stock de productos |
| `handle_venta_entregada_cta_cte` | Al entregar venta, registra movimiento en cuenta corriente |
| `on_auth_user_created` (en `auth.users`) | Crea el perfil con `handle_new_user`: **siempre `pendiente` e inactivo**, ignora cualquier rol que mande el cliente. En la base local hay que crearlo a mano (el volcado trae solo el esquema `public`) |

### Funciones (RPC) que usa el frontend

| Función | Qué hace | Tipo |
|---|---|---|
| `registrar_venta(cliente, items, forma_pago, referencia, fecha_venc)` | Venta nueva **atómica**: venta + ítems + cobro en CC + pago enlazado. El stock y el cargo los hacen los triggers. Total y subtotales salen de los ítems | INVOKER |
| `registrar_entrega(venta, items, pago, forma_pago, fecha_venc, estado)` | Entrega **atómica**: cantidades, ajuste en CC, cobro, pago, total/saldo/estado de la venta. Misma lógica que tenía el front. **No reajusta el stock** al editar cantidades | INVOKER |
| `anular_venta(venta, motivo, detalle)` | Anula una venta (estado `cancelada` + nota de crédito enlazada con motivo). El trigger devuelve el stock | INVOKER |
| `anular_movimiento_pago(movimiento_cc, motivo, detalle)` | Anula un pago: `nota_debito` enlazada + `pagos.estado = 'anulado'`. Funciona también con pagos viejos sin enlace (coincidencia única o solo en CC). Valida rol admin/vendedor | DEFINER |
| `clasificar_anulacion_historica(nota_credito, motivo, detalle)` | Etiqueta una anulación de venta anterior al sistema de motivos (solo agrega la etiqueta). Valida rol admin/vendedor | DEFINER |
| `ajustar_saldo_proveedor(proveedor, saldo_objetivo, concepto)` | El usuario indica el **saldo final** y la base decide si registra un `cargo` o un `pago` por la diferencia (no registra nada si ya es ese saldo). La diferencia se calcula contra el saldo **visible** (suma de la cuenta corriente), no contra `proveedores.saldo_actual`. Bloquea la fila del proveedor. Devuelve `{ajustado, saldo_anterior, diferencia, tipo, saldo_nuevo}` | INVOKER |
| `update_supplier_balance(prov_id, amount, is_payment)` | Heredada, la usa `NuevaCompra`. Su resultado correcto depende de los triggers de CC de proveedores | INVOKER |

---

## Seguridad y roles

**Regla de oro: la anon key es pública (va al bundle y está en el historial de git). La seguridad es RLS + permisos, nada más.**

- **El rol `anon` no tiene permisos sobre nada del esquema `public`** (tablas, vistas, secuencias ni funciones; tampoco los objetos futuros). Login y registro usan el esquema `auth`.
- **Todas las tablas tienen RLS.** Nunca crear una tabla sin habilitarlo y sin políticas.
- **Roles**: `admin`, `vendedor`, `deposito`, `caja` (personal) y `pendiente` (sin ningún privilegio). `private.es_personal()` (esquema `private`, no expuesto por la API) devuelve true si el usuario está `activo` y tiene un rol de personal; es el filtro de lectura y escritura de casi todo.
- **Las 9 tablas internas** (`caja_cierres`, `categorias`, `categorias_gasto`, `compra_items`, `compras`, `gastos`, `gastos_recurrentes`, `movimientos_stock`, `proveedores`): lectura, alta y modificación para todo el personal; **nadie borra** (el front no borra nada ahí). Se dejó igual para todos los roles a propósito: los triggers corren con los permisos de quien dispara la acción y una política más fina por rol los rompe en silencio. Afinar por rol es un pendiente.
- **Escritura por rol heredada** (se conserva): `clientes` alta/modificación admin+vendedor, baja admin; `productos` alta/modificación admin+depósito, baja admin; `cuenta_corriente` y `pagos` alta admin+vendedor; `cuenta_corriente_proveedores` y `pagos_proveedores` alta admin+caja. `ventas`/`venta_items`: personal.
- **Alta de usuarios**: quien se registra queda `pendiente` e inactivo. Un administrador lo aprueba con SQL:
  `UPDATE profiles SET rol = 'vendedor', activo = true WHERE id = (SELECT id FROM auth.users WHERE email = '…');`
  Nunca tomar el rol de `raw_user_meta_data` ni de nada que mande el cliente.
- **Funciones `SECURITY DEFINER`**: siempre con `SET search_path = public, pg_temp` y, si son llamables por la API, con verificación de rol adentro y `REVOKE EXECUTE … FROM PUBLIC, anon`. Las de trigger no deben ser ejecutables por la API. Hoy: `anular_movimiento_pago`, `clasificar_anulacion_historica`, `handle_new_user`, `private.es_personal`, `calcular_stock_movimiento`, `sync_stock_producto`.
- Las funciones nuevas que escriban en tablas con RLS prefieren `SECURITY INVOKER` (que las políticas sigan decidiendo); `DEFINER` solo cuando la tabla no tiene política de UPDATE y la función es el único camino controlado.

---

## Convenciones de código

### Fechas — CRÍTICO
**Siempre usar `format(new Date(), 'yyyy-MM-dd')` de `date-fns`.**
Nunca usar `new Date().toISOString().split('T')[0]` — en Argentina (UTC-3) después de las 21hs devuelve el día siguiente.

```typescript
import { format } from 'date-fns';
fecha: format(new Date(), 'yyyy-MM-dd') // ✅
fecha: new Date().toISOString().split('T')[0] // ❌
```

### Saldos — convención del sistema
- `saldo_actual > 0` → el cliente/proveedor **debe** dinero (deuda) → mostrar en rojo
- `saldo_actual <= 0` → tiene saldo a favor → mostrar en verde
- En PDFs: `currentBalance > 0` → "Saldo Deudor" / `<= 0` → "Saldo a Favor"

### Cuenta corriente — fuente de verdad
- Usar `saldo_acumulado_historico` de `vista_cuenta_corriente` (calculado por trigger)
- **No usar** `saldo_acumulado` (recalculado dinámico por la vista) — suma mal los ajustes de saldo anterior

### Cuenta corriente — el saldo lo calcula la BD, NUNCA el frontend
Desde agosto 2026, los triggers `trg_cc_calcular_saldo` / `trg_ccp_calcular_saldo` (BEFORE INSERT)
calculan `saldo_acumulado` a partir del saldo previo y el `tipo` del movimiento.

Al insertar en `cuenta_corriente` o `cuenta_corriente_proveedores` **solo mandar `tipo` y `monto`**:

```typescript
// ✅ correcto — la BD calcula el saldo
await supabase.from('cuenta_corriente').insert({
    cliente_id, venta_id, tipo: 'pago', concepto, monto: total, fecha, usuario_id
});

// ❌ nunca calcular el saldo a mano — el trigger lo sobreescribe igual
saldo_acumulado: saldoBase        // se ignora
```

Reglas del cálculo: `cargo`/`nota_debito` **suman** `abs(monto)`; `pago`/`nota_credito` **restan** `abs(monto)`.
El signo del `monto` es indiferente (se normaliza con `abs`) — lo que manda es el `tipo`.

Varias pantallas todavía mandan `saldo_acumulado` por código heredado; es inofensivo (se descarta),
pero **no copiar ese patrón** en pantallas nuevas.

### Stock — lo calcula la BD, NUNCA el frontend
Desde agosto 2026, `movimientos_stock` es la **única puerta de entrada** al stock.
`productos.stock_actual` no se puede escribir directo: `trg_proteger_stock_actual`
revierte el cambio en silencio.

Al registrar un movimiento **solo mandar `tipo`, `cantidad` y `motivo`**:

```typescript
// ✅ correcto — el trigger completa stock_anterior y stock_nuevo
await supabase.from('movimientos_stock').insert({
    producto_id, tipo: 'salida', cantidad, motivo, referencia_tipo, referencia_id, usuario_id
});

// ✅ ajuste manual: se declara el stock OBJETIVO, el trigger deduce la cantidad
await supabase.from('movimientos_stock').insert({
    producto_id, tipo: 'ajuste', stock_nuevo: 0, motivo: 'Conteo físico', referencia_tipo: 'ajuste_manual'
});

// ❌ nunca escribir el stock a mano — se revierte solo
await supabase.from('productos').update({ stock_actual: 10 })
```

Reglas: `entrada`/`devolucion` **suman** `abs(cantidad)`; `salida` **resta** `abs(cantidad)`;
`ajuste` fija el valor de `stock_nuevo` y calcula la cantidad como diferencia.
El stock puede quedar negativo — es una señal de dato a corregir, no se clampea a 0.

### Cálculos y atomicidad — todo en Supabase, el front solo muestra
- **Todo cálculo de negocio (stock, cuenta corriente, saldos, totales guardados, resúmenes) lo hace Supabase** (trigger, vista o función). El front consulta y muestra.
- **Única excepción deliberada:** los formularios de carga (venta nueva, compra, entrega) calculan subtotales y totales **en pantalla mientras se edita**, porque es más rápido. Lo que se **guarda** lo recalcula la base a partir de los ítems (`registrar_venta`, `registrar_entrega`). En compras, el monto real de la factura puede diferir de la suma de ítems a propósito (queda como `desperdicio`).
- **Un flujo de varios pasos va en UNA función atómica** (RPC), no en llamadas sueltas desde el front: si una falla a la mitad no debe quedar nada. Hecho: venta nueva, entrega, anular venta, anular pago. Pendiente: compra, anular compra, ajuste de saldo, créditos IA.
- Al convertir un flujo a RPC: **mismos pasos, mismo orden, mismos conceptos** que tenía el front, y probar la equivalencia (correr el flujo viejo y la función desde el mismo estado inicial y comparar todo lo que dejan: venta, ítems, CC con saldos, pagos, stock antes/después, saldo del cliente y estado de las ventas del cliente — el reparto FIFO modifica otras ventas).

### Saldo de proveedores — dos saldos que NO coinciden (ojo)
- Para **proveedores** el saldo que ve el usuario (listado, ficha, ajuste) es la **suma de la cuenta corriente** (`vista_saldos_proveedores`; en la ficha, `saldo_acumulado` de `vista_cuenta_corriente_proveedores`). **No** usar `proveedores.saldo_actual` ni `saldo_acumulado_historico` para mostrar o calcular: difieren en 12 de 16 proveedores por datos históricos con montos de signo invertido (459 de 545 cargos con monto negativo; un "Saldo Anterior" de TARU por −6.141.507.676 del 12/05/2026). Esto es lo contrario de la regla de clientes (ahí sí se usa `saldo_acumulado_historico`).
- Todo ajuste de saldo de proveedor pasa por `ajustar_saldo_proveedor`. El modal pide el saldo final con selector "Le debo al proveedor / Tengo saldo a favor" y muestra una vista previa; el front no manda signos.
- Corregir esa diferencia (alinear `proveedores.saldo_actual` con la suma) es un UPDATE masivo en producción: requiere respaldo y revisar proveedor por proveedor con el dueño.

### Búsquedas y listados
- Las listas chicas (clientes ~100, proveedores ~16) se **cargan una vez y se filtran en memoria** (`useMemo`): nunca una consulta a la base por cada letra tipeada. La latencia hasta Supabase (us-west-2) es de cientos de ms por viaje; la consulta en sí tarda 1–18 ms.
- No traer tablas de movimientos enteras para sacar un número: PostgREST corta en **1.000 filas** sin avisar. Usar una vista agregada (ej. `vista_saldos_proveedores`).
- Hay índices en las claves foráneas más consultadas (`idx_*`). Al crear una tabla o clave foránea nueva, indexarla.

### Anulaciones (pagos y ventas)
- No se edita ni se borra un movimiento: se **anula con un movimiento inverso enlazado** (`cuenta_corriente.revierte_a`) y un motivo (`anulacion_motivo`): `error_carga`, `cheque_rechazado`, `devolucion`, `otro` (este exige detalle).
- Solo `error_carga` **se oculta** en el resumen del cliente y en el PDF (el par original + corrección), con el saldo recalculado por la base (`vista_cuenta_corriente_resumen`). Los otros motivos siempre se ven. La ficha tiene el filtro "Ocultar correcciones por error".
- Un `error_carga` de más de `limite_dias` (7) solo se permite hasta `limpieza_hasta` (21/11/2026), con detalle, y queda marcado `anulacion_tardia`. Pasada esa fecha rige el límite de 7 días.
- Los pagos nuevos se enlazan a su movimiento de CC (`pagos.movimiento_cc_id`); todo cobro nuevo debe completarlo. **Caja excluye los pagos `anulado`** (`.neq('estado','anulado')`): cualquier consulta nueva de ingresos debe hacer lo mismo.
- Anular un pago **no reabre las ventas** que ese pago había cerrado (el saldo del cliente queda bien). Anular una venta cobrada al contado **no revierte el cobro**: hay que anular el pago aparte.

### PDFs
- Todos usan el logo liviano `LOGO_LIVIANO` (`/logo_catalogo.png`, 212×300) y `compress: true`. **Nunca usar `logo_ticket.png` (1414×2000) en un PDF**: jsPDF lo incrusta sin comprimir y cada PDF pesa ~11 MB. Con el liviano pesan 20–40 KB.
- Los PDF reciben los datos ya calculados (saldos de la vista); no calculan.

### Estados de venta
`presupuesto` → `pendiente` → `en_distribucion` → `entregada` | `cancelada` | `anulada`

### Estructura de componentes
- Páginas en `src/pages/` — un archivo por ruta
- Modales como componentes separados en `src/components/`
- Lógica de negocio compartida en `src/hooks/`
- Generación de PDFs e imágenes en `src/utils/`

---

## Migraciones y publicación (orden obligatorio)

Las migraciones están en `supabase/migrations/`. Las `20261022*` ya están **aplicadas en producción**. La `20260101000000_remote_schema.sql` es solo el volcado para armar la base local: **no se aplica nunca en producción** (y, como `seed.sql` y `schema.sql`, está en `.gitignore`: tienen datos reales de clientes).

Para publicar un cambio que toca la base:
1. **Respaldo** de producción (`supabase db dump --linked` y `--data-only`, guardado **fuera del repo y de OneDrive**).
2. **Aplicar la migración en producción** (MCP `apply_migration` o el SQL Editor de Supabase), en bloques chicos, **verificando después de cada una** (consultas de solo lectura: permisos, conteos, suma de saldos).
3. **Recién después, mergear el PR** del front (eso despliega en Vercel).
4. Verificar lo publicado.

Por eso las migraciones deben ser **aditivas y compatibles con el front viejo** (columnas nuevas nulas, funciones nuevas): entre el paso 2 y el 3 el front viejo tiene que seguir funcionando. Si el front nuevo manda una columna que no existe, **fallan todos los cobros**.

Rollback del front: en Vercel, *Promote* del deploy anterior (no toca la base).

### Entorno local de pruebas
- `supabase start` (Docker) levanta una copia de la base; se carga con el esquema y los datos volcados de producción. El trigger `on_auth_user_created` hay que crearlo a mano.
- Correr la app contra la base local **sin tocar el `.env`**: pasar `VITE_SUPABASE_URL=http://127.0.0.1:54321` y `VITE_SUPABASE_ANON_KEY=<publishable local>` por variable de entorno al `vite` (las variables del shell pisan el `.env`). Verificar a dónde apunta antes de cargar nada.
- Para probar con roles reales: usuario de prueba + `UPDATE profiles SET rol=…, activo=true`; en SQL, `SET LOCAL ROLE authenticated` + `set_config('request.jwt.claims', …)` dentro de una transacción con `ROLLBACK`.
- **Producción solo se toca para aplicar y verificar**, nunca para desarrollar: cada prueba de venta/entrega/compra escribe saldos y stock reales.

---

## Variables de entorno

```bash
VITE_SUPABASE_URL=          # URL del proyecto Supabase
VITE_SUPABASE_ANON_KEY=     # Anon key (pública, va al bundle)
VITE_GEMINI_API_KEY=        # API key de Google Gemini (generación de imágenes de promos)
```

**Importante:** estas variables van al bundle del cliente (prefijo `VITE_`). Nunca poner secrets que no deban ser públicos con este prefijo. El `.env` nunca se commitea.

En Vercel deben estar configuradas en: Settings → Environment Variables.

---

## Sistema de Promociones IA

El módulo de Promociones tiene dos partes:

### n8n (workflow externo) — **YA NO SE USA** (confirmado oct 2026)
Lo que sigue es el diseño original; las vistas se mantienen pero nada externo las consulta. El rol anon ya no tiene acceso a nada en `public`.
- Se ejecuta **cada lunes 8am** automáticamente
- Consulta `vista_productos_para_promociones` y `vista_combos_frecuentes`
- Llama a **GPT-4o** para generar 4 sugerencias
- Guarda en `promociones_sugeridas` con estado `borrador`

### App (frontend)
- Usuario revisa borradores, aprueba o descarta
- **Aprobar** cuesta **$500 créditos** del sistema
- **Generar imagen** (Gemini 2.5 Flash) cuesta **$1.200 créditos**
- Saldo inicial: **$10.000** — compartido entre todos los usuarios
- Saldo gestionado por `sistema_creditos` (única fila) + hook `useSistemaCreditos`
- Si no hay saldo suficiente, los botones se bloquean con mensaje inline

---

## Bugs corregidos (historial importante)

### Pagos al contado que no descontaban el saldo (agosto 2026)
- **Causa:** `NuevaVenta.tsx` registraba el pago con `saldo_acumulado: saldoBase` — pero `saldoBase` ya
  incluía el cargo de la venta (sumado por `handle_venta_cta_cte`), así que faltaba restar el monto.
  Introducido en el commit `d4cbf96` (12/05/2026), que agregó el registro del pago en cuenta corriente.
- **Efecto:** 47 ventas al contado dejaron el saldo del cliente inflado. Pasó desapercibido porque un
  cobro general posterior (que sí calculaba bien) solía absorber el monto fantasma — el cliente terminaba
  pagando de más sin que la ficha lo mostrara.
- **Fix:** `saldoBase - total` en `NuevaVenta.tsx`; 197 filas de `cuenta_corriente` y el saldo de 12 clientes
  corregidos.
- **Prevención:** migración `calcular_saldo_acumulado_en_trigger` — el saldo ahora lo calcula la BD
  (ver "el saldo lo calcula la BD" en Convenciones). El error es estructuralmente imposible de repetir.

### Bug de ventas marcadas como "cancelada" (mayo 2026)
- **Causa:** trigger `trg_reconciliar_ventas_on_saldo_change` tenía typo `'cancelada'` en lugar de `'entregada'`
- **Efecto:** 151 ventas de 31 clientes quedaron como canceladas incorrectamente + stock inflado por falsas reversiones
- **Fix:** corregido en migración `fix_trigger_reconciliar_ventas_estado`; datos históricos corregidos con `fix_ventas_canceladas_bug_masivo`

### Bug de fecha UTC (mayo 2026)
- **Causa:** `toISOString()` devuelve UTC → después de las 21hs AR aparece como el día siguiente
- **Fix:** reemplazado por `format(new Date(), 'yyyy-MM-dd')` en 7 archivos

### Saldo incorrecto en ficha de cliente (junio 2026)
- **Causa:** `ClienteDetalle` usaba `saldo_acumulado` de la vista (recalcula todo desde cero) en lugar del valor incremental del trigger
- **Fix:** cambiado a `saldo_acumulado_historico`

### Etiqueta "Saldo a Favor" invertida en PDF (junio 2026)
- **Causa:** condición `< 0` invertida — en este sistema positivo = deuda
- **Fix:** corregido en `pdfGenerator.ts` para clientes y proveedores

### Cualquiera podía registrarse como administrador (octubre 2026) — CRÍTICO
- **Causa:** `handle_new_user` tomaba el rol de `raw_user_meta_data->>'rol'` (lo manda quien se registra con la anon key pública) y la pantalla de registro dejaba elegirlo.
- **Fix:** todo usuario nuevo nace `pendiente` e inactivo; un administrador lo aprueba por SQL. Se agregó `pendiente` a los roles válidos, se quitó el selector de rol y `ProtectedRoute` muestra el cartel `CuentaPendiente`.

### Tablas sin RLS y políticas abiertas (octubre 2026) — CRÍTICO
- **Causa:** 9 tablas sin RLS y con todos los permisos para `anon`; `clientes`, `productos`, `profiles` legibles y `ventas`/`venta_items` modificables sin iniciar sesión (políticas `{public}` con `true`); lectura de CC/pagos abierta a cualquier usuario autenticado (incluso pendiente); 4 vistas `SECURITY DEFINER` que salteaban el RLS.
- **Fix:** RLS en todo con `private.es_personal()`, `REVOKE` a `anon` en todo `public`, vistas `security_invoker`. Ver "Seguridad y roles".

### La venta de un vendedor no movía el stock (octubre 2026) — latente
- **Causa:** `calcular_stock_movimiento` leía el stock con `SELECT … FOR UPDATE`, que para un vendedor no ve la fila (la política UPDATE de `productos` es solo admin/depósito): tomaba el stock previo como **0** y calculaba desde cero; y `sync_stock_producto` hacía un UPDATE que no afectaba filas. No se notaba porque hasta ahora los 3 usuarios eran admin.
- **Fix:** ambos triggers pasaron a `SECURITY DEFINER`. El stock sigue protegido (`trg_proteger_stock_actual`).

### PDF de ~11 MB (octubre 2026)
- **Causa:** el logo de 1414×2000 se incrustaba sin comprimir. **Fix:** logo liviano + `compress: true` (ver PDFs).

### Ventas y entregas a medias (octubre 2026)
- **Causa:** el front hacía venta, ítems, cobro en CC y pago en llamadas sueltas y no chequeaba los errores del cobro: si algo fallaba quedaba una venta sin su cobro. **Fix:** `registrar_venta` y `registrar_entrega` (una transacción).

---

## Lo que NO hacer

- ❌ Nunca commitear `.env`
- ❌ Nunca usar `service_role` key en el frontend
- ❌ Nunca usar `new Date().toISOString()` para fechas de negocio
- ❌ Nunca deshabilitar RLS sin políticas definidas
- ❌ Nunca hacer UPDATE masivo en producción sin rollback o respaldo previo
- ❌ Nunca usar `saldo_acumulado` de la vista para mostrar el saldo actual del cliente
- ❌ Nunca asumir que `movimientos_stock` es fuente de verdad para reconstruir stock histórico (tiene datos contaminados por el bug de cancelaciones)
- ❌ Nunca calcular `saldo_acumulado` en el frontend ni hacer `UPDATE` manual de `saldo_actual` — lo hacen los triggers
- ❌ Nunca escribir `productos.stock_actual` directo ni calcular `stock_anterior`/`stock_nuevo` en el frontend — se registra un movimiento y lo calcula el trigger
- ❌ Nunca confiar en `ventas.total_pagado` — el trigger FIFO no lo actualiza
- ❌ Nunca dar permisos a `anon` en `public` ni crear tablas, vistas o funciones accesibles sin sesión
- ❌ Nunca crear una tabla sin RLS ni una vista `SECURITY DEFINER` en `public`
- ❌ Nunca tomar un rol o permiso de lo que manda el cliente (`user_metadata`, parámetros)
- ❌ Nunca escribir una función `SECURITY DEFINER` sin `SET search_path = public, pg_temp` y sin verificar el rol adentro
- ❌ Nunca hacer en el front un cálculo de negocio que se guarda, ni un flujo de varios pasos con llamadas sueltas — va en una función atómica de la base
- ❌ Nunca usar `logo_ticket.png` en un PDF
- ❌ Nunca publicar el front (merge a `main`) antes de aplicar en producción las migraciones que necesita
- ❌ Nunca borrar ni editar un movimiento de CC o un pago a mano: se anula con motivo

---

## Pendientes conocidos

- [x] ~~Habilitar RLS en las 9 tablas abiertas~~ — hecho (oct 2026), junto con el cierre de políticas abiertas y el registro con rol
- [ ] 29 ventas en estado `cancelada` con `total_pagado > 0` — la migración `fix_ventas_canceladas_bug_masivo` sólo corrigió las de `total_pagado = 0`. Las pagadas al ~100% deberían ser `entregada`; las de pago parcial requieren consultar al dueño
- [ ] `trg_reconciliar_ventas_on_saldo_change` no actualiza `total_pagado` — hace inservible ese campo para reportes
- [ ] Revisar las 2 anulaciones de compra de SANTIAGO LLADA (jun/jul 2026, $399.668) — no tienen cargo asociado en cuenta corriente, su efecto correcto sobre el saldo no es determinable sin saber cómo se cargaron esas compras
- [ ] 9 notas de crédito de clientes (mar–may 2026) que no descontaron el saldo — sólo afecta la columna del historial, los saldos actuales están bien
- [ ] 9 productos con stock negativo (Falda deshuesada −9,826 · Matambre vacuno −8,781 · Picaña −3,450 · patita de cerdo −1,954 · Costilla −1,412 y 4 con fracciones) — requieren conteo físico y ajuste manual
- [x] ~~Compra errónea de Lomo del 06/05/2026 (250.900 kg)~~ — el stock ya fue corregido a mano (hoy 245 kg); el historial de `movimientos_stock` conserva la entrada errónea
- [x] ~~Bife de chorizo con stock negativo~~ — ya no figura en negativo
- [ ] Agregar `VITE_GEMINI_API_KEY` en Vercel para que funcione generación de imágenes en producción
- [ ] **Atomicidad, fases 2 y 3:** compra nueva y anular compra (`NuevaCompra`, `ProveedorDetalle`), ajuste de saldo de **cliente** (lee el saldo, calcula la diferencia e inserta: carrera; el de proveedor ya es `ajustar_saldo_proveedor`), créditos de IA (`useSistemaCreditos`). Mismo método que `registrar_venta`
- [ ] **Saldos de proveedores desalineados:** `proveedores.saldo_actual` / `saldo_acumulado_historico` difieren de la suma de la cuenta corriente en 12 de 16 proveedores (ver "Saldo de proveedores"). Decidir con el dueño el saldo real de cada uno y corregir con respaldo previo. Mientras tanto, nada nuevo debe leer `proveedores.saldo_actual`
- [ ] Ficha del proveedor: los cuadros "Total pagado / Total compras / Balance de período" se suman en el front y con ajustes grandes dan números raros. Moverlos a la base
- [ ] El ajuste de saldo de la ficha tiene dos accesos al mismo modal (lápiz de la tarjeta y botón "Ajustar saldo"); dejar uno solo
- [ ] **Editar la cantidad en la entrega no reajusta el stock** (si entregan menos de lo vendido, el stock queda como si se hubiera entregado todo). Preexistente; decidir con el negocio
- [ ] Panel de Supabase Auth: **apagar el registro abierto** y **activar la protección contra contraseñas filtradas**
- [ ] Mergear el commit que fija `pg_temp` en el `search_path` de los archivos `.sql` de las funciones `DEFINER` (producción ya tiene las versiones endurecidas; el repo en `main` no)
- [ ] `REVOKE EXECUTE` a `authenticated` en `calcular_stock_movimiento` y `sync_stock_producto` (son funciones de trigger; no explotable por la API, pero conviene)
- [ ] 16 funciones preexistentes sin `search_path` fijo (aviso del linter de Supabase)
- [ ] `npm audit`: `jspdf` crítico (arreglo = versión 4, cambio mayor: probar todos los PDF) y `react-router`/`ws` con `npm audit fix` sin cambios mayores
- [ ] Afinar el RLS por rol en las 9 tablas internas (hoy los 4 roles de personal leen y escriben igual)
- [ ] `/anulaciones`: clasificar las 56 anulaciones históricas (24 de marzo/abril no tienen cargo y no se pueden ocultar); al terminar la limpieza (~21/11/2026) eliminar la pantalla
- [ ] 6 productos con `stock_actual` distinto del `stock_nuevo` del último movimiento (desvío histórico, preexistente)
- [ ] Los números de Dashboard, Caja, Proveedores, StockHistorial y fichas (sumas y acumulados) todavía se calculan en el cliente; mover a vistas/funciones de la base
