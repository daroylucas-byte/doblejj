import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';


interface VentaItem {
    id?: string;
    producto_id?: string;
    cantidad: number;
    precio_unitario: number;
    subtotal: number;
    productos?: {
        nombre: string;
        codigo?: string | null;
    } | null;
}

interface Cliente {
    razon_social: string;
    cuit?: string;
    direccion?: string;
}

interface Venta {
    id: string;
    numero?: string;
    fecha: string;
    created_at?: string;
    total: number;
    estado: string;
    clientes?: Cliente;
    cliente?: Cliente; // Alias for compatibility with some queries
    venta_items?: VentaItem[];
}

export const generateSaleTicket = (venta: Venta, items: VentaItem[], aclaracion?: string) => {
    console.log("Generando Ticket PDF...", { venta, items });
    try {
        const doc = new jsPDF({
            unit: 'mm',
            format: [72, 290] // Thermal ticket format (72mm width x 290mm height)
        });

        const pageWidth = doc.internal.pageSize.width;
        const margin = 4; // Slightly narrower margin for thermal printers

        // Logo
        try {
            // We use the logo from the public folder
            doc.addImage('/logo_ticket.png', 'PNG', (pageWidth - 20) / 2, 5, 20, 20);
        } catch (e) {
            console.warn("Logo not found, skipping...", e);
        }

        // Header
        doc.setFontSize(11);
        doc.setFont('helvetica', 'bold');
        doc.text('DOBLE JJ ABASTECIMIENTOS', pageWidth / 2, 30, { align: 'center' });

        doc.setFontSize(8);
        doc.setFont('helvetica', 'normal');
        doc.text('Mayorista de Carnes', pageWidth / 2, 34, { align: 'center' });
        doc.line(margin, 36, pageWidth - margin, 36);

        // Sale Info
        doc.setFontSize(8);
        doc.text(`Ticket Nro: ${venta.numero || venta.id.slice(0, 8)}`, margin, 41);

        // Use created_at (UTC) which new Date() converts to local time correctly, 
        // or parseISO(venta.fecha) as fallback for local date matching.
        const ticketDate = venta.created_at ? new Date(venta.created_at) : parseISO(venta.fecha);
        doc.text(`Fecha: ${format(ticketDate, 'dd/MM/yyyy HH:mm', { locale: es })}`, margin, 45);
        doc.text(`Estado: ${venta.estado.toUpperCase()}`, margin, 49);

        // Client Info
        const cliente = venta.clientes || venta.cliente;
        if (cliente) {
            doc.setFont('helvetica', 'bold');
            doc.text('CLIENTE:', margin, 55);
            doc.setFont('helvetica', 'normal');
            doc.text(cliente.razon_social, margin + 15, 55);
            if (cliente.cuit) {
                doc.text(`CUIT: ${cliente.cuit}`, margin, 59);
            }
        }

        doc.line(margin, 62, pageWidth - margin, 62);

        // Items Table
        const tableData = items.map(item => [
            item.productos?.nombre || 'Producto',
            item.cantidad.toString(),
            `$ ${item.precio_unitario.toLocaleString('es-AR')}`,
            `$ ${item.subtotal.toLocaleString('es-AR')}`
        ]);

        autoTable(doc, {
            startY: 64,
            head: [['Detalle', 'Cant', 'P.Uni', 'Subt']],
            body: tableData,
            theme: 'plain',
            styles: { fontSize: 7, cellPadding: 1 },
            headStyles: { fillColor: [240, 240, 240], textColor: [0, 0, 0], fontStyle: 'bold' },
            margin: { left: margin, right: margin },
            columnStyles: {
                0: { cellWidth: 'auto' },
                1: { halign: 'center' },
                2: { halign: 'right' },
                3: { halign: 'right' }
            }
        });

        const finalY = (doc as any).lastAutoTable.finalY + 5;

        // Totals
        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.text('TOTAL:', margin, finalY);
        doc.text(`$ ${venta.total.toLocaleString('es-AR', { minimumFractionDigits: 2 })}`, pageWidth - margin, finalY, { align: 'right' });

        // Signature Section
        const sigY = finalY + 25;
        doc.line(margin, sigY, (pageWidth / 2) - 5, sigY);
        doc.line((pageWidth / 2) + 5, sigY, pageWidth - margin, sigY);

        doc.setFontSize(8);
        doc.setFont('helvetica', 'bold');
        doc.text('FIRMA RECIBIDO', margin + ((pageWidth / 2) - 5 - margin) / 2, sigY + 4, { align: 'center' });
        doc.text('ACLARACIÓN', (pageWidth / 2) + 5 + (pageWidth - margin - ((pageWidth / 2) + 5)) / 2, sigY + 4, { align: 'center' });

        if (aclaracion) {
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(9);
            doc.text(aclaracion.toUpperCase(), (pageWidth / 2) + 5 + (pageWidth - margin - ((pageWidth / 2) + 5)) / 2, sigY - 2, { align: 'center' });
        }

        // Footer
        doc.setFontSize(7);
        doc.setFont('helvetica', 'italic');
        doc.text('¡Gracias por su compra!', pageWidth / 2, sigY + 12, { align: 'center' });
        doc.text('Pedidos: 3541625537 / ADMIN: 3541625536', pageWidth / 2, sigY + 16, { align: 'center' });

        // Output
        const url = doc.output('bloburl');
        console.log("PDF Generado exitosamente.");
        return url;

    } catch (error) {
        console.error("Error crítico generando el PDF:", error);
        throw error;
    }
};

