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
| **Branch activo** | `fix/caja-historial-y-stock` |
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
├── utils/          # pdfGenerator.ts, promoImageGenerator.ts
├── lib/
│   ├── supabase.ts        # Cliente Supabase
│   └── database.types.ts  # Tipos generados de Supabase
└── App.tsx         # Rutas protegidas con <ProtectedRoute>
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
| `/productos` | Productos | ABM de productos con stock |
| `/stock` | StockHistorial | Historial de movimientos de stock |
| `/elaboracion` | Elaboracion | Producción interna |
| `/caja` | Caja | Apertura/cierre y movimientos de caja |
| `/promociones` | Promociones | Gestión de promos generadas por IA |
| `/login` | Login | Autenticación |

---

## Componentes principales

| Componente | Uso |
|---|---|
| `CobroModal` | Registrar cobro a cliente (FIFO automático por trigger) |
| `PagoProveedorModal` | Registrar pago a proveedor |
| `ClienteModal` | Crear/editar cliente |
| `ProveedorModal` | Crear/editar proveedor |
| `ProductoModal` | Crear/editar producto |
| `PDFViewerModal` | Visualizar PDF generado antes de descargar |
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
| `profiles` | Perfiles de usuarios autenticados |

### Vistas

| Vista | Uso |
|---|---|
| `vista_cuenta_corriente` | CC de clientes con `saldo_acumulado` recalculado dinámicamente |
| `vista_cuenta_corriente_proveedores` | CC de proveedores |
| `vista_productos_para_promociones` | Productos con clasificación de stock para n8n |
| `vista_combos_frecuentes` | Pares de productos comprados juntos (para n8n) |

### Triggers críticos

| Trigger | Qué hace |
|---|---|
| `trg_cc_calcular_saldo` / `trg_ccp_calcular_saldo` | **BEFORE INSERT** — calcula `saldo_acumulado` desde el saldo previo y el `tipo`. Sobreescribe lo que mande el frontend |
| `cc_sync_saldo` / `ccp_sync_saldo` | AFTER INSERT — copia `saldo_acumulado` a `clientes.saldo_actual` / `proveedores.saldo_actual` |
| `trg_reconciliar_ventas_on_saldo_change` | Al bajar saldo de cliente, aplica pagos FIFO sobre ventas pendientes y las marca `entregada` cuando saldo = 0. **No actualiza `total_pagado`** — ese campo no es confiable |
| `handle_stock_on_venta_status_change` | Al cambiar estado de venta, ajusta stock de productos |
| `handle_venta_entregada_cta_cte` | Al entregar venta, registra movimiento en cuenta corriente |

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

### Estados de venta
`presupuesto` → `pendiente` → `en_distribucion` → `entregada` | `cancelada` | `anulada`

### Estructura de componentes
- Páginas en `src/pages/` — un archivo por ruta
- Modales como componentes separados en `src/components/`
- Lógica de negocio compartida en `src/hooks/`
- Generación de PDFs e imágenes en `src/utils/`

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

### n8n (workflow externo)
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

---

## Lo que NO hacer

- ❌ Nunca commitear `.env`
- ❌ Nunca usar `service_role` key en el frontend
- ❌ Nunca usar `new Date().toISOString()` para fechas de negocio
- ❌ Nunca deshabilitar RLS sin políticas definidas
- ❌ Nunca hacer UPDATE masivo en producción sin rollback o respaldo previo
- ❌ Nunca usar `saldo_acumulado` de la vista para mostrar el saldo actual del cliente
- ❌ Nunca asumir que `movimientos_stock` es fuente de verdad para reconstruir stock histórico (tiene datos contaminados por el bug de cancelaciones)

---

## Pendientes conocidos

- [ ] Habilitar RLS en 9 tablas que lo tienen deshabilitado (`categorias`, `movimientos_stock`, `proveedores`, `compras`, `compra_items`, `categorias_gasto`, `gastos_recurrentes`, `gastos`, `caja_cierres`)
- [ ] Investigar y corregir compra errónea de Lomo del 06/05/2026 (250.900 kg cargados en lugar de ~250 kg)
- [ ] Bife de chorizo con stock negativo (-5,75 kg) — requiere ajuste manual
- [ ] Mergear branch `fix/caja-historial-y-stock` a `main`
- [ ] Agregar `VITE_GEMINI_API_KEY` en Vercel para que funcione generación de imágenes en producción
