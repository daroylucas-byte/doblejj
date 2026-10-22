export type MotivoAnulacion = 'error_carga' | 'cheque_rechazado' | 'devolucion' | 'otro';

export const MOTIVOS_ANULACION: { value: MotivoAnulacion; label: string; ayuda: string }[] = [
    { value: 'error_carga', label: 'Error de carga', ayuda: 'Se cargó mal (monto, cliente o forma de pago). No aparece en el resumen del cliente.' },
    { value: 'cheque_rechazado', label: 'Cheque rechazado', ayuda: 'Aparece en el resumen del cliente.' },
    { value: 'devolucion', label: 'Devolución o ajuste acordado', ayuda: 'Aparece en el resumen del cliente.' },
    { value: 'otro', label: 'Otro', ayuda: 'Requiere un detalle. Aparece en el resumen del cliente.' },
];

// Qué movimientos se ocultan y cuánto vale el saldo sin ellos lo calcula la base
// (vista_cuenta_corriente_resumen); acá solo viven las constantes de presentación.
