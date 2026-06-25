import React, { useState } from 'react';
import { LayoutDashboard, KeyRound, Sun, Moon, ChevronDown, ChevronRight, Zap, Shield, X } from 'lucide-react';

// Per-platform metadata for the sidebar nav
const PLATFORM_NAV = [
  { id: 'groq',       label: 'Groq Cloud',      badge: 'API',  badgeColor: 'text-sky-400 bg-sky-400/10 border-sky-400/30' },
  { id: 'openai',     label: 'OpenAI',           badge: 'API',  badgeColor: 'text-brand-emerald bg-brand-emerald/10 border-brand-emerald/30' },
  { id: 'render',     label: 'Render',           badge: 'API',  badgeColor: 'text-brand-emerald bg-brand-emerald/10 border-brand-emerald/30' },
  { id: 'elevenlabs', label: 'ElevenLabs',       badge: 'API',  badgeColor: 'text-violet-400 bg-violet-400/10 border-violet-400/30' },
  { id: 'twilio',     label: 'Twilio',           badge: 'API',  badgeColor: 'text-red-400 bg-red-400/10 border-red-400/30' },
  { id: 'convex',     label: 'Convex',           badge: 'API',  badgeColor: 'text-orange-400 bg-orange-400/10 border-orange-400/30' },
];

