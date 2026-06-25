import React, { useState, useEffect } from 'react';
import { 
  Key, User, ArrowRight, Loader2, AlertCircle, 
  Globe, Cpu, Database, Zap 
} from 'lucide-react';

export default function Login({ onLoginSuccess }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  // Loading Boot loader states
  const [isBooting, setIsBooting] = useState(true);
  const [bootStage, setBootStage] = useState(1);
  
  // Mouse position for Parallax tilt
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [rotationZ, setRotationZ] = useState(0);

  // Remember me state (UI-only)
  const [rememberMe, setRememberMe] = useState(false);

  // Timer loop to animate boot sequence stages
  useEffect(() => {
    // Stage 1: Initial Logo fade in (0s to 1s)
    const t1 = setTimeout(() => setBootStage(2), 1000);
    // Stage 2: Rings begin rotating (1s to 1.5s)
    const t2 = setTimeout(() => setBootStage(3), 1500);
    // Stage 3: Orbiting particles fade in (1.5s to 2.2s)
    const t3 = setTimeout(() => setBootStage(4), 2200);
    // Stage 4: Progress line completes (2.2s to 3.2s)
    const t4 = setTimeout(() => setBootStage(5), 3200);
    // Stage 5: Transition boot loader screen out, fade login page in (3.5s)
    const t5 = setTimeout(() => setIsBooting(false), 3700);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      clearTimeout(t4);
      clearTimeout(t5);
    };
  }, []);

  // Animate Z rotation of the 3D discs
  useEffect(() => {
    let animId;
    const tick = () => {
      setRotationZ(prev => (prev + 0.15) % 360);
      animId = requestAnimationFrame(tick);
    };
    animId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animId);
  }, []);

  const handleMouseMove = (e) => {
    const { clientX, clientY } = e;
    const { innerWidth, innerHeight } = window;
    // Map coordinate differences relative to window center to [-0.5, 0.5] range
    const x = (clientX / innerWidth) - 0.5;
    const y = (clientY / innerHeight) - 0.5;
    setMousePos({ x, y });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || 'Login failed. Please verify credentials.');
      }

      localStorage.setItem('admin_token', data.access_token);
      localStorage.setItem('admin_username', data.username);
      
      onLoginSuccess(data.access_token, data.username);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Parallax calculations
  const tiltX = mousePos.y * 18;  // Limit rotation X range to [-18deg, 18deg]
  const tiltY = mousePos.x * -18; // Limit rotation Y range to [-18deg, 18deg]

  return (
    <div 
      onMouseMove={handleMouseMove}
      className="min-h-screen text-slate-100 flex flex-col relative overflow-hidden font-sans select-none"
      style={{
        background: 'linear-gradient(135deg, #090615 0%, #05030A 100%)'
      }}
    >
      {/* Self-contained premium styles for 3D visual effects */}
      <style>{`
        .perspective-container {
          perspective: 1200px;
        }
        .preserve-3d {
          transform-style: preserve-3d;
        }
        .animate-spin-slow {
          animation: spin 30s linear infinite;
        }
        .animate-spin-reverse {
          animation: spin-back 25s linear infinite;
        }
        .animate-pulse-slow {
          animation: pulse-glow 5s ease-in-out infinite;
        }
        
        @keyframes spin {
          from { transform: rotateZ(0deg); }
          to { transform: rotateZ(360deg); }
        }
        @keyframes spin-back {
          from { transform: rotateZ(360deg); }
          to { transform: rotateZ(0deg); }
        }
        @keyframes pulse-glow {
          0%, 100% { opacity: 0.6; box-shadow: 0 0 35px rgba(123, 44, 191, 0.15); }
          50% { opacity: 0.85; box-shadow: 0 0 60px rgba(123, 44, 191, 0.35); }
        }
        
        /* Floating background particles style */
        .particle-loader {
          animation-iteration-count: infinite;
          animation-timing-function: ease-in-out;
        }
        .animate-float-1 {
          top: 15%; left: 10%;
          animation: float-particle-1 8s infinite;
        }
        .animate-float-2 {
          top: 65%; left: 80%;
          animation: float-particle-2 10s infinite;
        }
        .animate-float-3 {
          top: 35%; left: 85%;
          animation: float-particle-3 7s infinite;
        }
        @keyframes float-particle-1 {
          0%, 100% { transform: translateY(0px) translateX(0px) scale(1); }
          50% { transform: translateY(-25px) translateX(15px) scale(1.1); }
        }
        @keyframes float-particle-2 {
          0%, 100% { transform: translateY(0px) translateX(0px) scale(1); }
          50% { transform: translateY(30px) translateX(-20px) scale(0.9); }
        }
        @keyframes float-particle-3 {
          0%, 100% { transform: translateY(0px) translateX(0px) scale(1); }
          50% { transform: translateY(-15px) translateX(-15px) scale(1.05); }
        }
        
        /* Laser path flows */
        .animate-laser-flow {
          stroke-dasharray: 4, 120;
          animation: laser-flow-dash 3s linear infinite;
        }
        @keyframes laser-flow-dash {
          to {
            stroke-dashoffset: -124;
          }
        }

        /* Subtle Noise Texture Overlay */
        .noise-bg {
          background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)' opacity='0.02'/%3E%3C/svg%3E");
        }
      `}</style>

      {/* Radial Dark Glow Overlay for premium contrast & balance */}
      <div className="absolute inset-0 bg-[#05010B]/75 dark:bg-[#030007]/90 z-0 pointer-events-none" />
      <div className="absolute inset-0 bg-radial-gradient-glow opacity-50 z-0 pointer-events-none" 
        style={{
          backgroundImage: 'radial-gradient(circle at 30% 40%, rgba(90, 24, 154, 0.25) 0%, transparent 60%), radial-gradient(circle at 75% 70%, rgba(123, 44, 191, 0.2) 0%, transparent 55%)'
        }}
      />
      <div className="absolute inset-0 noise-bg z-0 pointer-events-none" />

      {/* 1. Custom Branded Loading Screen Overlay */}
      {isBooting && (
        <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-[#05030A] backdrop-blur-3xl transition-opacity duration-700 select-none">
          {/* Floating purple dust particles */}
          <div className="absolute inset-0 overflow-hidden pointer-events-none opacity-20">
            <div className="particle-loader bg-[#7B2CBF]/20 w-3 h-3 rounded-full absolute animate-float-1" />
            <div className="particle-loader bg-[#5A189A]/15 w-2.5 h-2.5 rounded-full absolute animate-float-2" />
            <div className="particle-loader bg-[#C77DFF]/25 w-2 h-2 rounded-full absolute animate-float-3" />
          </div>

          {/* Central nested spinner */}
          <div className="relative w-56 h-56 flex items-center justify-center">
            {/* Stage 2+: rotating nested rings */}
            <div className={`absolute inset-0 rounded-full border border-slate-800/40 border-t-[#C77DFF]/40 animate-spin transition-all duration-1000 ${bootStage >= 2 ? 'opacity-100' : 'opacity-0'}`} style={{ animationDuration: '2s' }} />
            <div className={`absolute inset-4 rounded-full border border-dashed border-slate-700/20 animate-spin-reverse transition-all duration-1000 ${bootStage >= 2 ? 'opacity-100' : 'opacity-0'}`} style={{ animationDuration: '6s' }} />
            <div className={`absolute inset-8 rounded-full border border-slate-800/40 border-r-[#9D4EDD]/30 animate-spin transition-all duration-1000 ${bootStage >= 2 ? 'opacity-100' : 'opacity-0'}`} style={{ animationDuration: '3.5s' }} />
            
            {/* Stage 1+: company favicon/logo animation */}
            <div className={`p-4 bg-[#120D22]/85 backdrop-blur-md text-[#C77DFF] rounded-2xl border border-white/[0.06] shadow-[0_0_25px_rgba(168,85,247,0.1)] transition-all duration-700 transform ${bootStage >= 1 ? 'scale-100 opacity-100' : 'scale-50 opacity-0'}`}>
              <img src="/apple-touch-icon.png" className="w-12 h-12 object-contain animate-pulse" alt="Algonox Logo" />
            </div>

            {/* Stage 3+: orbiting markers */}
            <div className={`absolute w-full h-full animate-spin transition-opacity duration-1000 ${bootStage >= 3 ? 'opacity-100' : 'opacity-0'}`} style={{ animationDuration: '8s' }}>
              <div className="w-1.5 h-1.5 bg-[#A855F7] rounded-full shadow-[0_0_6px_#A855F7] absolute top-2 left-1/2 -ml-0.75" />
            </div>
            <div className={`absolute w-full h-full animate-spin-reverse transition-opacity duration-1000 ${bootStage >= 3 ? 'opacity-100' : 'opacity-0'}`} style={{ animationDuration: '5s' }}>
              <div className="w-1.5 h-1.5 bg-[#C77DFF] rounded-full shadow-[0_0_6px_#C77DFF] absolute bottom-2 left-1/2 -ml-0.75" />
            </div>
          </div>

          {/* Loader Text labels */}
          <div className="text-center mt-10 px-6 max-w-sm z-10">
            <h3 className="text-sm sm:text-base font-extrabold tracking-wider uppercase text-slate-300 animate-pulse">
              Preparing Intelligent Document Processing
            </h3>
            <p className="text-[10px] text-slate-500 font-bold tracking-widest uppercase mt-3 leading-relaxed">
              Connecting to secure data pipelines...
            </p>
          </div>

          {/* Progress meter line */}
          <div className="w-48 h-1 bg-white/5 rounded-full overflow-hidden mt-8 relative">
            <div 
              className="h-full bg-gradient-to-r from-[#7B2CBF] to-[#C77DFF] transition-all duration-300 ease-out"
              style={{
                width: bootStage === 1 ? '12%' : bootStage === 2 ? '35%' : bootStage === 3 ? '60%' : bootStage === 4 ? '90%' : '100%'
              }}
            />
          </div>
        </div>
      )}

      {/* Header branding (Algonox Secretary) */}
      <header className="w-full max-w-7xl mx-auto px-6 py-3 flex items-center justify-between z-20 lg:absolute lg:top-0 lg:left-1/2 lg:-translate-x-1/2">
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 bg-white/[0.03] border border-white/[0.08] shadow-[0_0_12px_rgba(157,78,221,0.15)] rounded-lg shrink-0">
            <img src="/favicon-32x32.png" className="w-4 h-4 object-contain" alt="Algonox Logo" />
          </div>
          <div>
            <h1 className="font-bold text-xs tracking-wider uppercase leading-none text-white">
              Algonox
            </h1>
            <span className="text-[8px] text-[#C77DFF]/90 font-bold uppercase tracking-widest block mt-0.5 leading-none">
              Secretary
            </span>
          </div>
        </div>
      </header>

      {/* Main Layout Area */}
      <main className="w-full max-w-7xl mx-auto px-6 flex-1 flex flex-col lg:flex-row items-center justify-between gap-12 lg:gap-24 pt-24 pb-16 lg:py-0 z-10">
        
        {/* LEFT COLUMN: 3D Centerpiece Composition (Document Intelligence Engine) */}
        <div className="flex-1 w-full max-w-lg lg:max-w-none perspective-container hidden sm:flex flex-col items-center justify-center preserve-3d">
          <div 
            className="relative w-[360px] h-[360px] lg:w-[420px] lg:h-[420px] preserve-3d transition-transform duration-300 ease-out flex items-center justify-center"
            style={{
              transform: `rotateX(55deg) rotateY(0deg) rotateZ(${rotationZ}deg) rotateX(${tiltX}deg) rotateY(${tiltY}deg)`
            }}
          >
            {/* Layer 1: Outer subtle ring with particle */}
            <div className="absolute inset-0 rounded-full border border-white/[0.04] dark:border-white/[0.06] animate-spin-slow preserve-3d" 
              style={{ transform: 'translateZ(-40px)' }}
            >
              <div className="absolute w-1.5 h-1.5 bg-[#38bdf8] rounded-full top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 shadow-[0_0_6px_#38bdf8]" />
            </div>
            
            {/* Layer 2: Dashed track with particle */}
            <div className="absolute inset-6 rounded-full border border-dashed border-slate-700/20 dark:border-slate-800/40 animate-spin-reverse preserve-3d" 
              style={{ transform: 'translateZ(0px)', animationDuration: '18s' }}
            >
              <div className="absolute w-1.5 h-1.5 bg-[#6366f1] rounded-full bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 shadow-[0_0_6px_#6366f1]" />
            </div>

            {/* Layer 3: Inner solid ring with particle */}
            <div className="absolute inset-12 rounded-full border border-white/[0.05] dark:border-white/[0.07] animate-spin preserve-3d" 
              style={{ transform: 'translateZ(30px)', animationDuration: '12s' }}
            >
              <div className="absolute w-1.5 h-1.5 bg-[#fbbf24] rounded-full top-1/2 left-0 -translate-x-1/2 -translate-y-1/2 shadow-[0_0_6px_#fbbf24]" />
            </div>

            {/* Layer 4: Core boundary ring */}
            <div className="absolute inset-20 rounded-full border border-dashed border-slate-700/30 dark:border-slate-800/50 preserve-3d" 
              style={{ transform: 'translateZ(50px)' }} 
            />
            
            {/* Glowing Inner Core */}
            <div 
              className="absolute w-28 h-28 rounded-full bg-gradient-to-tr from-[#7B2CBF]/15 to-[#C77DFF]/5 border border-white/[0.08] shadow-[0_0_30px_rgba(168,85,247,0.15)] flex items-center justify-center preserve-3d"
              style={{ transform: 'translateZ(70px)' }}
            >
              <div className="w-18 h-18 rounded-full bg-[#090514]/95 border border-white/[0.05] flex items-center justify-center shadow-[inset_0_0_12px_rgba(168,85,247,0.15)]">
                <img src="/apple-touch-icon.png" className="w-10 h-10 object-contain animate-pulse opacity-90" alt="Algonox Core" />
              </div>
            </div>

            {/* Connecting laser paths representing pipeline flows */}
            <svg 
              className="absolute inset-0 w-full h-full pointer-events-none overflow-visible z-10" 
              viewBox="0 0 420 420"
              style={{ transform: 'translateZ(60px)' }}
            >
              {/* Background faint lines */}
              <path d="M 210 15 Q 360 45 405 210" fill="none" stroke="rgba(255, 255, 255, 0.04)" strokeWidth="1" />
              <path d="M 405 210 Q 360 375 210 405" fill="none" stroke="rgba(255, 255, 255, 0.04)" strokeWidth="1" />
              <path d="M 210 405 Q 60 375 15 210" fill="none" stroke="rgba(255, 255, 255, 0.04)" strokeWidth="1" />
              <path d="M 15 210 Q 60 45 210 15" fill="none" stroke="rgba(255, 255, 255, 0.04)" strokeWidth="1" />

              {/* Animated laser paths */}
              <path d="M 210 15 Q 360 45 405 210" fill="none" stroke="#C77DFF" strokeWidth="1.2" strokeLinecap="round" className="animate-laser-flow" />
              <path d="M 405 210 Q 360 375 210 405" fill="none" stroke="#C77DFF" strokeWidth="1.2" strokeLinecap="round" className="animate-laser-flow" />
              <path d="M 210 405 Q 60 375 15 210" fill="none" stroke="#C77DFF" strokeWidth="1.2" strokeLinecap="round" className="animate-laser-flow" />
              <path d="M 15 210 Q 60 45 210 15" fill="none" stroke="#C77DFF" strokeWidth="1.2" strokeLinecap="round" className="animate-laser-flow" />
            </svg>

            {/* Node 1: PORTAL Capsule (Top Center) */}
            <div 
              className="absolute bg-[#0c0919]/90 border border-white/[0.08] shadow-[0_8px_20px_rgba(0,0,0,0.45)] backdrop-blur-md px-3.5 py-2 rounded-xl flex items-center gap-2 transition-colors duration-300 hover:border-[#C77DFF]"
              style={{
                top: '-15px',
                left: 'calc(50% - 44px)',
                transform: `rotateZ(${-rotationZ}deg) rotateX(-55deg) translateZ(90px) rotateX(${-tiltX}deg) rotateY(${-tiltY}deg)`
              }}
            >
              <Globe className="text-[#C77DFF] w-4 h-4 shrink-0" />
              <span className="text-[9px] font-extrabold text-[#C77DFF] tracking-wider uppercase font-mono leading-none">Portal</span>
            </div>
            
            {/* Node 2: SCRAPE Capsule (Right Center) */}
            <div 
              className="absolute bg-[#0c0919]/90 border border-white/[0.08] shadow-[0_8px_20px_rgba(0,0,0,0.45)] backdrop-blur-md px-3.5 py-2 rounded-xl flex items-center gap-2 transition-colors duration-300 hover:border-[#C77DFF]"
              style={{
                right: '-25px',
                top: 'calc(50% - 18px)',
                transform: `rotateZ(${-rotationZ}deg) rotateX(-55deg) translateZ(110px) rotateX(${-tiltX}deg) rotateY(${-tiltY}deg)`
              }}
            >
              <Cpu className="text-[#A855F7] w-4 h-4 shrink-0" />
              <span className="text-[9px] font-extrabold text-[#A855F7] tracking-wider uppercase font-mono leading-none">Scrape</span>
            </div>

            {/* Node 3: PROCESS Capsule (Bottom Center) */}
            <div 
              className="absolute bg-[#0c0919]/90 border border-white/[0.08] shadow-[0_8px_20px_rgba(0,0,0,0.45)] backdrop-blur-md px-3.5 py-2 rounded-xl flex items-center gap-2 transition-colors duration-300 hover:border-[#C77DFF]"
              style={{
                bottom: '-15px',
                left: 'calc(50% - 46px)',
                transform: `rotateZ(${-rotationZ}deg) rotateX(-55deg) translateZ(100px) rotateX(${-tiltX}deg) rotateY(${-tiltY}deg)`
              }}
            >
              <Zap className="text-[#9D4EDD] w-4 h-4 shrink-0" />
              <span className="text-[9px] font-extrabold text-[#9D4EDD] tracking-wider uppercase font-mono leading-none">Process</span>
            </div>

            {/* Node 4: DATA Capsule (Left Center) */}
            <div 
              className="absolute bg-[#0c0919]/90 border border-white/[0.08] shadow-[0_8px_20px_rgba(0,0,0,0.45)] backdrop-blur-md px-3.5 py-2 rounded-xl flex items-center gap-2 transition-colors duration-300 hover:border-[#C77DFF]"
              style={{
                left: '-25px',
                top: 'calc(50% - 18px)',
                transform: `rotateZ(${-rotationZ}deg) rotateX(-55deg) translateZ(80px) rotateX(${-tiltX}deg) rotateY(${-tiltY}deg)`
              }}
            >
              <Database className="text-[#C77DFF] w-4 h-4 shrink-0" />
              <span className="text-[9px] font-extrabold text-[#C77DFF] tracking-wider uppercase font-mono leading-none">Data</span>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: Premium High-Contrast Login Card */}
        <div className="w-full max-w-md mx-auto z-10 relative">
          {/* Ambient Purple Soft Glow behind the card */}
          <div className="absolute -inset-4 bg-gradient-to-tr from-[#7B2CBF]/15 to-[#C77DFF]/5 rounded-[30px] blur-3xl opacity-75 pointer-events-none z-0" />
          
          <div className="relative bg-[#120D22]/70 backdrop-blur-xl border border-white/[0.08] shadow-[0_30px_70px_rgba(0,0,0,0.7)] rounded-[24px] p-8 sm:p-10 transition-all duration-500 hover:border-white/[0.12] hover:shadow-[0_30px_80px_rgba(157,78,221,0.15)] z-10">
            
            {/* Header / Logo branding inside card */}
            <div className="flex flex-col items-center text-center mb-8">
              <div className="p-3 bg-white/[0.03] rounded-2xl mb-4 border border-white/[0.08] shadow-[0_0_20px_rgba(157,78,221,0.2)]">
                <img src="/apple-touch-icon.png" className="w-10 h-10 object-contain" alt="Algonox Logo" />
              </div>
              <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-white font-sans">
                Welcome Back
              </h2>
              <p className="text-slate-400 text-xs mt-1.5">
                Sign in to continue to Algonox Secretary
              </p>
            </div>

            {/* Render submission errors if any */}
            {error && (
              <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 text-red-400 text-xs rounded-xl flex items-start gap-3">
                <AlertCircle size={16} className="shrink-0 mt-0.5" />
                <span className="leading-normal">{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Username Input Field */}
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">
                  Username / Email
                </label>
                <div className="relative">
                  <User size={15} className="absolute left-4 top-3.5 text-slate-500" />
                  <input
                    type="text"
                    required
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="e.g. admin"
                    className="w-full bg-[#080512]/90 border border-white/[0.08] rounded-xl py-3.5 pl-11 pr-4 text-white placeholder-slate-500 focus:outline-none focus:border-[#9D4EDD] focus:ring-1 focus:ring-[#9D4EDD] transition-all text-xs font-mono"
                  />
                </div>
              </div>

              {/* Password Input Field */}
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">
                  Password
                </label>
                <div className="relative">
                  <Key size={15} className="absolute left-4 top-3.5 text-slate-500" />
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full bg-[#080512]/90 border border-white/[0.08] rounded-xl py-3.5 pl-11 pr-4 text-white placeholder-slate-500 focus:outline-none focus:border-[#9D4EDD] focus:ring-1 focus:ring-[#9D4EDD] transition-all text-xs font-mono"
                  />
                </div>
              </div>

              {/* Options check row */}
              <div className="flex items-center justify-between text-[11px] font-semibold text-slate-450 pt-1">
                <label className="flex items-center gap-2 cursor-pointer select-none text-slate-400">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="rounded border-white/10 bg-white/5 text-[#7B2CBF] focus:ring-[#9D4EDD] focus:ring-offset-0 focus:outline-none w-3.5 h-3.5"
                  />
                  <span>Remember me</span>
                </label>
                <a href="#" onClick={(e) => { e.preventDefault(); alert("Contact administrator to reset password."); }} className="text-[#C77DFF] hover:underline">
                  Forgot password?
                </a>
              </div>

              {/* Sign In Button */}
              <button
                type="submit"
                disabled={loading}
                className="w-full mt-3 bg-gradient-to-r from-[#7B2CBF] to-[#9D4EDD] hover:from-[#8B3DD0] hover:to-[#AD5EE0] text-white rounded-xl py-3.5 font-extrabold flex items-center justify-center gap-2 transition-all transform active:scale-[0.98] hover:scale-[1.01] hover:shadow-[0_0_24px_rgba(157,78,221,0.4)] disabled:opacity-50 cursor-pointer"
              >
                {loading ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    <span>Authenticating...</span>
                  </>
                ) : (
                  <>
                    <span>Sign In</span>
                    <ArrowRight size={16} className="stroke-[2.5]" />
                  </>
                )}
              </button>
            </form>
          </div>
        </div>
      </main>

      {/* Footer Branding */}
      <footer className="w-full max-w-7xl mx-auto px-6 py-4 border-t border-white/5 flex flex-col sm:flex-row items-center justify-between gap-4 z-10 text-slate-500 text-[10px] font-semibold uppercase tracking-wider lg:absolute lg:bottom-0 lg:left-1/2 lg:-translate-x-1/2 lg:border-t-0">
        <span>© 2026 Algonox Secretary. All rights reserved.</span>
        <div className="flex items-center gap-6">
          <a href="#" className="hover:text-slate-300 transition-colors">Privacy Policy</a>
          <a href="#" className="hover:text-slate-300 transition-colors">Terms of Service</a>
        </div>
      </footer>
    </div>
  );
}
