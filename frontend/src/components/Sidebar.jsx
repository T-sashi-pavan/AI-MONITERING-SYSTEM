import React, { useState } from 'react';
import { LayoutDashboard, KeyRound, LogOut, Shield, Sun, Moon, ChevronDown, ChevronRight, Zap, Globe, Bot } from 'lucide-react';

// Per-platform metadata for the sidebar nav
const PLATFORM_NAV = [
  { id: 'groq',       label: 'Groq Cloud',      badge: 'API',  badgeColor: 'text-sky-400 bg-sky-400/10 border-sky-400/30' },
  { id: 'openai',     label: 'OpenAI',           badge: 'API',  badgeColor: 'text-brand-emerald bg-brand-emerald/10 border-brand-emerald/30' },
  { id: 'render',     label: 'Render',           badge: 'API',  badgeColor: 'text-brand-emerald bg-brand-emerald/10 border-brand-emerald/30' },
  { id: 'elevenlabs', label: 'ElevenLabs',       badge: 'API',  badgeColor: 'text-violet-400 bg-violet-400/10 border-violet-400/30' },
  { id: 'twilio',     label: 'Twilio',           badge: 'API',  badgeColor: 'text-red-400 bg-red-400/10 border-red-400/30' },
  { id: 'convex',     label: 'Convex',           badge: 'API',  badgeColor: 'text-orange-400 bg-orange-400/10 border-orange-400/30' },
];