export default function Sidebar({ activeTab, activePath, setActiveTab, theme, toggleTheme, sidebarOpen, setSidebarOpen }) {
  const [sessionsOpen, setSessionsOpen] = useState(activePath?.startsWith('/sessions'));

  const topItems = [
    { id: 'dashboard', name: 'Dashboard Monitor', icon: LayoutDashboard },
  ];

  const navigateTo = (path) => {
    // Navigate via popstate event workaround
    window.history.pushState({}, '', path);
    window.dispatchEvent(new PopStateEvent('popstate'));
    setSidebarOpen(false); // Close drawer on mobile
  };

  return (
    <>
      {/* Backdrop overlay for mobile drawer slide-in */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs z-50 md:hidden transition-opacity duration-300"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside className={`fixed inset-y-0 left-0 z-50 flex flex-col h-screen bg-white dark:bg-dark-900 border-r border-slate-200 dark:border-slate-800/80 transition-all duration-300 ${
        sidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
      } w-64 md:w-16 lg:w-64 shrink-0 overflow-y-auto`}>
        
        {/* Brand Header */}
        <div className="p-6 md:p-4 lg:p-6 border-b border-slate-200 dark:border-slate-800/80 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 md:justify-center lg:justify-start w-full">
            <div className="p-2 bg-gradient-to-tr from-brand-gold to-brand-amber text-white rounded-lg shadow-md shadow-brand-amber/10 shrink-0">
              <Shield size={20} className="stroke-[2.5]" />
            </div>
            <div className="md:hidden lg:block truncate">
              <h1 className="font-extrabold text-sm tracking-wide uppercase leading-tight font-sans logo-gradient-text">
                Algonox
              </h1>
              <span className="text-[10px] text-slate-400 dark:text-slate-500 font-semibold uppercase tracking-widest block leading-none mt-0.5">
                Secretary Core
              </span>
            </div>
          </div>

          {/* Close button for mobile menu */}
          <button
            onClick={() => setSidebarOpen(false)}
            className="p-1.5 text-slate-500 hover:text-slate-800 dark:text-slate-450 dark:hover:text-white rounded-lg hover:bg-slate-100 dark:hover:bg-dark-800 transition-colors md:hidden focus:outline-none cursor-pointer"
            title="Close Menu"
          >
            <X size={18} />
          </button>
        </div>

        {/* Navigation Menu */}
        <nav className="flex-1 px-4 py-6 md:px-2 lg:px-4 space-y-1">
          {/* Dashboard link */}
          {topItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => {
                  setActiveTab(item.id);
                  setSidebarOpen(false);
                }}
                className={`w-full flex items-center gap-3.5 px-4 py-3 md:px-2 md:py-3 lg:px-4 md:justify-center lg:justify-start rounded-xl font-medium text-sm transition-all duration-300 group cursor-pointer ${
                  isActive
                    ? 'bg-slate-100 dark:bg-gradient-to-r dark:from-brand-indigo/20 dark:to-brand-purple/10 text-slate-900 dark:text-white border-l-2 border-brand-indigo pl-3.5 md:pl-2 lg:pl-3.5 shadow shadow-slate-100 dark:shadow-brand-indigo/5'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100/70 dark:hover:bg-dark-800/60'
                }`}
              >
                <Icon size={18} className={isActive ? 'text-brand-cyan' : 'text-slate-400 dark:text-slate-400 group-hover:text-slate-900 dark:group-hover:text-white'} />
                <span className="md:hidden lg:inline truncate">{item.name}</span>
              </button>
            );
          })}

          {/* Platform Sessions — collapsible group */}
          <div className="pt-2">
            <button
              onClick={() => setSessionsOpen(v => !v)}
              className={`w-full flex items-center gap-3.5 px-4 py-3 md:px-2 md:py-3 lg:px-4 md:justify-center lg:justify-start rounded-xl font-medium text-sm transition-all duration-300 group cursor-pointer ${
                activeTab === 'sessions'
                  ? 'text-slate-900 dark:text-white bg-slate-100/70 dark:bg-dark-800/40'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100/70 dark:hover:bg-dark-800/60'
              }`}
            >
              <KeyRound size={18} className={activeTab === 'sessions' ? 'text-brand-cyan' : 'text-slate-400 group-hover:text-slate-900 dark:group-hover:text-white'} />
              <span className="flex-1 text-left md:hidden lg:inline truncate">API Platforms</span>
              <div className="md:hidden lg:block shrink-0">
                {sessionsOpen
                  ? <ChevronDown size={14} className="text-slate-400" />
                  : <ChevronRight size={14} className="text-slate-400" />}
              </div>
            </button>

            {sessionsOpen && (
              <div className="mt-1 ml-4 pl-3 md:ml-0 md:pl-0 lg:ml-4 lg:pl-3 border-l md:border-l-0 lg:border-l border-slate-200 dark:border-slate-800 space-y-0.5">
                {PLATFORM_NAV.map((p) => {
                  const path = `/sessions/${p.id}`;
                  const isActive = activePath === path;
                  return (
                    <button
                      key={p.id}
                      onClick={() => navigateTo(path)}
                      className={`w-full flex items-center gap-2.5 px-3 py-2.5 md:px-2 lg:px-3 md:justify-center lg:justify-start rounded-lg text-xs font-semibold transition-all duration-200 group cursor-pointer ${
                        isActive
                          ? 'bg-brand-indigo/10 dark:bg-brand-indigo/15 text-slate-900 dark:text-white border border-brand-indigo/30'
                          : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white hover:bg-slate-100/60 dark:hover:bg-dark-800/50'
                      }`}
                    >
                      <Zap size={12} className={isActive ? 'text-brand-cyan' : 'text-slate-400 group-hover:text-brand-cyan'} />
                      <span className="flex-1 text-left md:hidden lg:inline truncate">{p.label}</span>
                      {p.badge && (
                        <span className={`px-1 py-0.5 text-[7px] font-extrabold rounded border leading-none tracking-wide uppercase md:hidden lg:inline-block ${p.badgeColor}`}>
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

        {/* Theme Switcher Widget */}
        <div className="p-4 md:p-2 lg:p-4 border-t border-slate-200 dark:border-slate-800/80">
          <div className="flex items-center justify-between md:justify-center lg:justify-between px-3 py-2 md:px-1 lg:px-3 rounded-xl bg-slate-100/70 dark:bg-dark-800/60 border border-slate-200/50 dark:border-slate-800/30">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 md:hidden lg:inline">Appearance</span>
            <button
              onClick={toggleTheme}
              className="p-1.5 rounded-lg bg-white dark:bg-dark-900 text-brand-cyan border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-dark-850 transition-all shadow-sm flex items-center justify-center cursor-pointer focus:outline-none"
              title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            >
              {theme === 'dark' ? <Sun size={14} className="text-amber-400" /> : <Moon size={14} className="text-indigo-600" />}
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
