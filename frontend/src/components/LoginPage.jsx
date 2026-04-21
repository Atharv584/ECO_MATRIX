import React, { useState } from 'react';
import { Box, Eye, EyeOff, Mail, Lock, LogIn, AlertCircle } from 'lucide-react';
import authorizedUsers from '../authorizedUsers.json';

export default function LoginPage({ onLogin }) {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleEmailAuth = async (e) => {
        e.preventDefault();
        if (!email || !password) return;
        setError('');
        setLoading(true);

        // Simulate network delay
        setTimeout(() => {
            const user = authorizedUsers.find(
                u => u.email.toLowerCase() === email.toLowerCase() && u.password === password
            );

            if (user) {
                onLogin({ email: user.email, displayName: user.name });
            } else {
                setError('Invalid email or password. Please try again.');
            }
            setLoading(false);
        }, 500);
    };

    return (
        <div className="w-full h-screen bg-slate-950 flex items-center justify-center relative overflow-hidden">
            {/* Animated background orbs */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div
                    className="absolute w-[500px] h-[500px] rounded-full opacity-20 blur-3xl"
                    style={{
                        background: 'radial-gradient(circle, #7c3aed, transparent 70%)',
                        top: '-10%',
                        left: '-10%',
                        animation: 'float1 8s ease-in-out infinite',
                    }}
                />
                <div
                    className="absolute w-[400px] h-[400px] rounded-full opacity-15 blur-3xl"
                    style={{
                        background: 'radial-gradient(circle, #06b6d4, transparent 70%)',
                        bottom: '-10%',
                        right: '-10%',
                        animation: 'float2 10s ease-in-out infinite',
                    }}
                />
                <div
                    className="absolute w-[300px] h-[300px] rounded-full opacity-10 blur-3xl"
                    style={{
                        background: 'radial-gradient(circle, #3b82f6, transparent 70%)',
                        top: '50%',
                        left: '50%',
                        transform: 'translate(-50%, -50%)',
                        animation: 'float3 12s ease-in-out infinite',
                    }}
                />
            </div>

            {/* CSS keyframes */}
            <style>{`
        @keyframes float1 {
          0%, 100% { transform: translate(0, 0) scale(1); }
          50% { transform: translate(40px, 30px) scale(1.1); }
        }
        @keyframes float2 {
          0%, 100% { transform: translate(0, 0) scale(1); }
          50% { transform: translate(-30px, -40px) scale(1.05); }
        }
        @keyframes float3 {
          0%, 100% { transform: translate(-50%, -50%) scale(1); }
          50% { transform: translate(-50%, -50%) scale(1.15); }
        }
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .login-card {
          animation: fadeInUp 0.6s ease-out;
        }
        .btn-shimmer {
          position: relative;
          overflow: hidden;
        }
        .btn-shimmer::after {
          content: '';
          position: absolute;
          top: -50%;
          left: -50%;
          width: 200%;
          height: 200%;
          background: linear-gradient(
            to right,
            transparent,
            rgba(255,255,255,0.08),
            transparent
          );
          transform: rotate(30deg);
          animation: shimmer 3s infinite;
        }
        @keyframes shimmer {
          0% { transform: translateX(-100%) rotate(30deg); }
          100% { transform: translateX(100%) rotate(30deg); }
        }
      `}</style>

            {/* Login Card */}
            <div className="login-card relative z-10 w-full max-w-md mx-4">
                <div
                    className="rounded-2xl border border-white/10 p-8 shadow-2xl"
                    style={{
                        background: 'rgba(15, 23, 42, 0.8)',
                        backdropFilter: 'blur(24px)',
                        WebkitBackdropFilter: 'blur(24px)',
                    }}
                >
                    {/* Logo & Title */}
                    <div className="flex flex-col items-center mb-8">
                        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-500 to-cyan-400 flex items-center justify-center mb-4 shadow-lg shadow-blue-500/25">
                            <Box size={28} strokeWidth={2.5} className="text-slate-900" />
                        </div>
                        <h1 className="text-2xl font-bold text-white tracking-tight">ECO-MATRIX</h1>
                        <p className="text-slate-400 text-sm mt-1">
                            Sign in to continue
                        </p>
                    </div>

                    {/* Error */}
                    {error && (
                        <div className="mb-4 px-4 py-3 bg-red-900/20 border border-red-500/20 rounded-xl text-sm text-red-300 flex items-start gap-2">
                            <AlertCircle size={16} className="shrink-0 mt-0.5" />
                            <span>{error}</span>
                        </div>
                    )}

                    {/* Form */}
                    <form onSubmit={handleEmailAuth} className="space-y-4">
                        {/* Email */}
                        <div className="relative">
                            <Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
                            <input
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="Email address"
                                required
                                className="w-full bg-slate-800/60 border border-slate-700/50 rounded-xl pl-10 pr-4 py-3 text-sm text-white placeholder:text-slate-500 outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/25 transition"
                            />
                        </div>

                        {/* Password */}
                        <div className="relative">
                            <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
                            <input
                                type={showPassword ? 'text' : 'password'}
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="Password"
                                required
                                minLength={6}
                                className="w-full bg-slate-800/60 border border-slate-700/50 rounded-xl pl-10 pr-11 py-3 text-sm text-white placeholder:text-slate-500 outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/25 transition"
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition"
                            >
                                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                            </button>
                        </div>

                        {/* Submit */}
                        <button
                            type="submit"
                            disabled={loading}
                            className="btn-shimmer w-full py-3 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-500 text-white font-semibold text-sm hover:from-blue-500 hover:to-cyan-400 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2 shadow-lg shadow-blue-500/20"
                        >
                            {loading ? (
                                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            ) : (
                                <>
                                    <LogIn size={16} />
                                    Sign In
                                </>
                            )}
                        </button>
                    </form>
                </div>

                {/* Footer */}
                <p className="text-center text-xs text-slate-600 mt-6">
                    Structural Analysis & Sustainability Platform
                </p>
            </div>
        </div>
    );
}