export default function Sidebar({ activeTab, activePath, setActiveTab, onLogout, username, theme, toggleTheme }) {
  const [sessionsOpen, setSessionsOpen] = useState(activePath?.startsWith('/sessions'));

  const topItems = [
    { id: 'dashboard', name: 'Dashboard Monitor', icon: LayoutDashboard },
  ];

  const navigateTo = (path) => {
    // setActiveTab navigates via navigate('/' + tab)
    // But for deep paths like /sessions/groq we use a workaround:
    // Emit a custom navigation event that App.jsx can pick up
    // Actually, we pass the full path by setting it on window.location
    window.history.pushState({}, '', path);
    window.dispatchEvent(new PopStateEvent('popstate'));
  };

  return (
    <aside className="w-64 bg-white dark:bg-dark-900 border-r border-slate-200 dark:border-slate-800/80 flex flex-col min-h-screen relative shrink-0 transition-colors duration-300">
      {/* Brand Header */}
      <div className="p-6 border-b border-slate-200 dark:border-slate-800/80 flex items-center gap-3">
        <div className="p-2 bg-gradient-to-tr from-brand-gold to-brand-amber text-[#07080B] rounded-lg shadow-md shadow-brand-amber/10">
          <Shield size={20} className="stroke-[2.5]" />
        </div>
        <div>
          <h1 className="font-extrabold text-sm tracking-wide uppercase leading-tight font-sans logo-gradient-text">
            Algonox
          </h1>
          <span className="text-[10px] text-slate-400 dark:text-slate-500 font-semibold uppercase tracking-widest block leading-none mt-0.5">
            Secretary Core
          </span>
        </div>
      </div>

      {/* Navigation Menu */}
      <nav className="flex-1 px-4 py-6 space-y-1">
        {/* Dashboard link */}
        {topItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`w-full flex items-center gap-3.5 px-4 py-3 rounded-xl font-medium text-sm transition-all duration-300 group ${
                isActive
                  ? 'bg-slate-100 dark:bg-gradient-to-r dark:from-brand-indigo/20 dark:to-brand-purple/10 text-slate-900 dark:text-white border-l-2 border-brand-indigo pl-3.5 shadow shadow-slate-100 dark:shadow-brand-indigo/5'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100/70 dark:hover:bg-dark-800/60'
              }`}
            >
              <Icon size={18} className={isActive ? 'text-brand-cyan' : 'text-slate-400 dark:text-slate-400 group-hover:text-slate-900 dark:group-hover:text-white'} />
              <span>{item.name}</span>
            </button>
          );
        })}

        {/* Platform Sessions — collapsible group */}
        <div className="pt-2">
          <button
            onClick={() => setSessionsOpen(v => !v)}
            className={`w-full flex items-center gap-3.5 px-4 py-3 rounded-xl font-medium text-sm transition-all duration-300 group cursor-pointer ${
              activeTab === 'sessions'
                ? 'text-slate-900 dark:text-white bg-slate-100/70 dark:bg-dark-800/40'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100/70 dark:hover:bg-dark-800/60'
            }`}
          >
            <KeyRound size={18} className={activeTab === 'sessions' ? 'text-brand-cyan' : 'text-slate-400 group-hover:text-slate-900 dark:group-hover:text-white'} />
            <span className="flex-1 text-left">API Platforms</span>
            {sessionsOpen
              ? <ChevronDown size={14} className="text-slate-400 shrink-0" />
              : <ChevronRight size={14} className="text-slate-400 shrink-0" />}
          </button>

          {sessionsOpen && (
            <div className="mt-1 ml-4 pl-3 border-l border-slate-200 dark:border-slate-800 space-y-0.5">
              {PLATFORM_NAV.map((p) => {
                const path = `/sessions/${p.id}`;
                const isActive = activePath === path;
                return (
                  <button
                    key={p.id}
                    onClick={() => navigateTo(path)}
                    className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-xs font-semibold transition-all duration-200 group cursor-pointer ${
                      isActive
                        ? 'bg-brand-indigo/10 dark:bg-brand-indigo/15 text-slate-900 dark:text-white border border-brand-indigo/30'
                        : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white hover:bg-slate-100/60 dark:hover:bg-dark-800/50'
                    }`}
                  >
                    <Zap size={12} className={isActive ? 'text-brand-cyan' : 'text-slate-400 group-hover:text-brand-cyan'} />
                    <span className="flex-1 text-left">{p.label}</span>
                    {p.badge && (
                      <span className={`px-1 py-0.5 text-[7px] font-extrabold rounded border leading-none tracking-wide uppercase ${p.badgeColor}`}>
                        {p.badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </nav>

      {/* Theme Switcher & User Session */}
      <div className="p-4 border-t border-slate-200 dark:border-slate-800/80 space-y-4">
        {/* Theme Switcher Widget */}
        <div className="flex items-center justify-between px-3 py-2 rounded-xl bg-slate-100/70 dark:bg-dark-800/60 border border-slate-200/50 dark:border-slate-800/30">
          <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Appearance</span>
          <button
            onClick={toggleTheme}
            className="p-1.5 rounded-lg bg-white dark:bg-dark-900 text-brand-cyan border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-dark-850 transition-all shadow-sm flex items-center justify-center cursor-pointer"
            title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
          >
            {theme === 'dark' ? <Sun size={14} className="text-amber-400" /> : <Moon size={14} className="text-indigo-600" />}
          </button>
        </div>

        {/* Profile Card */}
        <div className="flex items-center gap-3 px-2 py-1.5 rounded-lg bg-slate-50/50 dark:bg-dark-800/60 border border-slate-250 dark:border-slate-800/30">
          <div className="w-8 h-8 rounded-full bg-brand-cyan/20 border border-brand-cyan/40 text-brand-cyan flex items-center justify-center font-bold text-sm uppercase">
            {username ? username[0] : 'A'}
          </div>
          <div className="overflow-hidden">
            <p className="text-xs font-semibold text-slate-800 dark:text-white truncate leading-none mb-1">
              {username || 'Administrator'}
            </p>
            <span className="text-[9px] font-bold text-brand-emerald tracking-wider uppercase">
              Online
            </span>
          </div>
        </div>

        <button
          onClick={onLogout}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-50 dark:bg-dark-800 border border-slate-200 dark:border-slate-800 hover:bg-brand-rose/10 hover:border-brand-rose/20 text-slate-500 dark:text-slate-400 hover:text-brand-rose rounded-xl text-sm font-medium transition-all group"
        >
          <LogOut size={16} className="group-hover:-translate-x-0.5 transition-transform" />
          <span>Sign Out</span>
        </button>
      </div>
    </aside>
  );
}
