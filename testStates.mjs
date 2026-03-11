import { createClient } from '@supabase/supabase-js';

const url = 'https://txyqovlcftvgthqvfpxk.supabase.co';
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR4eXFvdmxjZnR2Z3RocXZmcHhrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMwODc4MDQsImV4cCI6MjA4ODY2MzgwNH0.jJOqba8oUeLGqJkoLYGI0Pl_sUx8nCLI75Oxxo-Ejws';
const supabase = createClient(url, key);

async function testStates() {
    const states = ['confirmada', 'completada', 'pagada', 'entregada', 'recibida', 'pendiente'];

    // We just find one supplier
    const { data: provs } = await supabase.from('proveedores').select('id').limit(1);
    const provId = provs[0].id;

    for (const state of states) {
        console.log(`Trying ${state}...`);
        const { error } = await supabase.from('compras').insert({
            proveedor_id: provId,
            total: 0,
            estado: state
        });

        if (!error) {
            console.log(`SUCCESS with state: ${state}`);
            // Let's delete it so we don't pollute
            await supabase.from('compras').delete().eq('estado', state);
            break;
        } else {
            console.log(`Failed with state ${state}: ${error.message}`);
        }
    }
}
testStates();