export const generateClientStatement = (
    cliente: { razon_social: string; cuit?: string; direccion?: string; localidad?: string }, 
    movimientos: any[], 
    fechaInicio?: string, 
    fechaFin?: string
) => {
    try {
        const doc = new jsPDF({
            unit: 'mm',
            format: 'a4'
        });

        const pageWidth = doc.internal.pageSize.width;
        const margin = 15;

        // Logo
        try {
            doc.addImage('/logo_ticket.png', 'PNG', margin, 10, 30, 30);
        } catch (e) {
            console.warn("Logo not found", e);
        }

        // Company Info (Header Right)
        doc.setFontSize(16);
        doc.setFont('helvetica', 'bold');
        doc.text('DOBLE JJ ABASTECIMIENTOS', pageWidth - margin, 15, { align: 'right' });
        
        doc.setFontSize(9);
        doc.setFont('helvetica', 'normal');
        doc.text('Mayorista de Carnes', pageWidth - margin, 20, { align: 'right' });
        doc.text('Dirección: Carlos Paz, Córdoba', pageWidth - margin, 24, { align: 'right' });
        doc.text('Tel: 3541625537 / 3541625536', pageWidth - margin, 28, { align: 'right' });
        
        doc.line(margin, 42, pageWidth - margin, 42);

        // Statement Title
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.text('RESUMEN DE CUENTA CORRIENTE', pageWidth / 2, 52, { align: 'center' });

        // Period Info
        if (fechaInicio || fechaFin) {
            doc.setFontSize(9);
            const periodo = `Período: ${fechaInicio ? format(parseISO(fechaInicio), 'dd/MM/yyyy') : 'Inicio'} al ${fechaFin ? format(parseISO(fechaFin), 'dd/MM/yyyy') : 'Hoy'}`;
            doc.text(periodo, pageWidth / 2, 58, { align: 'center' });
        }

        // Client Info Box
        doc.setFillColor(245, 245, 245);
        doc.roundedRect(margin, 65, pageWidth - (margin * 2), 25, 2, 2, 'F');
        
        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.text('DATOS DEL CLIENTE', margin + 5, 71);
        
        doc.setFontSize(11);
        doc.text(cliente.razon_social, margin + 5, 78);
        
        doc.setFontSize(9);
        doc.setFont('helvetica', 'normal');
        doc.text(`CUIT: ${cliente.cuit || 'S/N'}`, margin + 5, 83);
        doc.text(`Dirección: ${cliente.direccion || 'S/D'} ${cliente.localidad ? `- ${cliente.localidad}` : ''}`, pageWidth - margin - 5, 83, { align: 'right' });

        // Table
        const tableData = movimientos.map(m => {
            const isDebe = m.tipo === 'cargo' || m.tipo === 'nota_debito';
            const isHaber = m.tipo === 'pago' || m.tipo === 'nota_credito';
            return [
                format(parseISO(m.fecha), 'dd/MM/yyyy'),
                m.concepto,
                isDebe ? `$ ${m.monto.toLocaleString('es-AR')}` : '-',
                isHaber ? `$ ${m.monto.toLocaleString('es-AR')}` : '-',
                `$ ${m.saldo_acumulado.toLocaleString('es-AR')}`
            ];
        });

        autoTable(doc, {
            startY: 95,
            head: [['Fecha', 'Concepto', 'Debe', 'Haber', 'Saldo']],
            body: tableData,
            theme: 'striped',
            headStyles: { fillColor: [240, 100, 30], textColor: [255, 255, 255] }, // Match primary color approx
            styles: { fontSize: 8, cellPadding: 3 },
            columnStyles: {
                0: { cellWidth: 20 },
                1: { cellWidth: 'auto' },
                2: { halign: 'right', cellWidth: 25 },
                3: { halign: 'right', cellWidth: 25 },
                4: { halign: 'right', cellWidth: 30, fontStyle: 'bold' }
            }
        });

        const finalY = (doc as any).lastAutoTable.finalY + 10;
        const currentBalance = movimientos.length > 0 ? movimientos[0].saldo_acumulado : 0;

        // Final Summary
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.text('SALDO FINAL:', pageWidth - margin - 50, finalY);
        doc.setTextColor(currentBalance < 0 ? 200 : 0, currentBalance < 0 ? 0 : 150, 0); // Red if debt, Green if favor
        doc.text(`$ ${Math.abs(currentBalance).toLocaleString('es-AR')}`, pageWidth - margin, finalY, { align: 'right' });
        
        doc.setFontSize(9);
        doc.setTextColor(100);
        doc.text(currentBalance < 0 ? '(Saldo Deudor)' : '(Saldo a Favor)', pageWidth - margin, finalY + 5, { align: 'right' });

        // Footer
        doc.setFontSize(8);
        doc.setFont('helvetica', 'italic');
        doc.setTextColor(150);
        const reportDate = format(new Date(), "dd/MM/yyyy HH:mm'hs'");
        doc.text(`Generado el: ${reportDate}`, margin, doc.internal.pageSize.height - 10);
        doc.text(`Página 1`, pageWidth - margin, doc.internal.pageSize.height - 10, { align: 'right' });

        // Open
        const url = doc.output('bloburl');
        window.open(url, '_blank');

    } catch (error) {
        console.error("Error generating Statement PDF:", error);
        alert("Error al generar el PDF del resumen de cuenta.");
    }
};

