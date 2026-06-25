import React, { useState, useRef, useEffect } from 'react';
import { Menu, LogOut, Shield, User, ChevronDown, ChevronUp } from 'lucide-react';

export default function Header({ sidebarOpen, setSidebarOpen, username, onLogout, pageTitle }) {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <header className="h-16 border-b border-slate-200 dark:border-slate-800/80 bg-white/95 dark:bg-[#090A0E]/95 backdrop-blur-md px-6 flex items-center justify-between shrink-0 sticky top-0 z-40 transition-colors duration-300">
      {/* Left side: Hamburger, Logo, Page Title */}
      <div className="flex items-center gap-3">
        {/* Hamburger Menu button for mobile/tablet drawer */}
        <button
          onClick={() => setSidebarOpen(true)}
          className="p-2 -ml-2 text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white rounded-lg hover:bg-slate-100 dark:hover:bg-dark-800 transition-colors md:hidden cursor-pointer focus:outline-none"
          title="Toggle Sidebar Menu"
        >
          <Menu size={20} className="stroke-[2.5]" />
        </button>

        {/* Small Brand Logo (visible on mobile where sidebar is hidden) */}
        <div className="flex items-center gap-2 md:hidden">
          <div className="p-1.5 bg-gradient-to-tr from-brand-gold to-brand-amber text-white rounded-lg shadow-sm shadow-brand-amber/10">
            <Shield size={14} className="stroke-[2.5]" />
          </div>
          <span className="font-extrabold text-xs tracking-wider uppercase leading-none logo-gradient-text">
            Algonox
          </span>
        </div>

        {/* Vertical Divider (Hidden on mobile) */}
        <div className="h-6 w-px bg-slate-200 dark:bg-slate-800 md:block hidden mx-1" />

        {/* Dynamic Page Title */}
        <h2 className="text-base font-bold text-slate-800 dark:text-white leading-tight font-sans tracking-wide">
          {pageTitle}
        </h2>
      </div>

      {/* Right side: Relocated User Profile / Session controls */}
      <div className="flex items-center gap-4">
        
        {/* Desktop View: Inline profile cards & Sign out button */}
        <div className="hidden md:flex items-center gap-4">
          {/* User info details */}
          <div className="flex items-center gap-2.5 px-3 py-1.5 rounded-xl bg-slate-50/80 dark:bg-dark-800/40 border border-slate-200 dark:border-slate-800/30">
            <div className="w-6 h-6 rounded-full bg-brand-cyan/20 border border-brand-cyan/40 text-brand-cyan flex items-center justify-center font-bold text-xs uppercase shadow-sm">
              {username ? username[0] : 'A'}
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-700 dark:text-slate-200 leading-none">
                {username || 'Administrator'}
              </p>
              <div className="flex items-center gap-1 mt-0.5 leading-none">
                <span className="w-1.5 h-1.5 rounded-full bg-brand-emerald pulse-green" />
                <span className="text-[9px] font-bold text-brand-emerald tracking-wider uppercase">
                  Online
                </span>
              </div>
            </div>
          </div>

          {/* Logout Button */}
          <button
            onClick={onLogout}
            className="flex items-center gap-1.5 px-3.5 py-1.5 bg-slate-50 dark:bg-dark-800 hover:bg-brand-rose/10 hover:border-brand-rose/25 text-slate-500 hover:text-brand-rose border border-slate-250 dark:border-slate-800 rounded-xl text-xs font-semibold transition-all group cursor-pointer"
          >
            <LogOut size={13} className="group-hover:-translate-x-0.5 transition-transform" />
            <span>Sign Out</span>
          </button>
        </div>

        {/* Mobile View: Compact profile dropdown toggle */}
        <div className="relative md:hidden" ref={dropdownRef}>
          <button
            onClick={() => setDropdownOpen(v => !v)}
            className="flex items-center gap-1.5 p-1 rounded-full hover:bg-slate-100 dark:hover:bg-dark-800 border border-transparent hover:border-slate-200 dark:hover:border-slate-800 transition-all cursor-pointer focus:outline-none"
            title="User Profile Menu"
          >
            <div className="w-8 h-8 rounded-full bg-brand-cyan/20 border border-brand-cyan/40 text-brand-cyan flex items-center justify-center font-bold text-sm uppercase shadow-sm">
              {username ? username[0] : 'A'}
            </div>
            {dropdownOpen ? <ChevronUp size={14} className="text-slate-400" /> : <ChevronDown size={14} className="text-slate-400" />}
          </button>

          {/* Floating Dropdown Dialog */}
          {dropdownOpen && (
            <div className="absolute right-0 mt-2.5 w-52 bg-white dark:bg-dark-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl p-4 space-y-3.5 animate-fade-in z-50">
              <div className="border-b border-slate-100 dark:border-slate-800/80 pb-2">
                <p className="text-xs font-bold text-slate-800 dark:text-white truncate">
                  {username || 'Administrator'}
                </p>
                <div className="flex items-center gap-1.5 mt-1 leading-none">
                  <span className="w-1.5 h-1.5 rounded-full bg-brand-emerald pulse-green" />
                  <span className="text-[9px] font-bold text-brand-emerald tracking-widest uppercase">
                    Admin Online
                  </span>
                </div>
              </div>

              <button
                onClick={() => {
                  setDropdownOpen(false);
                  onLogout();
                }}
                className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-slate-50 dark:bg-dark-850 hover:bg-brand-rose/10 hover:text-brand-rose text-slate-500 rounded-xl text-xs font-bold border border-slate-200 dark:border-slate-800 transition-all group cursor-pointer"
              >
                <LogOut size={13} className="group-hover:-translate-x-0.5 transition-transform" />
                <span>Sign Out</span>
              </button>
            </div>
          )}
        </div>

      </div>
    </header>
  );
}
