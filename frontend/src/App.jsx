import React, { useState, useEffect } from 'react';
import { Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import Login from './components/Login';
import Sidebar from './components/Sidebar';
import Dashboard from './components/Dashboard';
import SessionsManager from './components/SessionsManager';

export default function App() {
  const [token, setToken] = useState(localStorage.getItem('admin_token') || '');
  const [username, setUsername] = useState(localStorage.getItem('admin_username') || '');
  const [theme, setTheme] = useState(localStorage.getItem('theme') || 'dark');
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
      await fetch('http://localhost:8000/api/auth/logout', {
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
      fetch('http://localhost:8000/api/auth/me', {
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
        onLogout={handleLogout}
        username={username}
        theme={theme}
        toggleTheme={toggleTheme}
      />

      <main className="flex-1 flex flex-col min-w-0 min-h-screen">
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
      </main>
    </div>
  );
}
