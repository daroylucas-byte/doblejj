import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';

const Login: React.FC = () => {
    const navigate = useNavigate();
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setLoading(true);

        try {
            const { data, error: signInError } = await supabase.auth.signInWithPassword({
                email,
                password,
            });

            if (signInError) throw signInError;

            if (data.session) {
                navigate('/dashboard');
            }
        } catch (err: any) {
            setError(err.message || 'Error al iniciar sesión. Verifique sus credenciales.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="relative flex min-h-screen w-full flex-col bg-background-light dark:bg-background-dark overflow-x-hidden font-display text-slate-900 dark:text-slate-100">
            <div className="layout-container flex h-full grow flex-col">
                {/* Header/TopNavBar */}
                <header className="flex items-center justify-between border-b border-slate-200 dark:border-primary/20 px-6 lg:px-40 py-4 bg-white dark:bg-background-dark/50 backdrop-blur-md">
                    <div className="flex items-center gap-3">
                        <div className="size-10 flex items-center justify-center rounded-lg bg-primary text-secondary">
                            <span className="material-symbols-outlined text-3xl">hub</span>
                        </div>
                        <h2 className="text-xl font-bold leading-tight tracking-tight">DistribuApp</h2>
                    </div>
                </header>

                <main className="flex-1 flex items-center justify-center px-4 py-12">
                    <div className="layout-content-container flex flex-col w-full max-w-[480px] bg-white dark:bg-black/20 p-8 rounded-xl shadow-xl border border-slate-200 dark:border-primary/10">
                        <div className="flex flex-col items-center mb-8">
                            <div className="size-16 bg-primary rounded-full flex items-center justify-center mb-4 shadow-lg shadow-primary/20">
                                <span className="material-symbols-outlined text-white text-4xl">lock_open</span>
                            </div>
                            <h1 className="tracking-tight text-3xl font-bold leading-tight text-center">Iniciar Sesión</h1>
                            <p className="text-slate-600 dark:text-slate-400 text-base font-normal mt-2 text-center">Gestiona tu red de distribución</p>
                        </div>

                        {error && (
                            <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border-l-4 border-red-500 text-red-700 dark:text-red-400 flex items-center gap-3 rounded-r-lg animate-in fade-in slide-in-from-top-2">
                                <span className="material-symbols-outlined">error</span>
                                <p className="text-sm font-medium">{error}</p>
                            </div>
                        )}

                        <form className="flex flex-col gap-5" onSubmit={handleSubmit}>
                            {/* Email Field */}
                            <div className="flex flex-col gap-2">
                                <label className="text-slate-800 dark:text-slate-200 text-sm font-semibold uppercase tracking-wider">Correo electrónico</label>
                                <div className="relative">
                                    <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">mail</span>
                                    <input
                                        className="form-input flex w-full rounded-lg text-slate-900 dark:text-white border border-slate-300 dark:border-primary/30 bg-white dark:bg-background-dark/60 h-14 pl-12 pr-4 focus:ring-2 focus:ring-primary focus:border-primary transition-all placeholder:text-slate-400 outline-none"
                                        placeholder="nombre@empresa.com"
                                        required
                                        type="email"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                    />
                                </div>
                            </div>

                            {/* Password Field */}
                            <div className="flex flex-col gap-2">
                                <label className="text-slate-800 dark:text-slate-200 text-sm font-semibold uppercase tracking-wider">Contraseña</label>
                                <div className="relative">
                                    <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">key</span>
                                    <input
                                        className="form-input flex w-full rounded-lg text-slate-900 dark:text-white border border-slate-300 dark:border-primary/30 bg-white dark:bg-background-dark/60 h-14 pl-12 pr-12 focus:ring-2 focus:ring-primary focus:border-primary transition-all placeholder:text-slate-400 outline-none"
                                        placeholder="••••••••"
                                        required
                                        type={showPassword ? 'text' : 'password'}
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                    />
                                    <button
                                        className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-primary transition-colors"
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                    >
                                        <span className="material-symbols-outlined">
                                            {showPassword ? 'visibility_off' : 'visibility'}
                                        </span>
                                    </button>
                                </div>
                            </div>

                            {/* Options Row */}
                            <div className="flex items-center justify-between py-2">
                                <label className="flex items-center gap-2 cursor-pointer group">
                                    <input
                                        className="rounded border-slate-300 text-primary focus:ring-primary bg-white dark:bg-background-dark"
                                        type="checkbox"
                                    />
                                    <span className="text-slate-600 dark:text-slate-400 text-sm font-medium group-hover:text-primary transition-colors">Recordarme</span>
                                </label>
                                <a className="text-primary dark:text-accent font-semibold text-sm hover:underline decoration-2 underline-offset-4" href="#">¿Olvidaste tu contraseña?</a>
                            </div>

                            {/* Submit Button */}
                            <button
                                className="w-full bg-primary hover:bg-primary/90 text-white font-bold h-14 rounded-lg shadow-lg shadow-primary/30 transition-all flex items-center justify-center gap-2 group disabled:opacity-70 disabled:cursor-not-allowed"
                                type="submit"
                                disabled={loading}
                            >
                                {loading ? (
                                    <>
                                        <span className="size-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                                        <span>Iniciando sesión...</span>
                                    </>
                                ) : (
                                    <>
                                        <span>Ingresar al Panel</span>
                                        <span className="material-symbols-outlined group-hover:translate-x-1 transition-transform">arrow_forward</span>
                                    </>
                                )}
                            </button>
                        </form>

                        {/* Registration Link */}
                        <div className="mt-8 pt-6 border-t border-slate-200 dark:border-primary/10 text-center">
                            <p className="text-slate-600 dark:text-slate-400 text-sm">
                                ¿No tienes una cuenta aún?
                                <Link className="text-primary dark:text-accent font-bold hover:underline decoration-2 underline-offset-4 ml-1" to="/register">Regístrate ahora</Link>
                            </p>
                        </div>
                    </div>
                </main>

                {/* Footer */}
                <footer className="py-6 px-10 text-center">
                    <p className="text-slate-500 dark:text-slate-500 text-xs">© 2024 DistribuApp. Todos los derechos reservados.</p>
                </footer>
            </div>
        </div>
    );
};

export default Login;
