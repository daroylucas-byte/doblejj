import { create } from 'zustand';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

interface AuthState {
    session: Session | null;
    user: User | null;
    // Rol del perfil (null = todavía no se cargó o no se pudo leer). Solo se usa para mostrar
    // el cartel de "cuenta pendiente"; los permisos reales los aplica la base de datos.
    rol: string | null;
    loading: boolean;
    initialize: () => Promise<void>;
    setSession: (session: Session | null) => void;
    signOut: () => Promise<void>;
}

// Evita repetir la consulta: initialize() y onAuthStateChange disparan varios eventos por carga
let rolSolicitadoDe: string | null = null;

const cargarRol = async (userId: string) => {
    if (rolSolicitadoDe === userId) return;
    rolSolicitadoDe = userId;
    const { data } = await supabase.from('profiles').select('rol').eq('id', userId).maybeSingle();
    useAuthStore.setState({ rol: data?.rol ?? null });
};

export const useAuthStore = create<AuthState>((set) => ({
    session: null,
    user: null,
    rol: null,
    loading: true,
    initialize: async () => {
        const { data: { session } } = await supabase.auth.getSession();
        set({
            session,
            user: session?.user ?? null,
            loading: false
        });
        if (session?.user) cargarRol(session.user.id);
    },
    setSession: (session) => {
        set(session
            ? { session, user: session.user, loading: false }
            : { session: null, user: null, rol: null, loading: false });
        if (!session) rolSolicitadoDe = null;
        // setTimeout: no hacer consultas a Supabase dentro del callback de onAuthStateChange
        if (session?.user) setTimeout(() => cargarRol(session.user.id), 0);
    },
    signOut: async () => {
        rolSolicitadoDe = null;
        await supabase.auth.signOut();
        set({ session: null, user: null, rol: null, loading: false });
    },
}));

// Initialize session listener
supabase.auth.onAuthStateChange((_event, session) => {
    useAuthStore.getState().setSession(session);
});
