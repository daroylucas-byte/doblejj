import { create } from 'zustand';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

interface AuthState {
    session: Session | null;
    user: User | null;
    loading: boolean;
    initialize: () => Promise<void>;
    setSession: (session: Session | null) => void;
    signOut: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
    session: null,
    user: null,
    loading: true,
    initialize: async () => {
        const { data: { session } } = await supabase.auth.getSession();
        set({
            session,
            user: session?.user ?? null,
            loading: false
        });
    },
    setSession: (session) => set({
        session,
        user: session?.user ?? null,
        loading: false
    }),
    signOut: async () => {
        await supabase.auth.signOut();
        set({ session: null, user: null, loading: false });
    },
}));

// Initialize session listener
supabase.auth.onAuthStateChange((_event, session) => {
    useAuthStore.getState().setSession(session);
});
