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
