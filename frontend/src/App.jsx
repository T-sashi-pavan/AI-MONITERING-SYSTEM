import React, { useState, useEffect } from 'react';
import { Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import Login from './components/Login';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import Dashboard from './components/Dashboard';
import SessionsManager from './components/SessionsManager';

export default function App() {
  const [token, setToken] = useState(localStorage.getItem('admin_token') || '');
  const [username, setUsername] = useState(localStorage.getItem('admin_username') || '');
  const [theme, setTheme] = useState(localStorage.getItem('theme') || 'dark');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => prev === 'dark' ? 'light' : 'dark');
  };

  const handleLoginSuccess = (newToken, newUsername) => {
    setToken(newToken);
    setUsername(newUsername);
    navigate('/dashboard');
  };

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
    } catch (e) {
      console.error("Logout request error: ", e);
    } finally {
      localStorage.removeItem('admin_token');
      localStorage.removeItem('admin_username');
      setToken('');
      setUsername('');
    }
  };

  // Token wellness check on application startup
  useEffect(() => {
    if (token) {
      fetch('/api/auth/me', {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      .then(res => {
        if (res.status === 401) handleLogout();
      })
      .catch(() => {});
    }
  }, [token]);

  if (!token) {
    return <Login onLoginSuccess={handleLoginSuccess} />;
  }

  // Map path to active sidebar tab id
  const getTabFromPath = (path) => {
    if (path.startsWith('/sessions')) return 'sessions';
    return 'dashboard';
  };

  // Resolve dynamic page title for the header
  const getPageTitle = (path) => {
    if (path.startsWith('/sessions/groq')) return 'Groq Cloud Platform Monitor';
    if (path.startsWith('/sessions/openai')) return 'OpenAI Platform Monitor';
    if (path.startsWith('/sessions/render')) return 'Render Platform Monitor';
    if (path.startsWith('/sessions/elevenlabs')) return 'ElevenLabs Platform Monitor';
    if (path.startsWith('/sessions/twilio')) return 'Twilio Platform Monitor';
    if (path.startsWith('/sessions/convex')) return 'Convex Platform Monitor';
    if (path.startsWith('/dashboard')) return 'System Dashboard Monitor';
    return 'Algonox Secretary Core';
  };

  const activeTab = getTabFromPath(location.pathname);

  const handleSetActiveTab = (tab) => {
    navigate('/' + tab);
  };

  return (
    <div className="flex bg-slate-50 dark:bg-[#080B11] text-slate-800 dark:text-slate-100 min-h-screen transition-colors duration-300">
      <Sidebar 
        activeTab={activeTab}
        activePath={location.pathname}
        setActiveTab={handleSetActiveTab}
        theme={theme}
        toggleTheme={toggleTheme}
        sidebarOpen={sidebarOpen}
        setSidebarOpen={setSidebarOpen}
      />

      <main className="flex-1 flex flex-col min-w-0 min-h-screen overflow-hidden md:ml-16 lg:ml-64 transition-all duration-300">
        <Header 
          sidebarOpen={sidebarOpen}
          setSidebarOpen={setSidebarOpen}
          username={username}
          onLogout={handleLogout}
          pageTitle={getPageTitle(location.pathname)}
        />

        {/* Scrollable Viewport Container for Page Views */}
        <div className="flex-1 overflow-y-auto min-w-0 bg-slate-50 dark:bg-[#080B11] transition-colors duration-300">
          <Routes>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<Dashboard token={token} />} />

            {/* Platform-specific session pages */}
            <Route path="/sessions/groq"       element={<SessionsManager token={token} platform="groq" />} />
            <Route path="/sessions/openai"     element={<SessionsManager token={token} platform="openai" />} />
            <Route path="/sessions/render"     element={<SessionsManager token={token} platform="render" />} />
            <Route path="/sessions/elevenlabs" element={<SessionsManager token={token} platform="elevenlabs" />} />
            <Route path="/sessions/twilio"     element={<SessionsManager token={token} platform="twilio" />} />
            <Route path="/sessions/convex"     element={<SessionsManager token={token} platform="convex" />} />

            {/* Fallback: legacy /sessions → groq */}
            <Route path="/sessions" element={<Navigate to="/sessions/groq" replace />} />

            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </div>
      </main>
    </div>
  );
}
