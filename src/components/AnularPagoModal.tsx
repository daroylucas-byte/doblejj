import React from 'react';
import { format, parseISO } from 'date-fns';
import { supabase } from '../lib/supabase';
import AnularMotivoModal from './AnularMotivoModal';

interface MovimientoPago {
    id: string;
    fecha: string;
    concepto: string;
    monto: number;
}

interface AnularPagoModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
    movimiento: MovimientoPago | null;
}

const AnularPagoModal: React.FC<AnularPagoModalProps> = ({ isOpen, onClose, onSuccess, movimiento }) => {
    if (!movimiento) return null;

    const monto = Math.abs(movimiento.monto).toLocaleString('es-AR', { minimumFractionDigits: 2 });

    return (
        <AnularMotivoModal
            isOpen={isOpen}
            onClose={onClose}
            titulo="Anular pago"
            resumen={`${format(parseISO(movimiento.fecha), 'dd/MM/yyyy')} · $ ${monto}`}
            descripcion={movimiento.concepto}
            advertencia={`La deuda del cliente va a aumentar en $ ${monto}. Si hay que volver a cobrar, registrá el cobro correcto después.`}
            textoBoton="Anular pago"
            onConfirm={async (motivo, detalle) => {
                const { error } = await supabase.rpc('anular_movimiento_pago', {
                    p_mov_id: movimiento.id,
                    p_motivo: motivo,
                    p_detalle: detalle,
                });
                if (error) throw error;
                onSuccess();
            }}
        />
    );
};

export default AnularPagoModal;
