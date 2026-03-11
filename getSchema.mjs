import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const url = process.env.VITE_SUPABASE_URL;
const key = process.env.VITE_SUPABASE_ANON_KEY;

if (!url || !key) {
    console.error("Missing URL or KEY");
    process.exit(1);
}

const getOpenAPI = async () => {
    const res = await fetch(`${url}/rest/v1/?apikey=${key}`);
    const data = await res.json();

    const comprasTable = data.definitions?.compras;
    if (comprasTable) {
        console.log("compras:", JSON.stringify(comprasTable.properties.estado, null, 2));
    } else {
        console.log("No compras table in definitions");
    }
}
getOpenAPI();
