import React, { useState } from 'react';
import { Shield, Key, User, ArrowRight, Loader2, AlertCircle, X, Sparkles, Activity, Layers, TrendingUp } from 'lucide-react';

export default function Login({ onLoginSuccess }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showLoginModal, setShowLoginModal] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await fetch('http://localhost:8000/api/auth/login', {
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

  return (
    <div className="min-h-screen bg-[#07080B] text-slate-100 flex flex-col justify-between relative overflow-hidden font-sans select-none">
      {/* Glow Effects */}
      <div className="absolute top-[-10%] left-[-10%] w-[600px] h-[600px] bg-brand-amber/5 rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[600px] h-[600px] bg-brand-gold/5 rounded-full blur-[140px] pointer-events-none" />

      {/* Header/Navbar */}
      <header className="w-full max-w-7xl mx-auto px-6 py-6 flex items-center justify-between z-20">
        <div className="flex items-center gap-3.5">
          <div className="p-2.5 bg-gradient-to-tr from-brand-amber to-brand-gold text-[#07080B] rounded-xl shadow-md shadow-brand-amber/10">
            <Shield size={20} className="stroke-[2.5]" />
          </div>
          <div>
            <h1 className="font-extrabold text-sm tracking-wide uppercase leading-tight logo-gradient-text">
              Algonox
            </h1>
            <span className="text-[9px] text-slate-500 font-bold uppercase tracking-widest block leading-none">
              Secretary
            </span>
          </div>
        </div>

        {/* Desktop Nav Links */}
        <nav className="hidden md:flex items-center gap-8 text-xs font-semibold text-slate-400">
          <a href="#features" className="hover:text-white transition-colors">Features</a>
          <a href="#pricing" className="hover:text-white transition-colors">Pricing</a>
          <a href="#about" className="hover:text-white transition-colors">About</a>
          <a href="#contact" className="hover:text-white transition-colors">Contact</a>
        </nav>

        {/* Nav Actions */}
        <div className="flex items-center gap-4">
          <button
            onClick={() => setShowLoginModal(true)}
            className="px-4 py-2 text-xs font-bold text-slate-300 hover:text-white transition-all cursor-pointer"
          >
            Sign in
          </button>
          <button
            onClick={() => setShowLoginModal(true)}
            className="px-4 py-2 bg-gradient-to-r from-brand-gold to-brand-amber hover:from-brand-gold/95 hover:to-brand-amber/95 text-[#07080B] rounded-xl text-xs font-extrabold shadow-lg shadow-brand-amber/5 transition-all cursor-pointer"
          >
            Get started
          </button>
        </div>
      </header>

      {/* Main Landing Content */}
      <main className="w-full max-w-7xl mx-auto px-6 flex-1 flex flex-col lg:flex-row items-center justify-between gap-12 py-12 lg:py-24 z-10">
        {/* Left Hero Column */}
        <div className="flex-1 text-left space-y-8 max-w-xl">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-brand-amber/10 border border-brand-amber/20 text-brand-gold text-[10px] font-bold uppercase tracking-wider animate-float">
            <Sparkles size={12} className="text-brand-amber" />
            <span>Introducing Multi-Platform Scrapers</span>
          </div>
          
          <h2 className="text-5xl lg:text-6xl font-extrabold tracking-tight text-white font-sans leading-[1.08]">
            Powerful data<br />
            insights for <span className="logo-gradient-text">all</span>
          </h2>
          
          <p className="text-slate-400 text-sm leading-relaxed max-w-md">
            Algonox Secretary makes data analysis easy for everyone. Visualize key metrics, track performance, and discover trends without needing a data science background.
          </p>

          <div className="flex items-center gap-4">
            <button
              onClick={() => setShowLoginModal(true)}
              className="px-6 py-3.5 bg-gradient-to-r from-brand-gold to-brand-amber hover:from-brand-gold/95 hover:to-brand-amber/95 text-[#07080B] rounded-xl text-xs font-extrabold shadow-xl shadow-brand-amber/10 flex items-center gap-2 group transition-all cursor-pointer"
            >
              <span>Get started</span>
              <ArrowRight size={14} className="group-hover:translate-x-0.5 transition-transform stroke-[2.5]" />
            </button>
            <button
              onClick={() => setShowLoginModal(true)}
              className="px-6 py-3.5 bg-white/5 hover:bg-white/10 text-white rounded-xl text-xs font-bold border border-white/5 transition-all cursor-pointer"
            >
              Learn more
            </button>
          </div>

          {/* Client Logos Row */}
          <div className="pt-12 space-y-4">
            <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest block">Trusted By Teams At</span>
            <div className="flex flex-wrap items-center gap-8 text-slate-500 font-bold text-xs uppercase tracking-widest opacity-60">
              <span className="hover:text-slate-350 transition-colors">SOMEDAY</span>
              <span className="hover:text-slate-350 transition-colors">Accent</span>
              <span className="hover:text-slate-350 transition-colors">IRENE</span>
              <span className="hover:text-slate-350 transition-colors">n·a</span>
            </div>
          </div>
        </div>

        {/* Right Dashboard Animated Grid Column */}
        <div className="flex-1 w-full max-w-lg lg:max-w-none relative animate-float">
          {/* Main 3D dashboard grid container */}
          <div className="glass-panel p-6 rounded-3xl border border-brand-amber/10 shadow-2xl relative bg-dark-850/80 aspect-[1.15] grid grid-cols-2 gap-4">
            <div className="absolute top-0 right-0 w-32 h-32 bg-brand-amber/5 rounded-full blur-[40px] pointer-events-none" />
            
            {/* Card 1: Animated Bar Chart */}
            <div className="bg-[#0B0C10] border border-white/5 rounded-2xl p-4 flex flex-col justify-between shadow-sm relative overflow-hidden group">
              <div className="flex items-center justify-between mb-3">
                <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider block">API Usage Rate</span>
                <TrendingUp size={12} className="text-brand-amber" />
              </div>
              <div className="flex items-end justify-between h-[80px] px-2 gap-2 relative">
                <div className="w-2.5 bg-brand-cream/40 rounded-full animate-bar-1" />
                <div className="w-2.5 bg-brand-gold/60 rounded-full animate-bar-2" />
                <div className="w-2.5 bg-brand-amber rounded-full animate-bar-3" />
                <div className="w-2.5 bg-brand-gold/60 rounded-full animate-bar-4" />
                <div className="w-2.5 bg-brand-cream/40 rounded-full animate-bar-5" />
              </div>
              <div className="mt-3 pt-2 border-t border-white/5 flex justify-between items-center text-[9px] text-slate-400 font-mono">
                <span>Total Calls</span>
                <span className="text-white font-bold">14,204</span>
              </div>
            </div>

            {/* Card 2: Animated Donut Chart */}
            <div className="bg-[#0B0C10] border border-white/5 rounded-2xl p-4 flex flex-col justify-between shadow-sm relative overflow-hidden group">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider block">Key Distribution</span>
                <Layers size={12} className="text-brand-gold" />
              </div>
              
              <div className="flex-1 flex items-center justify-center relative py-1">
                <svg className="w-20 h-20 transform -rotate-90 animate-donut-spin" viewBox="0 0 100 100">
                  <circle cx="50" cy="50" r="45" className="stroke-white/5 fill-none" strokeWidth="6" />
                  <circle cx="50" cy="50" r="45" className="stroke-brand-gold/20 fill-none" strokeWidth="6" strokeDasharray="283" strokeDashoffset="180" />
                  <circle cx="50" cy="50" r="45" className="stroke-brand-amber fill-none animate-donut-dash" strokeWidth="8" />
                </svg>
                {/* Center Badge */}
                <div className="absolute flex flex-col items-center justify-center font-mono">
                  <span className="text-[14px] font-extrabold text-white">82%</span>
                  <span className="text-[7px] text-slate-500 font-bold uppercase tracking-wider">Active</span>
                </div>
              </div>

              <div className="mt-2 pt-2 border-t border-white/5 flex justify-between items-center text-[9px] text-slate-400 font-mono">
                <span>Healthy Keys</span>
                <span className="text-brand-emerald font-bold">18 / 22</span>
              </div>
            </div>

            {/* Card 3: Animated Line Wave Chart */}
            <div className="bg-[#0B0C10] border border-white/5 rounded-2xl p-4 flex flex-col justify-between shadow-sm relative overflow-hidden group">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider block">System Health Ping</span>
                <Activity size={12} className="text-brand-cream" />
              </div>

              <div className="flex-1 flex items-center justify-center relative overflow-hidden h-[75px]">
                <svg className="w-full h-full overflow-visible" viewBox="0 0 160 60" preserveAspectRatio="none">
                  {/* Wave 1 */}
                  <path 
                    d="M0 45 C20 45, 20 20, 40 20 C60 20, 60 40, 80 40 C100 40, 100 10, 120 10 C140 10, 140 30, 160 30" 
                    fill="none" 
                    stroke="rgba(254, 240, 138, 0.4)" 
                    strokeWidth="2" 
                    className="animate-wave-1"
                  />
                  {/* Wave 2 */}
                  <path 
                    d="M0 35 C20 35, 20 50, 40 50 C60 50, 60 25, 80 25 C100 25, 100 45, 120 45 C140 45, 140 15, 160 15" 
                    fill="none" 
                    stroke="#F59E0B" 
                    strokeWidth="3" 
                    className="animate-wave-2"
                  />
                </svg>
              </div>

              <div className="mt-2 pt-2 border-t border-white/5 flex justify-between items-center text-[9px] text-slate-400 font-mono">
                <span>Response Time</span>
                <span className="text-brand-cream font-bold">240ms</span>
              </div>
            </div>

            {/* Card 4: Animated Stat Bar Chart */}
            <div className="bg-[#0B0C10] border border-white/5 rounded-2xl p-4 flex flex-col justify-between shadow-sm relative overflow-hidden group">
              <div className="flex items-center justify-between mb-3">
                <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider block">Scrape Success Rate</span>
                <span className="w-1.5 h-1.5 rounded-full bg-brand-emerald animate-pulse" />
              </div>
              
              <div className="flex-1 flex items-end justify-center gap-6 pb-2">
                <div className="flex flex-col items-center gap-1.5 flex-1">
                  <div className="w-full bg-[#161722] rounded-t-lg h-[65px] relative overflow-hidden">
                    <div className="absolute bottom-0 left-0 right-0 bg-brand-amber animate-bar-4 w-full" />
                  </div>
                  <span className="text-[7px] text-slate-500 font-bold uppercase tracking-wider">Current</span>
                </div>
                <div className="flex flex-col items-center gap-1.5 flex-1">
                  <div className="w-full bg-[#161722] rounded-t-lg h-[65px] relative overflow-hidden">
                    <div className="absolute bottom-0 left-0 right-0 bg-brand-cream animate-bar-2 w-full" />
                  </div>
                  <span className="text-[7px] text-slate-500 font-bold uppercase tracking-wider">Target</span>
                </div>
              </div>

              <div className="mt-2 pt-2 border-t border-white/5 flex justify-between items-center text-[9px] text-slate-400 font-mono">
                <span>Weekly Average</span>
                <span className="text-white font-bold">99.8%</span>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Footer Branding section */}
      <footer className="w-full max-w-7xl mx-auto px-6 py-8 border-t border-white/5 flex flex-col sm:flex-row items-center justify-between gap-4 z-10 text-slate-500 text-[10px] font-semibold uppercase tracking-wider">
        <span>© 2026 Algonox Secretary. All rights reserved.</span>
        <div className="flex items-center gap-6">
          <a href="#privacy" className="hover:text-slate-350 transition-colors">Privacy Policy</a>
          <a href="#terms" className="hover:text-slate-350 transition-colors">Terms of Service</a>
        </div>
      </footer>

      {/* Premium Glassmorphic Login Modal Dialog */}
      {showLoginModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
          <div className="w-full max-w-md glass-panel p-8 rounded-3xl shadow-glass relative border border-brand-amber/20 bg-dark-850/90">
            {/* Modal Close Button */}
            <button
              onClick={() => setShowLoginModal(false)}
              className="absolute right-5 top-5 p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-white/5 transition-all cursor-pointer"
            >
              <X size={16} />
            </button>

            {/* Header info */}
            <div className="flex flex-col items-center mb-8">
              <div className="p-3 bg-brand-amber/10 text-brand-gold rounded-xl mb-4 border border-brand-amber/20 shadow-md">
                <Shield size={32} />
              </div>
              <h2 className="text-2xl font-bold tracking-tight text-white font-sans">
                Admin Panel Login
              </h2>
              <p className="text-slate-400 text-xs mt-2 text-center max-w-xs leading-normal">
                Sign in to view secret keys, API usage trends, and manage headless scraper sessions.
              </p>
            </div>

            {error && (
              <div className="mb-6 p-4 bg-brand-rose/10 border border-brand-rose/20 text-brand-rose text-xs rounded-xl flex items-start gap-3">
                <AlertCircle size={16} className="shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2.5">
                  Username
                </label>
                <div className="relative">
                  <User size={16} className="absolute left-3.5 top-3.5 text-slate-450" />
                  <input
                    type="text"
                    required
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="e.g. admin"
                    className="w-full bg-[#0B0C10] border border-white/5 rounded-xl py-3 pl-11 pr-4 text-white placeholder-slate-600 focus:outline-none focus:border-brand-amber transition-all text-xs font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2.5">
                  Password
                </label>
                <div className="relative">
                  <Key size={16} className="absolute left-3.5 top-3.5 text-slate-450" />
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full bg-[#0B0C10] border border-white/5 rounded-xl py-3 pl-11 pr-4 text-white placeholder-slate-600 focus:outline-none focus:border-brand-amber transition-all text-xs font-mono"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full mt-2 bg-gradient-to-r from-brand-gold to-brand-amber hover:from-brand-gold/95 hover:to-brand-amber/95 text-[#07080B] rounded-xl py-3.5 font-extrabold flex items-center justify-center gap-2 group transition-all shadow-xl shadow-brand-amber/5 disabled:opacity-50 cursor-pointer"
              >
                {loading ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    <span>Authenticating...</span>
                  </>
                ) : (
                  <>
                    <span>Sign In</span>
                    <ArrowRight size={16} className="group-hover:translate-x-0.5 transition-transform stroke-[2.5]" />
                  </>
                )}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
