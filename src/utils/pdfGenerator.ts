import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';
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
    total: number;
    estado: string;
    clientes?: Cliente;
    cliente?: Cliente; // Alias for compatibility with some queries
    venta_items?: VentaItem[];
}

export const generateSaleTicket = (venta: Venta, items: VentaItem[]) => {
    console.log("Generando Ticket PDF...", { venta, items });
    try {
        const doc = new jsPDF({
            unit: 'mm',
            format: [80, 150] // Ticket format (80mm width)
        });

    const pageWidth = doc.internal.pageSize.width;
    const margin = 5;

    // Logo
    try {
        // We use the logo from the public folder
        doc.addImage('/logo_ticket.png', 'PNG', (pageWidth - 25) / 2, 5, 25, 25);
    } catch (e) {
        console.warn("Logo not found, skipping...", e);
    }

    // Header
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('DOBLE JJ ABASTECIMIENTOS', pageWidth / 2, 35, { align: 'center' });
    
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.text('Distribuidora de Alimentos', pageWidth / 2, 39, { align: 'center' });
    doc.line(margin, 41, pageWidth - margin, 41);

    // Sale Info
    doc.setFontSize(9);
    doc.text(`Ticket Nro: ${venta.numero || venta.id.slice(0, 8)}`, margin, 47);
    doc.text(`Fecha: ${format(new Date(venta.fecha), 'dd/MM/yyyy HH:mm', { locale: es })}`, margin, 51);
    doc.text(`Estado: ${venta.estado.toUpperCase()}`, margin, 55);
    
    // Client Info
    const cliente = venta.clientes || venta.cliente;
    if (cliente) {
        doc.setFont('helvetica', 'bold');
        doc.text('CLIENTE:', margin, 61);
        doc.setFont('helvetica', 'normal');
        doc.text(cliente.razon_social, margin + 15, 61);
        if (cliente.cuit) {
            doc.text(`CUIT: ${cliente.cuit}`, margin, 65);
        }
    }

    doc.line(margin, 67, pageWidth - margin, 67);

    // Items Table
    const tableData = items.map(item => [
        item.productos?.nombre || 'Producto',
        item.cantidad.toString(),
        `$ ${item.precio_unitario.toLocaleString('es-AR')}`,
        `$ ${item.subtotal.toLocaleString('es-AR')}`
    ]);

    autoTable(doc, {
        startY: 69,
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

    // Footer
    doc.setFontSize(7);
    doc.setFont('helvetica', 'italic');
    doc.text('¡Gracias por su compra!', pageWidth / 2, finalY + 10, { align: 'center' });
    doc.text('Ventas: 3541524255', pageWidth / 2, finalY + 14, { align: 'center' });

    // Output
    const url = doc.output('bloburl');
    console.log("PDF Generado exitosamente. Abriendo en nueva pestaña...");
    
    const newWindow = window.open(url, '_blank');
    if (!newWindow || newWindow.closed || typeof newWindow.closed === 'undefined') {
        alert("El navegador bloqueó la apertura del ticket. Por favor, habilite las ventanas emergentes (popups) para este sitio.");
    }
    } catch (error) {
        console.error("Error crítico generando el PDF:", error);
        alert("Error al generar el ticket PDF. Revise la consola para más detalles.");
    }
};
