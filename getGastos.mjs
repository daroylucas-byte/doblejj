import { createClient } from '@supabase/supabase-js';

const url = 'https://txyqovlcftvgthqvfpxk.supabase.co';
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR4eXFvdmxjZnR2Z3RocXZmcHhrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMwODc4MDQsImV4cCI6MjA4ODY2MzgwNH0.jJOqba8oUeLGqJkoLYGI0Pl_sUx8nCLI75Oxxo-Ejws';

const getOpenAPI = async () => {
    const res = await fetch(`${url}/rest/v1/?apikey=${key}`);
    const data = await res.json();
    console.log("gastos:", Object.keys(data.definitions.gastos.properties));
}
getOpenAPI();
