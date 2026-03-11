import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';

const Register: React.FC = () => {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);

    const [formData, setFormData] = useState({
        nombre: '',
        email: '',
        password: '',
        confirmPassword: '',
        role: 'vendedor',
        acceptTerms: false
    });

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value, type, checked } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: type === 'checkbox' ? checked : value
        }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setSuccess(false);

        if (formData.password !== formData.confirmPassword) {
            setError('Las contraseñas no coinciden');
            return;
        }

        setLoading(true);

        try {
            // Split name into nombre and apellido for the DB trigger
            const nameParts = formData.nombre.trim().split(/\s+/);
            const nombre = nameParts[0] || 'Usuario';
            const apellido = nameParts.slice(1).join(' ') || 'Nuevo';

            const { data, error: signUpError } = await supabase.auth.signUp({
                email: formData.email,
                password: formData.password,
                options: {
                    data: {
                        nombre: nombre,
                        apellido: apellido,
                        rol: formData.role
                    }
                }
            });

            if (signUpError) throw signUpError;

            if (data) {
                setSuccess(true);
                setTimeout(() => {
                    navigate('/login');
                }, 3000);
            }
        } catch (err: any) {
            setError(err.message || 'Error al registrar el usuario');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="relative flex min-h-screen w-full flex-col overflow-x-hidden bg-stone-50 dark:bg-background-dark font-display text-stone-900 dark:text-stone-100">
            <div className="layout-container flex h-full grow flex-col">
                {/* Navigation Header */}
                <header className="flex items-center justify-between border-b border-stone-200 dark:border-stone-800 px-6 py-4 lg:px-20 bg-white dark:bg-background-dark/50 backdrop-blur-md sticky top-0 z-50">
                    <div className="flex items-center gap-3">
                        <div className="size-8 flex items-center justify-center bg-primary rounded-lg text-white">
                            <span className="material-symbols-outlined">inventory_2</span>
                        </div>
                        <h2 className="text-xl font-bold leading-tight tracking-tight">DistribuApp</h2>
                    </div>
                </header>

                <main className="flex flex-1 items-center justify-center p-4 py-12 md:p-8">
                    <div className="w-full max-w-[1100px] grid grid-cols-1 lg:grid-cols-2 bg-white dark:bg-stone-900/50 rounded-2xl overflow-hidden shadow-2xl border border-stone-200 dark:border-stone-800">

                        {/* Left Side: Visual / Branding */}
                        <div className="hidden lg:flex flex-col justify-between p-12 bg-gradient-to-br from-stone-900 to-background-dark relative overflow-hidden">
                            <div
                                className="absolute inset-0 opacity-20 pointer-events-none"
                                style={{
                                    backgroundImage: "url('https://lh3.googleusercontent.com/aida-public/AB6AXuCkKmcdjB6Mx8B6gxegbUYftkakWWmmY_KFUb1iQsN7VCAHAgcS8K30wimLHfWOt9KBnO9DUUmAbI_kyJ5uh4UX7uFZpUvPkSLCihcI3qGKY3VkWEH1RNCbpvWsSgC5mQZij54zyXfmPVC8sIPJn9nBA5jdsyeQKb02tdhus5FXPP6Fd1y-Eu6cLSRRH5Ni_oXo5X6znKkxxBuXUAnFby8wP40m4slElGaWqgfhIjkjhSNMw-zLkJkscZavEWwo7LEUHCG0bBjL16Q')",
                                    backgroundSize: 'cover'
                                }}
                            />
                            <div className="relative z-10">
                                <h1 className="text-4xl font-black text-white leading-tight mb-6">Optimiza tu distribución con <span className="text-primary">DistribuApp</span></h1>
                                <p className="text-stone-300 text-lg max-w-md">La plataforma integral para la gestión de ventas, depósitos y cajas diseñada para el crecimiento de tu negocio.</p>
                            </div>
                            <div className="relative z-10 space-y-6 text-white font-medium">
                                <div className="flex items-center gap-4">
                                    <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center text-primary">
                                        <span className="material-symbols-outlined">check_circle</span>
                                    </div>
                                    <span>Control de inventario en tiempo real</span>
                                </div>
                                <div className="flex items-center gap-4">
                                    <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center text-primary">
                                        <span className="material-symbols-outlined">check_circle</span>
                                    </div>
                                    <span>Gestión de ventas eficiente</span>
                                </div>
                                <div className="flex items-center gap-4">
                                    <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center text-primary">
                                        <span className="material-symbols-outlined">check_circle</span>
                                    </div>
                                    <span>Reportes financieros automáticos</span>
                                </div>
                            </div>
                        </div>

                        {/* Right Side: Registration Form */}
                        <div className="p-8 md:p-12">
                            <div className="mb-8">
                                <h2 className="text-3xl font-bold">Crear Cuenta</h2>
                                <p className="text-stone-500 dark:text-stone-400 mt-2">Complete los datos para registrarse en el sistema</p>
                            </div>

                            {error && (
                                <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border-l-4 border-red-500 text-red-700 dark:text-red-400 flex items-center gap-3 rounded-r-lg animate-in fade-in slide-in-from-top-2">
                                    <span className="material-symbols-outlined">error</span>
                                    <p className="text-sm font-medium">{error}</p>
                                </div>
                            )}

                            {success && (
                                <div className="mb-6 p-4 bg-green-50 dark:bg-green-900/20 border-l-4 border-green-500 text-green-700 dark:text-green-400 flex items-center gap-3 rounded-r-lg animate-in fade-in slide-in-from-top-2">
                                    <span className="material-symbols-outlined">check_circle</span>
                                    <p className="text-sm font-medium">¡Registro exitoso! Redirigiendo al login...</p>
                                </div>
                            )}

                            <form className="space-y-4" onSubmit={handleSubmit}>
                                {/* Full Name */}
                                <div>
                                    <label className="block text-sm font-semibold text-stone-700 dark:text-stone-300 mb-1.5">Nombre completo</label>
                                    <div className="relative">
                                        <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-stone-400 text-xl">person</span>
                                        <input
                                            name="nombre"
                                            type="text"
                                            value={formData.nombre}
                                            onChange={handleChange}
                                            className="w-full pl-10 pr-4 py-3 bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent transition-all outline-none"
                                            placeholder="Ej: Juan Pérez"
                                            required
                                        />
                                    </div>
                                </div>

                                {/* Email */}
                                <div>
                                    <label className="block text-sm font-semibold text-stone-700 dark:text-stone-300 mb-1.5">Correo electrónico</label>
                                    <div className="relative">
                                        <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-stone-400 text-xl">mail</span>
                                        <input
                                            name="email"
                                            type="email"
                                            value={formData.email}
                                            onChange={handleChange}
                                            className="w-full pl-10 pr-4 py-3 bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent transition-all outline-none"
                                            placeholder="correo@ejemplo.com"
                                            required
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {/* Password */}
                                    <div>
                                        <label className="block text-sm font-semibold text-stone-700 dark:text-stone-300 mb-1.5">Contraseña</label>
                                        <div className="relative">
                                            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-stone-400 text-xl">lock</span>
                                            <input
                                                name="password"
                                                type="password"
                                                value={formData.password}
                                                onChange={handleChange}
                                                className="w-full pl-10 pr-4 py-3 bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent transition-all outline-none"
                                                placeholder="••••••••"
                                                required
                                            />
                                        </div>
                                    </div>
                                    {/* Confirm Password */}
                                    <div>
                                        <label className="block text-sm font-semibold text-stone-700 dark:text-stone-300 mb-1.5">Confirmar contraseña</label>
                                        <div className="relative">
                                            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-stone-400 text-xl">lock_reset</span>
                                            <input
                                                name="confirmPassword"
                                                type="password"
                                                value={formData.confirmPassword}
                                                onChange={handleChange}
                                                className="w-full pl-10 pr-4 py-3 bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent transition-all outline-none"
                                                placeholder="••••••••"
                                                required
                                            />
                                        </div>
                                    </div>
                                </div>

                                {/* Role Selection */}
                                <div>
                                    <label className="block text-sm font-semibold text-stone-700 dark:text-stone-300 mb-2">Seleccione su Rol</label>
                                    <div className="grid grid-cols-3 gap-3">
                                        <label className="cursor-pointer">
                                            <input
                                                type="radio"
                                                name="role"
                                                value="vendedor"
                                                checked={formData.role === 'vendedor'}
                                                onChange={handleChange}
                                                className="peer hidden"
                                            />
                                            <div className="flex flex-col items-center justify-center p-3 rounded-xl border-2 border-stone-100 dark:border-stone-800 bg-stone-50 dark:bg-stone-800/50 peer-checked:border-primary peer-checked:bg-primary/5 transition-all">
                                                <span className="material-symbols-outlined text-stone-400 peer-checked:text-primary">storefront</span>
                                                <span className="text-xs font-bold mt-1 text-stone-600 dark:text-stone-400">Vendedor</span>
                                            </div>
                                        </label>
                                        <label className="cursor-pointer">
                                            <input
                                                type="radio"
                                                name="role"
                                                value="deposito"
                                                checked={formData.role === 'deposito'}
                                                onChange={handleChange}
                                                className="peer hidden"
                                            />
                                            <div className="flex flex-col items-center justify-center p-3 rounded-xl border-2 border-stone-100 dark:border-stone-800 bg-stone-50 dark:bg-stone-800/50 peer-checked:border-primary peer-checked:bg-primary/5 transition-all">
                                                <span className="material-symbols-outlined text-stone-400 peer-checked:text-primary">warehouse</span>
                                                <span className="text-xs font-bold mt-1 text-stone-600 dark:text-stone-400">Depósito</span>
                                            </div>
                                        </label>
                                        <label className="cursor-pointer">
                                            <input
                                                type="radio"
                                                name="role"
                                                value="caja"
                                                checked={formData.role === 'caja'}
                                                onChange={handleChange}
                                                className="peer hidden"
                                            />
                                            <div className="flex flex-col items-center justify-center p-3 rounded-xl border-2 border-stone-100 dark:border-stone-800 bg-stone-50 dark:bg-stone-800/50 peer-checked:border-primary peer-checked:bg-primary/5 transition-all">
                                                <span className="material-symbols-outlined text-stone-400 peer-checked:text-primary">payments</span>
                                                <span className="text-xs font-bold mt-1 text-stone-600 dark:text-stone-400">Caja</span>
                                            </div>
                                        </label>
                                    </div>
                                </div>

                                {/* Terms and Conditions */}
                                <div className="flex items-start gap-3 py-2">
                                    <input
                                        name="acceptTerms"
                                        type="checkbox"
                                        checked={formData.acceptTerms}
                                        onChange={handleChange}
                                        className="mt-1 rounded border-stone-300 text-primary focus:ring-primary"
                                        required
                                    />
                                    <p className="text-xs text-stone-500 dark:text-stone-400 leading-relaxed">
                                        Acepto los <a className="text-primary hover:underline" href="#">términos de servicio</a> y la <a className="text-primary hover:underline" href="#">política de privacidad</a> de DistribuApp.
                                    </p>
                                </div>

                                {/* Submit Button */}
                                <button
                                    type="submit"
                                    disabled={loading}
                                    className="w-full bg-primary hover:bg-primary/90 text-white font-bold py-4 rounded-xl shadow-lg shadow-primary/25 transition-all transform active:scale-[0.98] flex items-center justify-center gap-2 mt-4 disabled:opacity-70 disabled:cursor-not-allowed"
                                >
                                    {loading ? (
                                        <>
                                            <span className="size-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                                            <span>Procesando...</span>
                                        </>
                                    ) : (
                                        <>
                                            <span className="material-symbols-outlined">person_add</span>
                                            <span>Registrarse Ahora</span>
                                        </>
                                    )}
                                </button>

                                {/* Back to Login */}
                                <div className="text-center pt-6 border-t border-stone-100 dark:border-stone-800 mt-6">
                                    <p className="text-stone-600 dark:text-stone-400">
                                        ¿Ya tienes una cuenta?
                                        <Link to="/login" className="text-primary font-bold hover:underline ml-1">Iniciar Sesión</Link>
                                    </p>
                                </div>
                            </form>
                        </div>
                    </div>
                </main>

                {/* Footer */}
                <footer className="px-6 py-8 text-center text-stone-400 dark:text-stone-600 text-sm">
                    <p>© 2024 DistribuApp Logistics Systems. Todos los derechos reservados.</p>
                </footer>
            </div>
        </div>
    );
};

export default Register;