export const generateSupplierStatement = (
    proveedor: { razon_social: string; cuit?: string; direccion?: string; localidad?: string }, 
    movimientos: any[], 
    fechaInicio?: string, 
    fechaFin?: string
) => {
    try {
        const doc = new jsPDF({
            unit: 'mm',
            format: 'a4'
        });

        const pageWidth = doc.internal.pageSize.width;
        const margin = 15;

        // Logo
        try {
            doc.addImage('/logo_ticket.png', 'PNG', margin, 10, 30, 30);
        } catch (e) {
            console.warn("Logo not found", e);
        }

        // Company Info (Header Right)
        doc.setFontSize(16);
        doc.setFont('helvetica', 'bold');
        doc.text('DOBLE JJ ABASTECIMIENTOS', pageWidth - margin, 15, { align: 'right' });
        
        doc.setFontSize(9);
        doc.setFont('helvetica', 'normal');
        doc.text('Mayorista de Carnes', pageWidth - margin, 20, { align: 'right' });
        doc.text('Dirección: Carlos Paz, Córdoba', pageWidth - margin, 24, { align: 'right' });
        doc.text('Tel: 3541625537 / 3541625536', pageWidth - margin, 28, { align: 'right' });
        
        doc.line(margin, 42, pageWidth - margin, 42);

        // Statement Title
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.text('RESUMEN DE CUENTA CORRIENTE (PROVEEDOR)', pageWidth / 2, 52, { align: 'center' });

        // Period Info
        if (fechaInicio || fechaFin) {
            doc.setFontSize(9);
            const periodo = `Período: ${fechaInicio ? format(parseISO(fechaInicio), 'dd/MM/yyyy') : 'Inicio'} al ${fechaFin ? format(parseISO(fechaFin), 'dd/MM/yyyy') : 'Hoy'}`;
            doc.text(periodo, pageWidth / 2, 58, { align: 'center' });
        }

        // Supplier Info Box
        doc.setFillColor(245, 245, 245);
        doc.roundedRect(margin, 65, pageWidth - (margin * 2), 25, 2, 2, 'F');
        
        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.text('DATOS DEL PROVEEDOR', margin + 5, 71);
        
        doc.setFontSize(11);
        doc.text(proveedor.razon_social, margin + 5, 78);
        
        doc.setFontSize(9);
        doc.setFont('helvetica', 'normal');
        doc.text(`CUIT: ${proveedor.cuit || 'S/N'}`, margin + 5, 83);
        doc.text(`Dirección: ${proveedor.direccion || 'S/D'} ${proveedor.localidad ? `- ${proveedor.localidad}` : ''}`, pageWidth - margin - 5, 83, { align: 'right' });

        // Table
        const tableData = movimientos.map(m => {
            const isHaber = m.monto < 0 || m.tipo === 'cargo' || m.tipo === 'nota_debito';
            const isDebe = m.monto > 0 || m.tipo === 'pago' || m.tipo === 'nota_credito';
            
            return [
                format(parseISO(m.fecha), 'dd/MM/yyyy'),
                m.concepto,
                isDebe ? `$ ${Math.abs(m.monto).toLocaleString('es-AR')}` : '-',
                isHaber ? `$ ${Math.abs(m.monto).toLocaleString('es-AR')}` : '-',
                `$ ${m.saldo_acumulado.toLocaleString('es-AR')}`
            ];
        });

        autoTable(doc, {
            startY: 95,
            head: [['Fecha', 'Concepto', 'Debe', 'Haber', 'Saldo']],
            body: tableData,
            theme: 'striped',
            headStyles: { fillColor: [240, 100, 30], textColor: [255, 255, 255] }, 
            styles: { fontSize: 8, cellPadding: 3 },
            columnStyles: {
                0: { cellWidth: 20 },
                1: { cellWidth: 'auto' },
                2: { halign: 'right', cellWidth: 25 },
                3: { halign: 'right', cellWidth: 25 },
                4: { halign: 'right', cellWidth: 30, fontStyle: 'bold' }
            }
        });

        const finalY = (doc as any).lastAutoTable.finalY + 10;
        const currentBalance = movimientos.length > 0 ? movimientos[0].saldo_acumulado : 0;

        // Final Summary
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.text('SALDO FINAL:', pageWidth - margin - 50, finalY);
        // Note: For suppliers, negative balance means we owe them (debt).
        doc.setTextColor(currentBalance < 0 ? 200 : 0, currentBalance < 0 ? 0 : 150, 0); 
        doc.text(`$ ${Math.abs(currentBalance).toLocaleString('es-AR')}`, pageWidth - margin, finalY, { align: 'right' });
        
        doc.setFontSize(9);
        doc.setTextColor(100);
        doc.text(currentBalance < 0 ? '(Saldo Deudor - Debemos)' : '(Saldo a Favor)', pageWidth - margin, finalY + 5, { align: 'right' });

        // Footer
        doc.setFontSize(8);
        doc.setFont('helvetica', 'italic');
        doc.setTextColor(150);
        const reportDate = format(new Date(), "dd/MM/yyyy HH:mm'hs'");
        doc.text(`Generado el: ${reportDate}`, margin, doc.internal.pageSize.height - 10);
        doc.text(`Página 1`, pageWidth - margin, doc.internal.pageSize.height - 10, { align: 'right' });

        // Open
        const url = doc.output('bloburl');
        window.open(url, '_blank');

    } catch (error) {
        console.error("Error generating Statement PDF:", error);
        alert("Error al generar el PDF del resumen de cuenta.");
    }
};
