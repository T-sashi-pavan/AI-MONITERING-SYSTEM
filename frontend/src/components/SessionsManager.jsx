import React, { useState, useEffect, useRef } from 'react';
import { 
  RefreshCcw, Eye, ShieldAlert, CheckCircle2, AlertTriangle, 
  Terminal, Globe, Play, FileJson, AlertCircle, Loader2, X, Clock,
  ChevronRight, PlayCircle, Lock, Sparkles, BookOpen, Zap, Construction,
  Key, Server
} from 'lucide-react';
import { formatToIST, formatToISTShort } from '../utils/timeUtils';

export default function SessionsManager({ token, platform }) {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const activeTab = platform || 'groq'; // Driven by route prop — 'groq', 'openai', 'elevenlabs', 'render'
  const [logs, setLogs] = useState([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [selectedLogId, setSelectedLogId] = useState(null);
  const [toastMessage, setToastMessage] = useState(null);
  const [toastType, setToastType] = useState('info'); // 'info', 'success', 'error'
  
  // Modal State
  const [showManualModal, setShowManualModal] = useState(false);
  const [pastedJson, setPastedJson] = useState('');
  const [modalError, setModalError] = useState('');
  const [modalLoading, setModalLoading] = useState(false);
  
  // Date Filtering State (1 week, 1 month, 3 months)
  const [dateFilter, setDateFilter] = useState('1_month');

  // Official Key Form States
  const [officialKeys, setOfficialKeys] = useState([]);
  const [keyFormLoading, setKeyFormLoading] = useState(false);
  const [keyFormError, setKeyFormError] = useState('');
  const [providerName, setProviderName] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [totalQuota, setTotalQuota] = useState(100.0);
  const [usedQuota, setUsedQuota] = useState(0.0);
  const [syncingKeyId, setSyncingKeyId] = useState(null);

  const terminalContainerRef = useRef(null);

  const fetchSessions = async () => {
    try {
      const response = await fetch('http://localhost:8000/api/sessions', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      setSessions(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const fetchOfficialKeys = async () => {
    try {
      const response = await fetch('http://localhost:8000/api/keys', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      setOfficialKeys(data);
    } catch (e) {
      console.error(e);
    }
  };

  const fetchLogs = async (serviceName) => {
    try {
      setLogsLoading(true);
      const response = await fetch(`http://localhost:8000/api/sessions/logs/${serviceName}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      setLogs(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLogsLoading(false);
    }
  };

  // Poll sessions and official keys in real-time every 2 seconds (faster if actively scraping/authenticating)
  useEffect(() => {
    fetchSessions();
    fetchLogs(activeTab);
    fetchOfficialKeys();
    
    const hasActiveSession = sessions.some(s => s.status === 'authenticating' || (s.current_stage && s.current_stage !== 'COMPLETED' && s.current_stage !== 'FAILED'));
    const delay = hasActiveSession ? 800 : 2000;
    
    const interval = setInterval(() => {
      fetchSessions();
      fetchOfficialKeys();
    }, delay);
    
    return () => clearInterval(interval);
  }, [token, activeTab, sessions]);

  // Scroll terminal logs to bottom automatically
  useEffect(() => {
    if (terminalContainerRef.current) {
      terminalContainerRef.current.scrollTop = terminalContainerRef.current.scrollHeight;
    }
  }, [sessions, activeTab]);

  // Reset form inputs for official keys when activeTab changes
  useEffect(() => {
    if (activeTab === 'elevenlabs') {
      setTotalQuota(100000);
    } else {
      setTotalQuota(100.0);
    }
    setUsedQuota(0.0);
    setKeyFormError('');
    setProviderName('');
    setApiKey('');
  }, [activeTab]);

  const handleInteractiveLogin = async (serviceName) => {
    try {
      const response = await fetch(`http://localhost:8000/api/sessions/interactive/${serviceName}`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      setToastMessage(data.message);
      setToastType('info');
      fetchSessions();
    } catch (e) {
      console.error(e);
      setToastMessage("Failed to launch interactive browser.");
      setToastType('error');
    }
  };

  const handleManualImport = async (e) => {
    e.preventDefault();
    setModalError('');
    setModalLoading(true);

    try {
      const response = await fetch(`http://localhost:8000/api/sessions/manual/${activeTab}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ storage_state: pastedJson })
      });

      const res = await response.json();
      if (!response.ok) {
        throw new Error(res.detail || 'Failed to import session state.');
      }

      setShowManualModal(false);
      setPastedJson('');
      setToastMessage("Manual session cookies imported successfully!");
      setToastType('success');
      fetchSessions();
      fetchLogs(activeTab);
    } catch (err) {
      setModalError(err.message);
    } finally {
      setModalLoading(false);
    }
  };

  const handleTriggerScrape = async (serviceName) => {
    try {
      const response = await fetch(`http://localhost:8000/api/sessions/scrape/${serviceName}`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      setToastMessage(data.message || "Scraper triggered successfully in the background!");
      setToastType('success');
      fetchSessions();
    } catch (e) {
      console.error(e);
      setToastMessage("Failed to trigger scraper.");
      setToastType('error');
    }
  };

  const handleClearLogs = async (serviceName) => {
    if (!window.confirm("Are you sure you want to permanently delete all historical scraping logs for this service?")) return;
    try {
      const response = await fetch(`http://localhost:8000/api/sessions/logs/clear/${serviceName}`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      setToastMessage(data.message || "Logs cleared successfully!");
      setToastType('success');
      setSelectedLogId(null);
      fetchLogs(serviceName);
    } catch (e) {
      console.error(e);
      setToastMessage("Failed to clear scraping history logs.");
      setToastType('error');
    }
  };

  const handleStopExecution = async (serviceName) => {
    try {
      const response = await fetch(`http://localhost:8000/api/sessions/stop/${serviceName}`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      setToastMessage(data.message);
      setToastType('info');
      fetchSessions();
      fetchLogs(serviceName);
    } catch (e) {
      console.error(e);
      setToastMessage("Failed to stop execution flow.");
      setToastType('error');
    }
  };

  const handleAddOfficialKey = async (e) => {
    e.preventDefault();
    setKeyFormError('');
    setKeyFormLoading(true);

    const serviceLabelMap = {
      groq: 'Groq',
      openai: 'OpenAI',
      elevenlabs: 'ElevenLabs',
      render: 'Render',
      twilio: 'Twilio',
      convex: 'Convex',
    };
    const serviceLabel = serviceLabelMap[activeTab] || 'Groq';

    try {
      const response = await fetch('http://localhost:8000/api/keys', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          service_name: serviceLabel,
          provider_name: providerName,
          api_key: apiKey,
          total_quota: parseFloat(totalQuota),
          used_quota: parseFloat(usedQuota)
        })
      });

      const res = await response.json();
      if (!response.ok) {
        throw new Error(res.detail || 'Failed to register official key.');
      }

      setProviderName('');
      setApiKey('');
      setTotalQuota(100.0);
      setUsedQuota(0.0);
      fetchOfficialKeys();
    } catch (err) {
      setKeyFormError(err.message);
    } finally {
      setKeyFormLoading(false);
    }
  };

  const handleSyncOfficialKey = async (keyId) => {
    try {
      setSyncingKeyId(keyId);
      const response = await fetch(`http://localhost:8000/api/keys/${keyId}/sync`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        fetchOfficialKeys();
      }
    } catch (e) {
      console.error(e);
    } finally {
      setSyncingKeyId(null);
    }
  };

  // Trigger direct official API sync for a platform (no browser login needed)
  const handleDirectApiSync = async (serviceName) => {
    // Find the official key for this platform and sync it
    const serviceKey = officialKeys.find(
      k => k.service_name?.toLowerCase() === serviceName.toLowerCase()
    );
    if (!serviceKey) {
      setToastMessage(`No official API key found for ${serviceName}. Add one in the Keys Registry first.`);
      setToastType('error');
      return;
    }
    try {
      setSyncingKeyId(serviceKey.id);
      setToastMessage(`Syncing ${serviceName} via official API... please wait.`);
      setToastType('info');
      const response = await fetch(`http://localhost:8000/api/keys/${serviceKey.id}/sync`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      if (response.ok) {
        setToastMessage(`✅ ${serviceName} synced successfully via official API!`);
        setToastType('success');
        fetchOfficialKeys();
      } else {
        setToastMessage(`❌ Sync failed: ${data.detail || 'Unknown error'}`);
        setToastType('error');
      }
    } catch (e) {
      console.error(e);
      setToastMessage(`❌ Network error during sync.`);
      setToastType('error');
    } finally {
      setSyncingKeyId(null);
    }
  };

  const handleDeleteOfficialKey = async (keyId) => {
    if (!window.confirm("Are you sure you want to remove this official API key from monitoring?")) return;
    try {
      const response = await fetch(`http://localhost:8000/api/keys/${keyId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        fetchOfficialKeys();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleToggleMailTrigger = async (checked) => {
    try {
      const response = await fetch(`http://localhost:8000/api/sessions/mail-trigger/${activeTab}?enabled=${checked}`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        fetchSessions();
        setToastMessage(`Automated email alerts for ${activeTab.toUpperCase()} ${checked ? 'enabled' : 'disabled'}.`);
        setToastType('success');
      }
    } catch (e) {
      console.error(e);
      setToastMessage("Failed to update mail trigger.");
      setToastType('error');
    }
  };

  const handleSyncTelemetry = async () => {
    const isDirectAPI = ['openai', 'render', 'twilio', 'convex', 'elevenlabs'].includes(activeTab);
    
    if (isDirectAPI) {
      handleDirectApiSync(
        activeTab === 'openai' ? 'OpenAI'
        : activeTab === 'render' ? 'Render'
        : activeTab === 'twilio' ? 'Twilio'
        : activeTab === 'convex' ? 'Convex'
        : 'ElevenLabs'
      );
    } else {
      if (activeSessionData.status === 'unauthenticated' || 
          activeSessionData.status === 'Reconnect Required' || 
          activeSessionData.status === 'Expired' || 
          activeSessionData.status === 'expired') {
        handleInteractiveLogin(activeTab);
      } else {
        handleTriggerScrape(activeTab);
      }
    }
  };

  const activeSessionData = sessions.find(s => s.service === activeTab) || {
    service: activeTab,
    status: 'unauthenticated',
    last_login: null,
    last_successful_scrape: null,
    error_message: null,
    current_stage: null,
    stage_message: null,
    logs_feed: [],
    mail_trigger_enabled: true
  };

  useEffect(() => {
    if (activeSessionData && activeSessionData.stage_message) {
      setToastMessage(activeSessionData.stage_message);
      if (activeSessionData.current_stage === 'COMPLETED') {
        setToastType('success');
      } else if (activeSessionData.current_stage === 'FAILED' || activeSessionData.status === 'Expired' || activeSessionData.status === 'expired') {
        setToastType('error');
      } else {
        setToastType('info');
      }
    }
  }, [activeSessionData.stage_message, activeSessionData.current_stage, activeSessionData.status]);

  // Auto-dismiss toasts after 4 seconds when the scraper bot is not actively progression-polling
  useEffect(() => {
    if (toastMessage) {
      const isProgression = activeSessionData && (
        activeSessionData.status === 'authenticating' || 
        (activeSessionData.current_stage && 
         activeSessionData.current_stage !== 'COMPLETED' && 
         activeSessionData.current_stage !== 'FAILED')
      );
      
      if (!isProgression) {
        const timer = setTimeout(() => {
          setToastMessage(null);
        }, 4000);
        return () => clearTimeout(timer);
      }
    }
  }, [toastMessage, activeSessionData]);

  const latestSuccessfulLog = logs.find(l => l.status === 'success');
  const selectedLog = selectedLogId 
    ? logs.find(l => l.id === selectedLogId) 
    : (latestSuccessfulLog || logs[0]);

  const isLastSyncFailed = logs[0] && logs[0].status === 'failed';

  const scraperSteps = [
    { id: 'COOKIES_LOAD', name: 'Cookies State Load' },
    { id: 'OPENING_LOGIN_PAGE', name: 'Launch Headless' },
    { id: 'EXTRACTING_METRICS', name: 'Scraping Console' },
    { id: 'COMPLETED', name: 'Completed Sync' }
  ];

  const getStepIndex = (stageId) => {
    if (!stageId) return -1;
    if (stageId === 'FAILED') return 2;
    return scraperSteps.findIndex(s => s.id === stageId);
  };

  const activeStepIdx = getStepIndex(activeSessionData.current_stage);

  const getRequestCost = (model, inputTokens, outputTokens) => {
    const pricing = {
      'llama-3.3-70b-versatile': { input: 0.59 / 1000000, output: 0.79 / 1000000 },
      'llama3-70b-8192': { input: 0.59 / 1000000, output: 0.79 / 1000000 },
      'llama-3.1-8b-instant': { input: 0.05 / 1000000, output: 0.08 / 1000000 },
      'llama3-8b-8192': { input: 0.05 / 1000000, output: 0.08 / 1000000 },
      'mixtral-8x7b-32768': { input: 0.24 / 1000000, output: 0.24 / 1000000 },
      'gpt-4o': { input: 2.50 / 1000000, output: 10.00 / 1000000 },
      'gpt-4o-mini': { input: 0.150 / 1000000, output: 0.600 / 1000000 },
      'claude-3-5-sonnet': { input: 3.00 / 1000000, output: 15.00 / 1000000 }
    };
    const key = Object.keys(pricing).find(k => model?.toLowerCase().includes(k)) || 'default';
    const p = pricing[key] || { input: 0.15 / 1000000, output: 0.20 / 1000000 };
    return (inputTokens * p.input) + (outputTokens * p.output);
  };

  const getDateFilterLimit = (filter) => {
    const now = new Date();
    if (filter === '1_week') return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    if (filter === '1_month') return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    if (filter === '3_months') return new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
    return new Date(0);
  };

  const getFilteredMetrics = () => {
    if (!selectedLog || !selectedLog.extracted_data) {
      return { totalUsage: 'NM', requestCount: 'NM', remainingBudget: 'NM', limitsUsd: 'NM' };
    }
    
    const logsList = selectedLog.extracted_data.scraped_logs || [];
    const limitDate = getDateFilterLimit(dateFilter);
    
    const filteredLogs = logsList.filter(log => {
      const logTime = new Date(log.request_time);
      return logTime >= limitDate;
    });
    
    let totalUsage = 0;
    filteredLogs.forEach(log => {
      totalUsage += getRequestCost(log.model, log.input_tokens || 0, log.output_tokens || 0);
    });
    
    const masterSpend = selectedLog.extracted_data.usage_metrics?.total_usage_usd;
    const finalSpend = (dateFilter === '3_months' && typeof masterSpend === 'number' && masterSpend > totalUsage) 
      ? masterSpend 
      : totalUsage;
    
    return {
      totalUsage: finalSpend,
      requestCount: filteredLogs.length,
      remainingBudget: 'NM',
      limitsUsd: 'NM'
    };
  };

  const filteredMetrics = getFilteredMetrics();

  const formatUsd = (val) => {
    if (val === undefined || val === null || val === 'NM') return 'NM';
    if (typeof val === 'number') {
      if (val === 0) return '$0.00';
      if (val < 0.01) return `$${val.toFixed(4)}`;
      return `$${val.toFixed(2)}`;
    }
    return val;
  };
  
  const formatCount = (val) => {
    if (val === undefined || val === null || val === 'NM') return 'NM';
    if (typeof val === 'number') return val.toLocaleString();
    return val;
  };

  // Dynamic Instructions based on Selected Platform Tab
  const getTabConfig = (tab) => {
    switch (tab) {
      case 'groq':
        return {
          name: 'Groq Cloud',
          domain: 'console.groq.com',
          loginUrl: 'https://console.groq.com/keys',
          steps: [
            "Open console.groq.com/keys in your browser and sign in.",
            "Press F12, go to the Console, paste the generator code, and hit Enter.",
            "Click 'Paste Storage JSON' below, paste the copied state, and save!"
          ]
        };
      case 'openai':
        return {
          name: 'OpenAI API',
          domain: 'platform.openai.com',
          loginUrl: 'https://platform.openai.com/api-keys',
          steps: [
            "Open platform.openai.com in your browser and sign in.",
            "Press F12, paste the generator snippet in the Console, and press Enter.",
            "Paste the JSON string into the 'Paste Storage JSON' modal here and save!"
          ]
        };
      case 'anthropic':
        return {
          name: 'Anthropic Claude',
          domain: 'console.anthropic.com',
          loginUrl: 'https://console.anthropic.com/settings/keys',
          steps: [
            "Navigate to console.anthropic.com and complete your login.",
            "Run our 1-click generator code snippet in the developer console (F12).",
            "Copy the resulting JSON, paste it here inside the modal, and save."
          ]
        };
      case 'gemini':
        return {
          name: 'Google Gemini',
          domain: 'aistudio.google.com',
          loginUrl: 'https://aistudio.google.com/app/apikey',
          steps: [
            "Open Google AI Studio (aistudio.google.com) and log in.",
            "Press F12 to open developer console, run the clipboard generator snippet.",
            "Click 'Paste Storage JSON' below, paste your state, and click Save."
          ]
        };
      case 'elevenlabs':
        return {
          name: 'ElevenLabs Speech',
          domain: 'elevenlabs.io',
          loginUrl: 'https://elevenlabs.io/app/settings/api-keys',
          steps: [
            "Open elevenlabs.io/app and sign in to your dashboard.",
            "Open developer console (F12), paste the generator snippet, and execute.",
            "Paste the captured JSON state here and save it!"
          ]
        };
      case 'twilio':
        return {
          name: 'Twilio',
          domain: 'console.twilio.com',
          loginUrl: 'https://console.twilio.com/',
          steps: [
            "Go to console.twilio.com and find your Account SID and Auth Token.",
            "Copy both values and add them to the backend .env file as TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN.",
            "Click 'Direct API Sync' to instantly fetch your balance, API keys, and usage records."
          ]
        };
      case 'convex':
        return {
          name: 'Convex',
          domain: 'dashboard.convex.dev',
          loginUrl: 'https://dashboard.convex.dev/',
          steps: [
            "Go to dashboard.convex.dev → Team Settings → Access Tokens.",
            "Generate a new Personal Access Token and copy it.",
            "Add it to the backend .env as CONVEX_ACCESS_TOKEN, then click 'Direct API Sync'."
          ]
        };
      case 'render':
        return {
          name: 'Render Deployment',
          domain: 'dashboard.render.com',
          loginUrl: 'https://dashboard.render.com/',
          steps: [
            "Open dashboard.render.com and sign in (e.g. via GitHub OAuth).",
            "Paste our 1-click clipboard code in the console (F12) to copy storageState.",
            "Import the storage state JSON below, and click save to sync deployment URLs."
          ]
        };
      default:
        return {
          name: 'Groq Cloud',
          domain: 'console.groq.com',
          loginUrl: 'https://console.groq.com/keys',
          steps: []
        };
    }
  };

  const currentTabConfig = getTabConfig(activeTab);

  const getClipboardSnippet = (domain) => {
    return `(function() {
  const cookies = document.cookie.split('; ').filter(Boolean).map(c => {
    const [name, ...val] = c.split('=');
    return {
      name: name,
      value: val.join('='),
      domain: '.' + window.location.hostname.replace('www.', ''),
      path: '/',
      expires: Math.floor(Date.now() / 1000) + 86400 * 30,
      httpOnly: false,
      secure: true,
      sameSite: "Lax"
    };
  });
  
  const localStorageData = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    localStorageData.push({
      name: key,
      value: localStorage.getItem(key)
    });
  }
  
  const state = {
    cookies: cookies,
    origins: [
      {
        origin: window.location.origin,
        localStorage: localStorageData
      }
    ]
  };
  
  const jsonStr = JSON.stringify(state, null, 2);
  const el = document.createElement('textarea');
  el.value = jsonStr;
  document.body.appendChild(el);
  el.select();
  document.execCommand('copy');
  document.body.removeChild(el);
  
  alert("🟢 Playwright Storage State for ${domain} copied successfully! Paste it into Algonox Secretary now.");
})();`;
  };

  const isDarkMode = document.documentElement.classList.contains('dark');

  return (
    <div className="flex-1 overflow-y-auto bg-slate-50 dark:bg-[#080B11] p-8 transition-colors duration-300">
      {/* Toast Notification Banner */}
      {toastMessage && (
        <div className={`mb-6 p-4 rounded-xl border flex justify-between items-center animate-bounce shadow-md ${
          toastType === 'success'
            ? 'bg-brand-emerald/15 border-brand-emerald/30 text-brand-emerald'
            : toastType === 'error'
            ? 'bg-brand-rose/15 border-brand-rose/30 text-brand-rose'
            : 'bg-brand-cyan/20 border-brand-cyan/40 text-brand-cyan'
        }`}>
          <div className="flex items-center gap-3">
            <span className="animate-ping w-2.5 h-2.5 rounded-full bg-current shrink-0" />
            <div className="text-xs font-bold font-mono tracking-wide uppercase">
              [Bot Notification]: <span className="normal-case ml-1 font-semibold">{toastMessage}</span>
            </div>
          </div>
          <button 
            onClick={() => setToastMessage(null)}
            className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded transition-colors cursor-pointer text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* Title */}
      <div className="mb-8">
        <h2 className="text-3xl font-bold tracking-tight text-slate-800 dark:text-white font-sans">
          {activeTab === 'openai' ? 'OpenAI' : activeTab === 'render' ? 'Render' : activeTab === 'elevenlabs' ? 'ElevenLabs' : activeTab === 'twilio' ? 'Twilio' : activeTab === 'convex' ? 'Convex' : 'Groq'} — Platform Monitor
        </h2>
        <p className="text-slate-500 dark:text-slate-400 text-sm mt-1.5 leading-relaxed">
          {activeTab === 'openai' || activeTab === 'render' || activeTab === 'twilio' || activeTab === 'convex'
            ? 'Direct API integration — no browser login needed. Admin key is stored securely in the system environment.'
            : 'Manage secure headless browser sessions and cookies states. Trigger scheduled scraping runs to extract official balances and keys.'}
        </p>
      </div>

      {/* Tabs list: REMOVED — navigation is now via the sidebar      {/* Clean Platform Info Banner */}
      <div className="glass-panel bg-white/90 dark:bg-dark-900/60 p-6 rounded-2xl border border-slate-200 dark:border-slate-800/80 mb-6 relative overflow-hidden shadow-sm">
        <div className="absolute top-0 right-0 w-32 h-32 bg-brand-indigo/5 rounded-full blur-[40px] pointer-events-none" />
        <div className="flex gap-4 items-center">
          <div className="p-3 bg-brand-indigo/10 text-brand-indigo rounded-xl border border-brand-indigo/20 flex items-center justify-center shrink-0">
            <Zap size={18} className="text-brand-cyan" />
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <strong className="text-slate-800 dark:text-white font-bold text-sm">
                {['openai', 'render', 'twilio', 'convex'].includes(activeTab) 
                  ? `${currentTabConfig.name} — Direct API Integration` 
                  : `${currentTabConfig.name} — Headless Browser Sync`}
              </strong>
              <span className={`px-2 py-0.5 text-[8px] font-extrabold rounded-full uppercase tracking-wide border ${
                ['openai', 'render', 'twilio', 'convex'].includes(activeTab)
                  ? 'bg-brand-emerald/20 text-brand-emerald border-brand-emerald/30'
                  : 'bg-brand-cyan/20 text-brand-cyan border-brand-cyan/30'
              }`}>
                {['openai', 'render', 'twilio', 'convex'].includes(activeTab) ? 'Official API' : 'Browser Session'}
              </span>
            </div>
            <p className="text-slate-500 dark:text-slate-400 text-xs leading-relaxed">
              {['openai', 'render', 'twilio', 'convex'].includes(activeTab)
                ? `System environment keys are used to fetch real-time data securely. No browser login required.`
                : `Interactive browser session cookies are used to securely bypass Cloudflare and fetch quota updates.`}
            </p>
          </div>
        </div>
      </div>

      {/* Main Grid Panel */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8 items-start">
        {/* Scraper Core Card Panel */}
        <div className="xl:col-span-2 space-y-6">
          <div className="glass-panel bg-white/80 dark:bg-dark-900/60 p-8 rounded-2xl border border-slate-200 dark:border-slate-800/80 relative overflow-hidden shadow-sm">
            <div className="absolute top-0 right-0 w-48 h-48 bg-brand-indigo/5 rounded-full blur-[60px]" />

            <div className="flex justify-between items-start mb-6">
              <div>
                <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider font-sans">
                  {activeTab === 'openai' || activeTab === 'render' ? 'Official API Sync Console' : 'Bot Controller Console'}
                </span>
                <h3 className="text-xl font-bold text-slate-800 dark:text-white tracking-wide font-sans mt-1">
                  {activeTab === 'openai' || activeTab === 'render' ? `${currentTabConfig.name} Direct Integration` : `${currentTabConfig.name} Browser Automation`}
                </h3>
              </div>
              
              <span className={`px-3 py-1 text-xs font-bold rounded-full border uppercase tracking-wider ${
                activeSessionData.status === 'Connected' || activeSessionData.status === 'active'
                  ? 'bg-brand-emerald/10 border-brand-emerald/20 text-brand-emerald'
                  : activeSessionData.status === 'authenticating'
                  ? 'bg-brand-cyan/15 border-brand-cyan/30 text-brand-cyan animate-pulse'
                  : activeSessionData.status === 'Expiring Soon'
                  ? 'bg-amber-500/10 border-amber-500/20 text-amber-600 dark:text-amber-400'
                  : activeSessionData.status === 'Expired' || activeSessionData.status === 'expired'
                  ? 'bg-brand-rose/10 border-brand-rose/20 text-brand-rose'
                  : activeSessionData.status === 'Reconnect Required'
                  ? 'bg-orange-500/10 border-orange-500/20 text-orange-600 dark:text-orange-400'
                  : 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-500'
              }`}>
                Status: {activeSessionData.status}
              </span>
            </div>

            {/* Active Sync Progression Loader */}
            {activeSessionData.status === 'authenticating' && (
              <div className="mb-8 p-5 bg-[#0E1524]/60 border border-brand-cyan/20 rounded-2xl flex items-center justify-between animate-pulse">
                <div className="flex items-center gap-3">
                  <Loader2 size={18} className="text-brand-cyan animate-spin shrink-0" />
                  <div>
                    <strong className="text-slate-200 font-bold text-sm block">Headed Browser Login Sync in Progress...</strong>
                    <span className="text-slate-550 text-xs mt-0.5 block">A secure Chrome window has been opened. Please complete the login if required.</span>
                  </div>
                </div>
                <span className="px-2 py-0.5 text-[8px] font-extrabold rounded bg-brand-cyan/15 text-brand-cyan uppercase tracking-wider animate-pulse">Active</span>
              </div>
            )}

            {/* Stats Meta Row (IST timestamps) */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
              <div className="bg-slate-50 dark:bg-[#0E1524]/60 border border-slate-200 dark:border-slate-800 rounded-xl p-4 flex items-center gap-4">
                <Clock size={20} className="text-slate-400 dark:text-slate-500" />
                <div>
                  <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">OAuth Sign-in Date</span>
                  <p className="text-xs font-semibold text-slate-800 dark:text-white mt-0.5 font-mono">
                    {activeSessionData.last_login 
                      ? formatToIST(activeSessionData.last_login) 
                      : 'Not signed in'}
                  </p>
                </div>
              </div>

              <div className="bg-slate-50 dark:bg-[#0E1524]/60 border border-slate-200 dark:border-slate-800 rounded-xl p-4 flex items-center gap-4">
                <CheckCircle2 size={20} className="text-brand-emerald" />
                <div>
                  <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Last Verification Sync</span>
                  <p className="text-xs font-semibold text-slate-800 dark:text-white mt-0.5 font-mono">
                    {activeSessionData.last_successful_scrape 
                      ? formatToIST(activeSessionData.last_successful_scrape) 
                      : 'Never synced'}
                  </p>
                </div>
              </div>
            </div>

            {/* Interactive Bot Scraper Terminal Console */}
            <div className="mb-8 bg-slate-900 border border-slate-800 rounded-xl p-4 font-mono overflow-hidden shadow-2xl relative flex flex-col h-[200px]">
              <div className="absolute top-2 right-4 flex gap-1.5">
                <span className="w-2 h-2 rounded-full bg-brand-rose/40" />
                <span className="w-2 h-2 rounded-full bg-amber-500/40" />
                <span className="w-2 h-2 rounded-full bg-brand-emerald/40" />
              </div>
              <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider block mb-3 border-b border-slate-800/80 pb-2">
                🤖 Bot Scraper Console Stream
              </span>
              
              <div ref={terminalContainerRef} className="flex-1 overflow-y-auto pr-2 space-y-1.5 select-all">
                {activeSessionData.logs_feed && activeSessionData.logs_feed.length > 0 ? (
                  activeSessionData.logs_feed.map((log, lIdx) => (
                    <div key={lIdx} className="text-xs text-slate-400 font-mono leading-relaxed">
                      <span className="text-slate-500 mr-2">[{new Date(log.timestamp).toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour12: false })}]</span>
                      <span className="text-brand-indigo font-semibold mr-2">[{log.stage}]</span>
                      <span className="text-brand-emerald">{log.message}</span>
                    </div>
                  ))
                ) : (
                  <div className="h-full flex flex-col items-center justify-center text-slate-500 italic text-xs font-mono">
                    Awaiting scraper trigger to hydrate terminal stream...
                  </div>
                )}
                
                {activeSessionData.status === 'authenticating' && (
                  <div className="text-xs text-brand-emerald font-mono flex items-center">
                    <span className="text-slate-550 mr-2">[{new Date().toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour12: false })}]</span>
                    <span className="text-brand-indigo font-semibold mr-2">[BOT_POLLING]</span>
                    <span>Warming browser execution pipelines...</span>
                    <span className="w-1.5 h-3.5 bg-brand-emerald ml-1 animate-pulse inline-block align-middle" />
                  </div>
                )}
              </div>
            </div>

            {/* Action Trigger Buttons — context-aware per platform */}
            <div className="flex flex-wrap items-center justify-between gap-4 pt-6 border-t border-slate-200 dark:border-slate-800/80 w-full font-sans">
              <div className="flex flex-wrap items-center gap-4">
                {/* Unified Sync Telemetry Button */}
                <button
                  type="button"
                  onClick={handleSyncTelemetry}
                  disabled={!!syncingKeyId || activeSessionData.status === 'authenticating'}
                  className="flex items-center gap-2 px-5 py-3 bg-gradient-to-r from-brand-emerald to-teal-500 hover:from-brand-emerald/90 hover:to-teal-600 disabled:opacity-50 text-white rounded-xl text-xs font-extrabold transition-all shadow-lg hover:shadow-brand-emerald/15 group cursor-pointer"
                >
                  {syncingKeyId ? <Loader2 size={14} className="animate-spin" /> : <Zap size={14} className="group-hover:scale-110 transition-transform" />}
                  <div>
                    <span className="block text-left leading-none">Sync Telemetry Now</span>
                    <span className="text-[9.5px] text-white/70 font-medium mt-0.5 block text-left">
                      {['openai', 'render', 'twilio', 'convex', 'elevenlabs'].includes(activeTab) 
                        ? 'Official API sync · instant' 
                        : (activeSessionData.status === 'unauthenticated' || activeSessionData.status === 'Reconnect Required' || activeSessionData.status === 'Expired' || activeSessionData.status === 'expired')
                        ? 'Requires login · headed popup' 
                        : 'Background session sync'}
                    </span>
                  </div>
                </button>

                {/* Force Re-login for Browser Scrapers */}
                {!['openai', 'render', 'twilio', 'convex'].includes(activeTab) && (
                  <button
                    type="button"
                    onClick={() => handleInteractiveLogin(activeTab)}
                    className="text-xs text-slate-500 hover:text-slate-850 dark:text-slate-400 dark:hover:text-white font-semibold underline underline-offset-4 decoration-slate-300 dark:decoration-slate-700 transition-colors cursor-pointer"
                  >
                    Reconnect Browser Session
                  </button>
                )}

                {/* Stop Execution Button */}
                {(activeSessionData.status === 'authenticating' || (activeSessionData.current_stage && activeSessionData.current_stage !== 'COMPLETED' && activeSessionData.current_stage !== 'FAILED')) && (
                  <button
                    type="button"
                    onClick={() => handleStopExecution(activeTab)}
                    className="flex items-center gap-2 px-5 py-3 bg-brand-rose/10 hover:bg-brand-rose/20 text-brand-rose border border-brand-rose/30 hover:border-brand-rose/50 rounded-xl text-xs font-bold transition-all shadow group cursor-pointer"
                  >
                    <X size={14} className="text-brand-rose" />
                    <div>
                      <span className="block text-left leading-none text-brand-rose font-bold">Stop Sync</span>
                      <span className="text-[9px] text-brand-rose/65 font-medium">Aborts browser task</span>
                    </div>
                  </button>
                )}
              </div>

              {/* Automate Mail Trigger Toggle Switch */}
              <div className="flex items-center gap-3 px-4 py-2.5 bg-slate-50 dark:bg-[#0E1524]/60 border border-slate-200 dark:border-slate-800/80 rounded-xl select-none shadow-sm shrink-0">
                <div className="flex items-center gap-2">
                  <ShieldAlert size={14} className="text-brand-cyan shrink-0" />
                  <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider font-sans">Automate Mail Trigger</span>
                </div>
                <button
                  type="button"
                  onClick={() => handleToggleMailTrigger(!activeSessionData.mail_trigger_enabled)}
                  className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                    activeSessionData.mail_trigger_enabled ? 'bg-brand-emerald' : 'bg-slate-300 dark:bg-slate-700'
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                      activeSessionData.mail_trigger_enabled ? 'translate-x-4' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>
            </div>
          </div>
        </div>


        {/* History logs panel */}
        <div className="glass-panel bg-white/80 dark:bg-dark-900/60 p-6 rounded-2xl border border-slate-200 dark:border-slate-800/80 flex flex-col h-[525px] shadow-sm">
          <div className="flex justify-between items-center mb-4 pb-3 border-b border-slate-200 dark:border-slate-800/80">
            <h3 className="text-sm font-bold text-slate-800 dark:text-white uppercase tracking-wider flex items-center gap-2">
              <Terminal size={16} className="text-brand-cyan" />
              <span>Historical Scrape Runs</span>
            </h3>
            {logs.length > 0 && (
              <button
                onClick={() => handleClearLogs(activeTab)}
                className="text-[10px] font-bold text-brand-rose hover:text-brand-rose/80 border border-brand-rose/20 hover:border-brand-rose/40 px-2.5 py-1 rounded-lg bg-brand-rose/5 transition-all flex items-center gap-1 cursor-pointer"
              >
                Clear History
              </button>
            )}
          </div>

          <div className="flex-1 overflow-y-auto space-y-4 pr-1">
            {logsLoading && logs.length === 0 ? (
              <div className="h-full flex items-center justify-center text-slate-500">
                <Loader2 size={24} className="animate-spin text-brand-indigo" />
              </div>
            ) : logs.length > 0 ? (
              logs.map((log) => {
                const isSelected = selectedLogId === log.id || (!selectedLogId && logs[0].id === log.id);
                return (
                  <div 
                    key={log.id} 
                    onClick={() => setSelectedLogId(log.id)}
                    className={`p-3 rounded-xl space-y-2 cursor-pointer transition-all border ${
                      isSelected 
                        ? 'bg-brand-indigo/10 border-brand-indigo/50 dark:bg-brand-indigo/15 dark:border-brand-indigo/60 shadow-md' 
                        : 'bg-slate-50/50 dark:bg-[#0E1524]/40 border-slate-200 dark:border-dark-850 hover:bg-slate-100/50 dark:hover:bg-slate-800/20 hover:border-slate-300 dark:hover:border-slate-700/60'
                    }`}
                  >
                    <div className="flex justify-between items-center text-[10px] font-bold">
                      <span className="text-slate-400 dark:text-slate-500 font-mono">
                        {formatToISTShort(log.scraped_at)}
                      </span>
                      <span className={`px-2 py-0.5 rounded font-bold uppercase tracking-wider text-[8px] ${
                        log.status === 'success'
                          ? 'bg-brand-emerald/10 text-brand-emerald border border-brand-emerald/20'
                          : 'bg-brand-rose/10 text-brand-rose border border-brand-rose/20'
                      }`}>
                        {log.status}
                      </span>
                    </div>

                    {log.status === 'success' ? (
                      <div className="text-[11px] text-slate-650 dark:text-slate-400 space-y-1 font-mono">
                        {log.service !== 'render' ? (
                          <>
                            <div className="flex justify-between"><span>Scraped Keys:</span> <span className="text-slate-800 dark:text-white font-bold">{log.extracted_data?.api_keys_count || 0}</span></div>
                            <div className="text-[10px] text-slate-400 dark:text-slate-500 mt-1 truncate">Limits & billing synced.</div>
                          </>
                        ) : (
                          <>
                            <div className="flex justify-between"><span>Services Found:</span> <span className="text-slate-800 dark:text-white font-bold">{log.extracted_data?.services?.length || 0}</span></div>
                            <div className="text-[10px] text-slate-400 dark:text-slate-500 mt-1 truncate">Auto-discovered targets updated.</div>
                          </>
                        )}
                      </div>
                    ) : (
                      <p className="text-[11px] text-brand-rose leading-normal font-mono break-words">
                        {log.error_message?.split(':')[0] || 'Browser Execution Timeout'}
                      </p>
                    )}
                  </div>
                );
              })
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-slate-400 dark:text-slate-500 pb-12">
                <Terminal size={24} className="text-slate-300 dark:text-slate-700 stroke-1 mb-1.5" />
                <span className="text-xs">No scraping logs found.</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Selected Log Analysis Details Section */}
      {selectedLog ? (
        selectedLog.status === 'success' && selectedLog.extracted_data ? (
          <div className="glass-panel bg-white/90 dark:bg-dark-900/60 p-8 rounded-2xl border border-slate-200 dark:border-slate-800/80 mt-8 relative overflow-hidden shadow-sm animate-fade-in">
            <div className="absolute top-0 right-0 w-64 h-64 bg-brand-purple/5 rounded-full blur-[80px] pointer-events-none" />
            
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8 pb-4 border-b border-slate-200 dark:border-slate-800/80">
              <div>
                <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block">Scraper Bot Insights</span>
                <h3 className="text-2xl font-bold text-slate-800 dark:text-white tracking-wide font-sans mt-1 flex items-center gap-2.5">
                  <FileJson size={22} className="text-brand-purple" />
                  <span>Extracted {currentTabConfig.name} Metrics Analysis</span>
                </h3>
              </div>
              
              <div className="flex items-center gap-3">
                <select
                  value={dateFilter}
                  onChange={(e) => setDateFilter(e.target.value)}
                  className="bg-slate-50 dark:bg-[#0E1524] border border-slate-250 dark:border-slate-800 rounded-xl px-3 py-1.5 text-xs text-slate-800 dark:text-white focus:outline-none cursor-pointer transition-all font-sans font-semibold shadow-sm"
                >
                  <option value="1_week">1 Week (7 Days)</option>
                  <option value="1_month">1 Month (30 Days)</option>
                  <option value="3_months">3 Months (90 Days)</option>
                </select>

                <span className="px-3 py-1.5 bg-slate-50 dark:bg-dark-800/50 border border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 rounded-xl text-xs font-bold font-mono">
                  Sync Time: {formatToIST(selectedLog.scraped_at)}
                </span>
              </div>
            </div>

            {/* Last Sync Failure Alert Banner */}
            {isLastSyncFailed && (
              <div className="mb-6 p-4 rounded-xl border bg-amber-500/10 border-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center gap-3 animate-pulse font-sans">
                <AlertTriangle size={18} className="shrink-0 text-amber-500" />
                <div className="text-xs font-semibold">
                  ⚠️ Live sync failed at {formatToISTShort(logs[0].scraped_at)}. Displaying cached telemetry from {latestSuccessfulLog ? formatToIST(latestSuccessfulLog.scraped_at) : 'last good sync'}. Please check details in history.
                </div>
              </div>
            )}

            {/* Quick Metrics Grid */}
            {activeTab !== 'render' ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                <div className="bg-slate-50/50 dark:bg-[#0E1524]/60 border border-slate-200 dark:border-slate-800/60 rounded-xl p-5 shadow-sm">
                  <span className="text-[10px] font-bold text-slate-450 dark:text-slate-500 uppercase tracking-wider block font-sans">Active Keys</span>
                  <p className="text-3xl font-extrabold text-slate-800 dark:text-white mt-1.5 font-sans">
                    {selectedLog.extracted_data.api_keys_count || 0}
                  </p>
                  <span className="text-[10px] text-brand-emerald font-semibold mt-1 block">Successfully verified on console</span>
                </div>

                <div className="bg-slate-50/50 dark:bg-[#0E1524]/60 border border-slate-200 dark:border-slate-800/60 rounded-xl p-5 shadow-sm">
                  <span className="text-[10px] font-bold text-slate-450 dark:text-slate-500 uppercase tracking-wider block">Estimated Spend</span>
                  <p className="text-3xl font-extrabold text-brand-rose mt-1.5 font-sans">
                    {formatUsd(filteredMetrics.totalUsage)}
                  </p>
                  <span className="text-[10px] text-slate-400 dark:text-slate-500 mt-1 block">Selected range cost estimate</span>
                </div>

                <div className="bg-slate-50/50 dark:bg-[#0E1524]/60 border border-slate-200 dark:border-slate-800/60 rounded-xl p-5 shadow-sm">
                  <span className="text-[10px] font-bold text-slate-450 dark:text-slate-500 uppercase tracking-wider block">Remaining Budget</span>
                  <p className="text-3xl font-extrabold text-brand-emerald mt-1.5 font-sans">
                    {formatUsd(filteredMetrics.remainingBudget)}
                  </p>
                  <span className="text-[10px] text-slate-400 dark:text-slate-500 mt-1 block">Out of {formatUsd(filteredMetrics.limitsUsd)} cap</span>
                </div>

                <div className="bg-slate-50/50 dark:bg-[#0E1524]/60 border border-slate-200 dark:border-slate-800/60 rounded-xl p-5 shadow-sm">
                  <span className="text-[10px] font-bold text-slate-455 dark:text-slate-500 uppercase tracking-wider block">Usage Request Calls</span>
                  <p className="text-3xl font-extrabold text-brand-cyan mt-1.5 font-sans">
                    {formatCount(filteredMetrics.requestCount)}
                  </p>
                  <span className="text-[10px] text-slate-450 dark:text-slate-500 mt-1 block">Telemetry token/request total</span>
                </div>
              </div>
            ) : null}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Extracted Keys / Services Table */}
              <div className="lg:col-span-2 space-y-4">
                <span className="text-[10px] font-bold text-slate-400 dark:text-slate-550 uppercase tracking-wider block mb-2 font-sans">
                  {activeTab !== 'render' 
                    ? `Scraped API Keys List (${selectedLog.extracted_data.api_keys_count || 0})` 
                    : `Discovered Services List (${selectedLog.extracted_data.services?.length || 0})`}
                </span>
                
                
                <div className="border border-slate-200 dark:border-dark-850 bg-slate-50/20 dark:bg-dark-900/40 rounded-xl overflow-hidden shadow-inner">
                  {activeTab !== 'render' ? (
                    <table className="w-full border-collapse text-left font-mono text-xs">
                      <thead>
                        <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-100/50 dark:bg-[#0E1524]/80 text-[10px] font-bold text-slate-450 dark:text-slate-400 uppercase tracking-wider">
                          <th className="p-4">Key Label</th>
                          <th className="p-4">Created At</th>
                          <th className="p-4">Last Used</th>
                          <th className="p-4">Expires</th>
                          <th className="p-4">Usage (24Hrs)</th>
                          <th className="p-4 text-center">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-dark-800/50">
                        {selectedLog.extracted_data.keys_list && selectedLog.extracted_data.keys_list.length > 0 ? (
                          selectedLog.extracted_data.keys_list.map((key, idx) => (
                            <tr key={key.id || idx} className="hover:bg-slate-100/50 dark:hover:bg-dark-800/40 text-slate-600 dark:text-slate-300 font-mono transition-colors">
                              <td className="p-4 text-slate-800 dark:text-white font-sans font-bold">{key.name || 'API-Key'}</td>
                              <td className="p-4 text-slate-450 dark:text-slate-400">{key.created_at || 'NM'}</td>
                              <td className="p-4 text-slate-455 dark:text-slate-400">{key.last_used_at || 'Never'}</td>
                              <td className="p-4 text-slate-455 dark:text-slate-400">{key.expires || 'NM'}</td>
                              <td className="p-4 text-slate-455 dark:text-slate-400">{key.usage_24h || 'NM'}</td>
                              <td className="p-4 text-center">
                                <span className="px-2 py-0.5 rounded text-[8px] font-bold uppercase tracking-wider bg-slate-100 dark:bg-dark-850 text-slate-455 dark:text-slate-400 border border-slate-200 dark:border-slate-800">
                                  {key.status || 'NM'}
                                </span>
                              </td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan={6} className="p-8 text-center text-slate-400 dark:text-slate-500 italic font-sans">
                              No scraped keys extracted in this run.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  ) : (
                    <table className="w-full border-collapse text-left font-mono text-xs">
                      <thead>
                        <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-100/50 dark:bg-[#0E1524]/80 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                          <th className="p-4">Service Name</th>
                          <th className="p-4">Endpoint URL</th>
                          <th className="p-4 text-center">Deployment Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-dark-800/50">
                        {selectedLog.extracted_data.services && selectedLog.extracted_data.services.length > 0 ? (
                          selectedLog.extracted_data.services.map((svc, idx) => (
                            <tr key={idx} className="hover:bg-slate-100/50 dark:hover:bg-dark-800/40 text-slate-600 dark:text-slate-300 font-mono transition-colors">
                              <td className="p-4 text-slate-800 dark:text-white font-sans font-bold">{svc.name}</td>
                              <td className="p-4 text-brand-cyan truncate max-w-[200px]"><a href={svc.service_url} target="_blank" rel="noreferrer" className="hover:underline">{svc.service_url}</a></td>
                              <td className="p-4 text-center">
                                <span className={`px-2 py-0.5 rounded text-[8px] font-bold uppercase tracking-wider border ${
                                  svc.status?.toLowerCase() === 'live' 
                                    ? 'bg-brand-emerald/10 border-brand-emerald/20 text-brand-emerald' 
                                    : 'bg-brand-rose/10 border-brand-rose/20 text-brand-rose'
                                }`}>
                                  {svc.status || 'Unknown'}
                                </span>
                              </td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan={3} className="p-8 text-center text-slate-500 italic font-sans">
                              No services discovered in this run.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  )}
                </div>

                {selectedLog.extracted_data.additional_resources && typeof selectedLog.extracted_data.additional_resources === 'object' && Object.keys(selectedLog.extracted_data.additional_resources).length > 0 && (
                  <div className="mt-6 space-y-3">
                    <span className="text-[10px] font-bold text-slate-400 dark:text-slate-550 uppercase tracking-wider block font-sans">
                      Platform Resource Telemetry
                    </span>
                    <div className="border border-slate-200 dark:border-dark-800 bg-slate-50/20 dark:bg-dark-900/40 rounded-xl p-5 shadow-sm">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {Object.entries(selectedLog.extracted_data.additional_resources).map(([label, value]) => {
                          const isUrl = typeof value === 'string' && (value.startsWith('http://') || value.startsWith('https://'));
                          return (
                            <div key={label} className="flex flex-col pb-2 border-b border-slate-100 dark:border-slate-800 last:border-b-0 md:last:border-b border-dashed">
                              <span className="text-[10px] text-slate-400 dark:text-slate-550 uppercase tracking-wider font-semibold font-sans">
                                {label}
                              </span>
                              <span className="text-xs font-bold text-slate-850 dark:text-white mt-1 break-all">
                                {isUrl ? (
                                  <a href={value} target="_blank" rel="noopener noreferrer" className="text-brand-cyan hover:underline transition-all flex items-center gap-1 font-mono">
                                    {value}
                                  </a>
                                ) : (
                                  value
                                )}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Quotas & Rate Limits Breakdown */}
              <div className="space-y-4">
                <span className="text-[10px] font-bold text-slate-400 dark:text-slate-550 uppercase tracking-wider block mb-2 font-sans">
                  Scraped Limits (TPM / RPM)
                </span>

                <div className="bg-slate-50/50 dark:bg-[#0E1524]/60 border border-slate-200 dark:border-slate-800/60 rounded-xl p-5 space-y-4 shadow-sm">
                  {selectedLog.extracted_data.limits && typeof selectedLog.extracted_data.limits === 'object' && Object.keys(selectedLog.extracted_data.limits).length > 0 ? (
                    Object.entries(selectedLog.extracted_data.limits).map(([model, spec]) => (
                      <div key={model} className="pb-3 border-b border-slate-200 dark:border-dark-850 last:border-b-0 last:pb-0 font-sans">
                        <div className="flex justify-between items-center mb-1.5">
                          <span className="text-xs font-bold text-slate-800 dark:text-white font-sans truncate pr-2" title={model}>{model}</span>
                          <span className="px-1.5 py-0.5 rounded text-[8px] font-bold bg-brand-indigo/10 border border-brand-indigo/20 text-brand-indigo uppercase shrink-0">
                            Verified
                          </span>
                        </div>
                        <div className="grid grid-cols-2 gap-4 font-mono text-[10px] text-slate-455 dark:text-slate-400">
                          <div>
                            <span className="text-slate-400 dark:text-slate-500 text-[9px] uppercase tracking-wider block">Token Limit</span>
                            <span className="text-brand-cyan font-bold">{(spec?.tpm || 0).toLocaleString()} TPM</span>
                          </div>
                          <div>
                            <span className="text-slate-400 dark:text-slate-500 text-[9px] uppercase tracking-wider block">Request Limit</span>
                            <span className="text-brand-purple font-bold">{(spec?.rpm || 0).toLocaleString()} RPM</span>
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-xs text-slate-400 dark:text-slate-550 italic p-4 text-center font-sans">
                      No limits details parsed in this run.
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* Error Details Box for Failed Runs */
          <div className="glass-panel bg-white dark:bg-dark-900/60 p-8 rounded-2xl border border-brand-rose/30 mt-8 relative overflow-hidden shadow-sm animate-fade-in">
            <div className="absolute top-0 right-0 w-64 h-64 bg-brand-rose/5 rounded-full blur-[80px] pointer-events-none" />
            
            <div className="flex items-start gap-4 mb-6">
              <div className="p-3.5 bg-brand-rose/15 text-brand-rose border border-brand-rose/30 rounded-2xl flex items-center justify-center shrink-0">
                <ShieldAlert size={24} className="text-brand-rose" />
              </div>
              <div>
                <span className="text-[10px] font-bold text-slate-400 dark:text-slate-550 uppercase tracking-wider block font-sans">Execution Status: Failed Run</span>
                <h3 className="text-xl font-bold text-slate-800 dark:text-white tracking-wide mt-1 font-sans">
                  Scraper Bot Sync Failure Details
                </h3>
                <p className="text-xs text-slate-500 mt-1 font-mono">
                  Run ID: {selectedLog.id} | Checked: {formatToIST(selectedLog.scraped_at)}
                </p>
              </div>
            </div>
            
            <div className="bg-slate-50 dark:bg-dark-900/60 border border-slate-200 dark:border-dark-850 p-6 rounded-xl font-mono text-xs text-slate-655 dark:text-slate-350 space-y-3 leading-relaxed">
              <div>
                <strong className="text-brand-rose uppercase text-[10px] tracking-wide block mb-1 font-sans">Error Category / Context</strong>
                <p className="text-slate-800 dark:text-white text-sm font-sans font-bold">
                  {selectedLog.error_message?.split(':')[0] || 'Browser Execution Aborted'}
                </p>
              </div>
              <div className="pt-3 border-t border-slate-200 dark:border-dark-850">
                <strong className="text-slate-400 dark:text-slate-500 uppercase text-[10px] tracking-wide block mb-1.5 font-sans">Full Stack Trace</strong>
                <div className="bg-slate-900 border border-slate-950 p-4 rounded-lg overflow-x-auto text-[11px] text-slate-400 whitespace-pre-wrap select-all font-mono leading-normal shadow-inner">
                  {selectedLog.error_message || 'The scraper request timed out while loading the page context.'}
                </div>
              </div>
            </div>
            
            <div className="mt-6 flex items-center gap-2 text-xs text-slate-500 dark:text-slate-550 font-sans">
              <AlertCircle size={14} className="text-amber-500" />
              <span>Tip: Refresh your session state by executing the 1-click clipboard browser code, paste JSON and save.</span>
            </div>
          </div>
        )
      ) : null}

      {/* Manual JSON Modal */}
      {showManualModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-dark-900/80 backdrop-blur-sm">
          <div className="w-full max-w-lg glass-panel bg-white dark:bg-dark-900 p-8 rounded-2xl shadow-2xl relative border border-slate-200 dark:border-slate-800">
            <button
              onClick={() => setShowManualModal(false)}
              className="absolute right-4 top-4 p-1.5 text-slate-400 hover:text-slate-800 dark:hover:text-white rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-all cursor-pointer"
            >
              <X size={16} />
            </button>

            <div className="flex items-center gap-3 mb-6">
              <div className="p-2.5 bg-brand-indigo/10 text-brand-indigo rounded-xl border border-brand-indigo/20">
                <FileJson size={18} />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-800 dark:text-white font-sans">Manual Session JSON State</h3>
                <p className="text-xs text-slate-400 dark:text-slate-500 uppercase font-semibold mt-0.5 tracking-wide text-brand-cyan">
                  Service: {currentTabConfig.name}
                </p>
              </div>
            </div>

            {modalError && (
              <div className="mb-4 p-3 bg-brand-rose/10 border border-brand-rose/25 text-brand-rose text-xs rounded-lg flex items-center gap-2 font-sans">
                <AlertCircle size={14} className="shrink-0" />
                <span>{modalError}</span>
              </div>
            )}

            <form onSubmit={handleManualImport} className="space-y-4 font-sans">
              <div>
                <label className="block text-[10px] font-bold text-slate-450 dark:text-slate-400 uppercase tracking-wider mb-2">
                  Playwright storageState() JSON String
                </label>
                <textarea
                  required
                  rows={8}
                  value={pastedJson}
                  onChange={(e) => setPastedJson(e.target.value)}
                  placeholder='Paste your {"cookies": [...], "origins": [...]} JSON string here...'
                  className="w-full bg-slate-50 dark:bg-[#0E1524]/60 border border-slate-200 dark:border-slate-800 rounded-lg p-3 text-[11px] text-slate-800 dark:text-white focus:outline-none focus:border-brand-indigo font-mono placeholder-slate-400 leading-normal shadow-sm"
                />
              </div>

              <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-slate-200 dark:border-slate-800/80">
                <button
                  type="button"
                  onClick={() => setShowManualModal(false)}
                  className="px-4 py-2 bg-slate-100 dark:bg-dark-800 hover:bg-slate-200 dark:hover:bg-dark-850 text-slate-655 dark:text-slate-300 rounded-lg text-xs font-semibold transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={modalLoading}
                  className="px-5 py-2 bg-gradient-to-r from-brand-gold to-brand-amber hover:from-brand-gold/90 hover:to-brand-amber/90 text-[#07080B] rounded-lg text-xs font-extrabold flex items-center gap-1.5 shadow-lg transition-all cursor-pointer"
                >
                  {modalLoading && <Loader2 size={12} className="animate-spin" />}
                  <span>Save Session Cookies</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
