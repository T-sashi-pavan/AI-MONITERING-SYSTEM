import React, { useState, useEffect } from 'react';
import { 
  Activity, Globe, Server, CheckCircle2, AlertTriangle, 
  Clock, ShieldAlert, Check, ChevronRight, Loader2, Sparkles,
  Cpu, Zap, Volume2, Layers, Phone, Database
} from 'lucide-react';
import { Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import { formatToIST } from '../utils/timeUtils';

// Register ChartJS elements
ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

export default function Dashboard({ token }) {
  const [stats, setStats] = useState(null);
  const [alerts, setAlerts] = useState([]);
  const [activities, setActivities] = useState([]);
  const [services, setServices] = useState([]);
  const [keys, setKeys] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sessions, setSessions] = useState([]);
  const [platformLogs, setPlatformLogs] = useState({});

  const fetchDashboardData = async () => {
    try {
      const headers = { 'Authorization': `Bearer ${token}` };
      
      const [
        statsRes, alertsRes, activityRes, servicesRes, keysRes, sessionsRes,
        openaiRes, groqRes, elevenlabsRes, renderRes, twilioRes, convexRes
      ] = await Promise.all([
        fetch('/api/analytics/summary', { headers }),
        fetch('/api/analytics/alerts?unresolved_only=true', { headers }),
        fetch('/api/analytics/activity?limit=10', { headers }),
        fetch('/api/health', { headers }),
        fetch('/api/keys', { headers }),
        fetch('/api/sessions', { headers }),
        fetch('/api/sessions/logs/openai', { headers }),
        fetch('/api/sessions/logs/groq', { headers }),
        fetch('/api/sessions/logs/elevenlabs', { headers }),
        fetch('/api/sessions/logs/render', { headers }),
        fetch('/api/sessions/logs/twilio', { headers }),
        fetch('/api/sessions/logs/convex', { headers })
      ]);

      const statsData = await statsRes.json();
      const alertsData = await alertsRes.json();
      const activityData = await activityRes.json();
      const servicesData = await servicesRes.json();
      const keysData = await keysRes.json();
      const sessionsData = await sessionsRes.json();
      
      const openaiData = await openaiRes.json();
      const groqData = await groqRes.json();
      const elevenlabsData = await elevenlabsRes.json();
      const renderData = await renderRes.json();
      const twilioData = await twilioRes.json();
      const convexData = await convexRes.json();

      setStats(statsData);
      setAlerts(alertsData);
      setActivities(activityData);
      setServices(servicesData);
      setKeys(keysData);
      setSessions(sessionsData);
      setPlatformLogs({
        openai: openaiData,
        groq: groqData,
        elevenlabs: elevenlabsData,
        render: renderData,
        twilio: twilioData,
        convex: convexData
      });
    } catch (e) {
      console.error("Dashboard fetch error: ", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
    const interval = setInterval(fetchDashboardData, 30000);
    return () => clearInterval(interval);
  }, [token]);

  const handleResolveAlert = async (alertId) => {
    try {
      const response = await fetch(`/api/analytics/alerts/${alertId}/resolve`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        fetchDashboardData();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const isValidValue = (val) => {
    if (val === undefined || val === null) return false;
    const str = String(val).trim();
    if (str === '' || str.toUpperCase() === 'NM' || str.toUpperCase() === 'NOT MENTIONED' || str.toUpperCase() === 'N/A' || str.toUpperCase() === '-') {
      return false;
    }
    return true;
  };

  const getPlatformTelemetry = (platformId) => {
    const session = sessions.find(s => s.service === platformId) || {};
    const logs = platformLogs[platformId] || [];
    const latestSuccessLog = logs.find(l => l.status === 'success') || {};
    const data = latestSuccessLog.extracted_data || {};
    
    let statusText = 'LOGIN REQUIRED';
    let statusColor = 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-500';
    
    const rawStatus = session.status?.toUpperCase() || '';
    if (rawStatus === 'CONNECTED' || rawStatus === 'ACTIVE') {
      statusText = 'CONNECTED';
      statusColor = 'bg-brand-emerald/10 border-brand-emerald/20 text-brand-emerald';
    } else if (rawStatus.includes('EXPIRED')) {
      statusText = 'SESSION EXPIRED';
      statusColor = 'bg-brand-rose/10 border-brand-rose/20 text-brand-rose';
    } else if (rawStatus === 'AUTHENTICATING' || rawStatus === 'SYNCING') {
      statusText = 'SYNCING';
      statusColor = 'bg-brand-indigo/10 border-brand-indigo/20 text-brand-indigo animate-pulse';
    } else if (rawStatus === 'FAILED' || rawStatus === 'ERROR') {
      statusText = 'ERROR';
      statusColor = 'bg-brand-rose/10 border-brand-rose/20 text-brand-rose';
    } else if (rawStatus === 'RECONNECT REQUIRED' || rawStatus === 'UNAUTHENTICATED') {
      statusText = 'LOGIN REQUIRED';
      statusColor = 'bg-amber-500/10 border-amber-500/20 text-amber-500';
    }
    
    let lastSync = null;
    const rawSyncTime = session.last_successful_scrape || latestSuccessLog.scraped_at;
    if (rawSyncTime) {
      try {
        lastSync = formatToIST(rawSyncTime);
      } catch (e) {
        lastSync = rawSyncTime;
      }
    }
    
    return {
      session,
      latestSuccessLog,
      data,
      statusText,
      statusColor,
      lastSync
    };
  };

  const getPlatformMetrics = (platformId, data, session, serviceKeys) => {
    const list = [];
    
    const getStatusLabel = (status) => {
      if (!status) return 'LOGIN REQUIRED';
      const s = status.toUpperCase();
      if (s === 'CONNECTED' || s === 'ACTIVE') return 'CONNECTED';
      if (s.includes('EXPIRED')) return 'SESSION EXPIRED';
      if (s === 'AUTHENTICATING' || s === 'SYNCING') return 'SYNCING';
      if (s === 'FAILED' || s === 'ERROR') return 'ERROR';
      if (s === 'RECONNECT REQUIRED' || s === 'UNAUTHENTICATED') return 'LOGIN REQUIRED';
      return status;
    };

    const formatUsd = (val) => {
      if (!isValidValue(val)) return null;
      const num = parseFloat(String(val).replace('$', '').replace(/,/g, '').trim());
      if (isNaN(num)) return val;
      return `$${num.toFixed(2)}`;
    };

    const formatCount = (val) => {
      if (!isValidValue(val)) return null;
      const num = parseInt(String(val).replace(/,/g, '').trim());
      if (isNaN(num)) return val;
      return num.toLocaleString();
    };

    let totalKeys = null;
    if (platformId === 'openai') {
      totalKeys = data.api_keys_count ?? data.keys_list?.length ?? serviceKeys.length;
    } else if (platformId === 'groq') {
      totalKeys = data.api_keys_count ?? data.keys_list?.length ?? serviceKeys.length;
    } else if (platformId === 'elevenlabs') {
      totalKeys = data.api_key_count ?? data.api_keys_count ?? serviceKeys.length;
    } else if (platformId === 'render') {
      totalKeys = null;
    } else if (platformId === 'twilio') {
      totalKeys = data.api_keys_count ?? data.keys_list?.length ?? serviceKeys.length;
    } else if (platformId === 'convex') {
      totalKeys = data.api_keys_count ?? data.keys_list?.length ?? serviceKeys.length;
    }

    if (isValidValue(totalKeys)) {
      list.push({ label: 'Total Keys', value: formatCount(totalKeys) });
    }

    let totalSpend = null;
    if (platformId === 'openai') {
      totalSpend = data.estimated_spend ?? data.usage_metrics?.total_usage_usd;
    } else if (platformId === 'groq') {
      totalSpend = data.usage_metrics?.total_usage_usd;
    } else if (platformId === 'twilio') {
      totalSpend = data.additional_resources?.['Monthly Spend (USD)'] ?? data.usage_detail?.monthly_spend_usd;
    }
    
    if (isValidValue(totalSpend)) {
      list.push({ label: 'Total Spend', value: formatUsd(totalSpend) });
    }

    let balance = null;
    if (platformId === 'openai') {
      balance = data.remaining_budget ?? data.usage_metrics?.remaining_budget_usd;
    } else if (platformId === 'render') {
      balance = data.creditBalance;
    } else if (platformId === 'twilio') {
      balance = data.additional_resources?.['Balance'] ?? data.limits?.balance;
    }
    
    if (isValidValue(balance)) {
      list.push({ label: 'Remaining Balance', value: formatUsd(balance) });
    }

    const loginStatus = getStatusLabel(session.status);
    if (isValidValue(loginStatus)) {
      list.push({ label: 'Login Status', value: loginStatus });
    }

    if (platformId === 'openai') {
      const limit = data.usage_limit ?? data.usage_metrics?.limits_usd;
      if (isValidValue(limit)) {
        list.push({ label: 'Usage Limit', value: formatUsd(limit) });
      }
      const tier = data.limits?.tier ?? data.additional_resources?.['Rate Limit Tier'];
      if (isValidValue(tier)) {
        list.push({ label: 'Tier', value: tier });
      }
    }

    if (platformId === 'groq') {
      const active = data.keys_list?.filter(k => k.status === 'Active').length ?? data.active_keys;
      if (isValidValue(active)) {
        list.push({ label: 'Active Keys', value: formatCount(active) });
      }
      const remCredits = data.limits?.tokens_remaining;
      if (isValidValue(remCredits)) {
        list.push({ label: 'Remaining Credits', value: formatCount(remCredits) });
      }
    }

    if (platformId === 'elevenlabs') {
      const quota = data.total_credits;
      if (isValidValue(quota)) {
        list.push({ label: 'Character Quota', value: formatCount(quota) });
      }
      const rem = data.remaining_credits;
      if (isValidValue(rem)) {
        list.push({ label: 'Characters Remaining', value: formatCount(rem) });
      }
      const plan = data.plan_name;
      if (isValidValue(plan)) {
        list.push({ label: 'Subscription Plan', value: plan });
      }
    }

    if (platformId === 'render') {
      const servicesCount = data.services?.length ?? data.renderServices?.length;
      if (isValidValue(servicesCount)) {
        list.push({ label: 'Total Services', value: formatCount(servicesCount) });
      }
      const plan = data.currentPlan;
      if (isValidValue(plan)) {
        list.push({ label: 'Current Plan', value: plan });
      }
      const freeHours = data.includedUsage?.freeInstanceHours;
      if (freeHours) {
        const remaining = freeHours.limit - freeHours.used;
        list.push({ label: 'Free Hours Left', value: `${remaining.toFixed(1)} / ${freeHours.limit} hrs` });
      }
      const bandwidth = data.includedUsage?.bandwidth;
      if (bandwidth) {
        list.push({ label: 'Bandwidth Used', value: `${bandwidth.used} / ${bandwidth.limit}` });
      }
      const pipeline = data.includedUsage?.pipelineMinutes;
      if (pipeline) {
        const remaining = pipeline.limit - pipeline.used;
        list.push({ label: 'Pipeline Mins Left', value: `${remaining} / ${pipeline.limit} mins` });
      }
      const alert = data.billingAlertActive;
      if (alert !== undefined && alert !== null) {
        list.push({ label: 'Invoice Status', value: alert ? '⚠ Alert Active' : '✓ Paid / OK' });
      }
    }

    if (platformId === 'twilio') {
      const accStatus = data.additional_resources?.['Account Status'] ?? data.limits?.account_status;
      if (isValidValue(accStatus)) {
        list.push({ label: 'Account Status', value: String(accStatus).toUpperCase() });
      }
      const activeSvc = serviceKeys.filter(k => k.status === 'active').length;
      if (isValidValue(activeSvc)) {
        list.push({ label: 'Active Services', value: formatCount(activeSvc) });
      }
      const phoneCount = data.additional_resources?.['Phone Numbers Count'];
      if (isValidValue(phoneCount)) {
        list.push({ label: 'Phone Numbers Count', value: formatCount(phoneCount) });
      }
    }

    if (platformId === 'convex') {
      const projCount = data.additional_resources?.['Projects Found'] ?? data.keys_list?.length;
      if (isValidValue(projCount)) {
        list.push({ label: 'Project Count', value: formatCount(projCount) });
      }
      const tokenType = data.additional_resources?.['Token Type'];
      if (isValidValue(tokenType)) {
        list.push({ label: 'Token Type', value: tokenType });
      }
    }

    return list;
  };

  if (loading && !stats) {
    return (
      <div className="flex-1 flex items-center justify-center bg-slate-50 dark:bg-[#080B11] text-slate-500 dark:text-slate-400">
        <Loader2 size={36} className="animate-spin text-brand-indigo" />
        <span className="ml-3 font-semibold font-sans">Hydrating system overview...</span>
      </div>
    );
  }

  const platforms = [
    { id: 'openai', name: 'OpenAI', icon: Cpu, color: 'from-emerald-500/10 to-teal-500/5 hover:border-emerald-500/40 text-emerald-400 dark:text-emerald-300' },
    { id: 'groq', name: 'Groq', icon: Zap, color: 'from-cyan-500/10 to-blue-500/5 hover:border-cyan-500/40 text-cyan-400 dark:text-cyan-300' },
    { id: 'elevenlabs', name: 'ElevenLabs', icon: Volume2, color: 'from-violet-500/10 to-purple-500/5 hover:border-violet-500/40 text-violet-400 dark:text-violet-300' },
    { id: 'render', name: 'Render', icon: Layers, color: 'from-indigo-500/10 to-blue-500/5 hover:border-indigo-500/40 text-indigo-400 dark:text-indigo-300' },
    { id: 'twilio', name: 'Twilio', icon: Phone, color: 'from-rose-500/10 to-red-500/5 hover:border-rose-500/40 text-rose-400 dark:text-rose-300' },
    { id: 'convex', name: 'Convex', icon: Database, color: 'from-orange-500/10 to-amber-500/5 hover:border-orange-500/40 text-orange-400 dark:text-orange-300' }
  ];

  const isDarkMode = document.documentElement.classList.contains('dark');

  const chartData = {
    labels: services.map(s => s.name),
    datasets: [
      {
        label: 'Uptime Percentage (%)',
        data: services.map(s => s.uptime_percentage),
        backgroundColor: services.map(s => s.status === 'down' ? '#F43F5E' : '#10B981'),
        borderRadius: 6,
        borderWidth: 0,
        maxBarThickness: 32,
      }
    ]
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: isDarkMode ? '#111827' : '#ffffff',
        titleColor: isDarkMode ? '#fff' : '#1f2937',
        bodyColor: isDarkMode ? '#9CA3AF' : '#4b5563',
        borderColor: isDarkMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)',
        borderWidth: 1,
        padding: 12,
        cornerRadius: 8,
      }
    },
    scales: {
      x: {
        grid: { display: false },
        ticks: { color: isDarkMode ? '#9CA3AF' : '#4b5563', font: { family: 'Outfit', size: 11 } }
      },
      y: {
        min: 0,
        max: 100,
        grid: { color: isDarkMode ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)' },
        ticks: { color: isDarkMode ? '#9CA3AF' : '#4b5563', font: { family: 'Outfit', size: 11 } }
      }
    }
  };

  return (
    <div className="w-full bg-slate-50 dark:bg-[#080B11] p-4 sm:p-6 lg:p-8 transition-colors duration-300">
      {/* Welcome Headline */}
      <div className="mb-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-white font-sans">
            Algonox Secretary Dashboard
          </h2>
          <p className="text-slate-500 dark:text-slate-400 text-xs sm:text-sm mt-1.5 leading-relaxed">
            Centralized health monitoring, rolling uptimes, and official API balances in **Indian Standard Time (IST)**.
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs font-semibold px-3.5 py-2 rounded-xl bg-white dark:bg-dark-900 border border-slate-200 dark:border-slate-800 shadow-sm self-start sm:self-auto">
          <span className="w-2.5 h-2.5 rounded-full bg-brand-emerald animate-pulse" />
          <span className="text-slate-500 dark:text-slate-400">Live polling active</span>
        </div>
      </div>

      {/* Primary KPI Grid (4 columns desktop, 2 tablet, 1 mobile) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 mb-8">
        {/* Total Services */}
        <div className="glass-card bg-white/80 dark:bg-dark-900/60 p-5 sm:p-6 rounded-2xl border border-slate-200 dark:border-slate-800/80 relative overflow-hidden group shadow-sm transition-all duration-300 hover:shadow-md hover:-translate-y-0.5 flex flex-col justify-between min-h-[140px]">
          <div className="flex justify-between items-start mb-4">
            <span className="text-slate-500 dark:text-slate-400 text-xs font-bold uppercase tracking-wider">Health Targets</span>
            <div className="p-2 bg-brand-indigo/10 text-brand-indigo rounded-xl border border-brand-indigo/20">
              <Server size={18} />
            </div>
          </div>
          <div>
            <h3 className="text-3xl font-extrabold text-slate-800 dark:text-white">{stats?.total_services || 0}</h3>
            <p className="text-[10px] text-slate-400 dark:text-slate-500 font-medium mt-1">Configured for polling</p>
          </div>
        </div>

        {/* Active Services */}
        <div className="glass-card bg-white/80 dark:bg-dark-900/60 p-5 sm:p-6 rounded-2xl border border-slate-200 dark:border-slate-800/80 relative overflow-hidden group shadow-sm transition-all duration-300 hover:shadow-md hover:-translate-y-0.5 flex flex-col justify-between min-h-[140px]">
          <div className="flex justify-between items-start mb-4">
            <span className="text-slate-500 dark:text-slate-400 text-xs font-bold uppercase tracking-wider">Online Targets</span>
            <div className="p-2 bg-brand-emerald/10 text-brand-emerald rounded-xl border border-brand-emerald/20">
              <CheckCircle2 size={18} />
            </div>
          </div>
          <div>
            <h3 className="text-3xl font-extrabold text-brand-emerald">{stats?.active_services || 0}</h3>
            <p className="text-[10px] text-slate-400 dark:text-slate-500 font-medium mt-1">Passing health pings</p>
          </div>
        </div>

        {/* Failed Services */}
        <div className="glass-card bg-white/80 dark:bg-dark-900/60 p-5 sm:p-6 rounded-2xl border border-slate-200 dark:border-slate-800/80 relative overflow-hidden group shadow-sm transition-all duration-300 hover:shadow-md hover:-translate-y-0.5 flex flex-col justify-between min-h-[140px]">
          <div className="flex justify-between items-start mb-4">
            <span className="text-slate-500 dark:text-slate-400 text-xs font-bold uppercase tracking-wider">Active Outages</span>
            <div className={`p-2 rounded-xl border ${stats?.failed_services > 0 ? 'bg-brand-rose/20 text-brand-rose border-brand-rose/30' : 'bg-slate-100 dark:bg-slate-800 text-slate-400 border-slate-200 dark:border-slate-700'}`}>
              <AlertTriangle size={18} />
            </div>
          </div>
          <div>
            <h3 className={`text-3xl font-extrabold ${stats?.failed_services > 0 ? 'text-brand-rose' : 'text-slate-800 dark:text-white'}`}>{stats?.failed_services || 0}</h3>
            <p className="text-[10px] text-slate-400 dark:text-slate-500 font-medium mt-1">Incident alerts triggered</p>
          </div>
        </div>

        {/* Average Response Time & Success Rate wrapped in responsive layout */}
        <div className="glass-card bg-white/80 dark:bg-dark-900/60 p-5 sm:p-6 rounded-2xl border border-slate-200 dark:border-slate-800/80 relative overflow-hidden group shadow-sm transition-all duration-300 hover:shadow-md hover:-translate-y-0.5 flex flex-col justify-between min-h-[140px]">
          <div className="flex justify-between items-start mb-4">
            <span className="text-slate-500 dark:text-slate-400 text-xs font-bold uppercase tracking-wider">Avg Latency</span>
            <div className="p-2 bg-brand-cyan/10 text-brand-cyan rounded-xl border border-brand-cyan/20">
              <Clock size={18} />
            </div>
          </div>
          <div>
            <h3 className="text-3xl font-extrabold text-brand-cyan">{stats?.avg_response_time_ms || 0}<span className="text-xs font-semibold text-slate-400 ml-1">ms</span></h3>
            <p className="text-[10px] text-slate-400 dark:text-slate-500 font-medium mt-1">Average response time</p>
          </div>
        </div>
      </div>

      {/* Extra KPI Success Rate card rendering on wrapped row for 4-col desktop, or stacking nicely */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 mb-8">
        <div className="glass-card bg-white/80 dark:bg-dark-900/60 p-5 sm:p-6 rounded-2xl border border-slate-200 dark:border-slate-800/80 relative overflow-hidden group shadow-sm transition-all duration-300 hover:shadow-md hover:-translate-y-0.5 flex flex-col justify-between min-h-[140px] sm:col-span-2 lg:col-span-4">
          <div className="flex justify-between items-start mb-2">
            <span className="text-slate-500 dark:text-slate-400 text-xs font-bold uppercase tracking-wider">Success Rate</span>
            <div className="p-2 bg-brand-purple/10 text-brand-purple rounded-xl border border-brand-purple/20">
              <Activity size={18} />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <h3 className="text-3xl font-extrabold text-brand-purple">{stats?.success_rate_pct || 100}<span className="text-xs font-semibold text-slate-400 ml-1">%</span></h3>
            <p className="text-[10px] text-slate-400 dark:text-slate-500 font-medium ml-1">Checks success last 24 hours</p>
          </div>
        </div>
      </div>

      {/* Section 2: Platform Connection Status */}
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-6">
          <Sparkles size={16} className="text-brand-cyan" />
          <h3 className="text-xs sm:text-sm font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider font-sans">API Platforms Monitor Dashboard</h3>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {platforms.map((platform) => {
            const IconComponent = platform.icon;
            const tele = getPlatformTelemetry(platform.id);
            const serviceKeys = keys.filter(k => k.service_name?.toLowerCase() === platform.id);
            const metricsList = getPlatformMetrics(platform.id, tele.data, tele.session, serviceKeys);

            return (
              <div 
                key={platform.id}
                className={`glass-panel bg-gradient-to-br ${platform.color} border border-slate-200 dark:border-slate-800/80 rounded-3xl p-6 transition-all duration-300 hover:shadow-lg hover:-translate-y-1 flex flex-col justify-between min-h-[350px] shadow-sm relative overflow-hidden`}
              >
                {/* Visual Top Glow */}
                <div className="absolute top-[-20%] left-[-20%] w-[150px] h-[150px] bg-brand-indigo/5 rounded-full blur-[40px] pointer-events-none" />

                {/* Card Header */}
                <div className="flex items-center justify-between mb-5 z-10">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-slate-200/50 dark:bg-dark-800/60 rounded-xl border border-slate-200 dark:border-slate-750 text-slate-700 dark:text-slate-200 shadow-sm shrink-0">
                      <IconComponent size={20} className="stroke-[2.5]" />
                    </div>
                    <div>
                      <h4 className="font-extrabold text-slate-900 dark:text-white font-sans text-sm tracking-wide leading-tight">
                        {platform.name}
                      </h4>
                    </div>
                  </div>
                  <span className={`px-2.5 py-1 text-[9px] font-extrabold rounded-full border tracking-wide uppercase shrink-0 ${tele.statusColor}`}>
                    {tele.statusText}
                  </span>
                </div>

                {/* Card Body - Metrics List */}
                <div className="flex-1 space-y-3 z-10 mt-2">
                  {metricsList.map((m, idx) => (
                    <div key={idx} className="flex justify-between items-center py-1.5 border-b border-slate-100 dark:border-slate-800/40 last:border-b-0">
                      <span className="text-[11px] font-bold text-slate-400 dark:text-slate-550 uppercase tracking-wider">
                        {m.label}
                      </span>
                      <span className="text-xs font-extrabold text-slate-850 dark:text-white font-mono leading-none">
                        {m.value}
                      </span>
                    </div>
                  ))}
                  {metricsList.length === 0 && (
                    <div className="text-slate-400 italic text-[11px] py-4 text-center">
                      No active telemetry logged
                    </div>
                  )}
                </div>

                {/* Card Footer - Last Sync Time */}
                <div className="mt-5 pt-3 border-t border-slate-100 dark:border-slate-800/60 flex items-center justify-between z-10 text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider font-mono">
                  <span>Last Sync</span>
                  <span className="text-slate-600 dark:text-slate-400 font-extrabold">
                    {tele.lastSync || 'Never'}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Section 3: Charts & Alert Feeds */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 items-start">
        {/* comparative chart panel */}
        <div className="col-span-1 md:col-span-1 lg:col-span-2 glass-panel bg-white dark:bg-dark-900/60 p-5 sm:p-6 rounded-2xl h-[380px] border border-slate-200 dark:border-slate-800/80 flex flex-col shadow-sm">
          <div className="flex justify-between items-center mb-6 gap-2">
            <h3 className="text-xs sm:text-sm font-bold text-slate-800 dark:text-white uppercase tracking-wider font-sans truncate">
              Services Uptime Rollings (%)
            </h3>
            <span className="text-[9px] px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 font-bold uppercase border border-slate-200 dark:border-slate-700 shrink-0">
              Live checks status
            </span>
          </div>
          <div className="flex-1 min-h-0 relative w-full">
            {services.length > 0 ? (
              <Bar data={chartData} options={chartOptions} />
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center text-slate-500">
                <Globe size={32} className="stroke-1 mb-2 text-slate-400" />
                <span className="text-sm font-sans text-center">No health checking URLs configured.</span>
              </div>
            )}
          </div>
        </div>

        {/* Incident Alerts Panel */}
        <div className="col-span-1 glass-panel bg-white dark:bg-dark-900/60 p-5 sm:p-6 rounded-2xl h-[380px] border border-slate-200 dark:border-slate-800/80 flex flex-col overflow-hidden shadow-sm">
          <div className="flex justify-between items-center mb-4 pb-3 border-b border-slate-200 dark:border-slate-800/80">
            <h3 className="text-xs sm:text-sm font-bold text-slate-800 dark:text-white uppercase tracking-wider flex items-center gap-2 truncate">
              <ShieldAlert size={16} className="text-brand-rose shrink-0" />
              <span>Outages Alert Feed</span>
            </h3>
            <span className="text-[9px] font-bold bg-brand-rose/25 text-brand-rose border border-brand-rose/30 px-2 py-0.5 rounded-full uppercase shadow-sm shrink-0">
              {alerts.length} Active
            </span>
          </div>

          <div className="flex-1 overflow-y-auto space-y-3 pr-1">
            {alerts.length > 0 ? (
              alerts.map((alert) => (
                <div 
                  key={alert.id} 
                  className={`p-3.5 border rounded-xl flex items-start gap-3 transition-all ${
                    alert.severity === 'critical' 
                      ? 'bg-brand-rose/5 border-brand-rose/25 text-slate-650 dark:text-slate-300' 
                      : 'bg-amber-500/5 border-amber-500/25 text-slate-650 dark:text-slate-300'
                  }`}
                >
                  <AlertTriangle size={16} className={`shrink-0 mt-0.5 ${alert.severity === 'critical' ? 'text-brand-rose' : 'text-amber-500'}`} />
                  <div className="flex-1 min-w-0">
                    <h4 className="text-xs font-bold text-slate-800 dark:text-white truncate leading-none mb-1">
                      {alert.service_name}
                    </h4>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-normal mb-2">
                      {alert.message}
                    </p>
                    <button
                      onClick={() => handleResolveAlert(alert.id)}
                      className="text-[10px] font-bold text-brand-emerald hover:text-brand-emerald/80 flex items-center gap-1 group cursor-pointer"
                    >
                      <Check size={12} className="stroke-[3]" />
                      <span>Mark Acknowledged</span>
                    </button>
                  </div>
                </div>
              ))
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-slate-400 dark:text-slate-500 pb-8 text-center">
                <CheckCircle2 size={36} className="text-brand-emerald stroke-1 mb-2 animate-bounce" />
                <span className="text-xs font-semibold text-slate-700 dark:text-slate-400">All systems operational!</span>
                <span className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">No active downtime alerts.</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Section 4: Audit Logs Table */}
      <div className="glass-panel bg-white dark:bg-dark-900/60 p-5 sm:p-6 rounded-2xl mt-6 border border-slate-200 dark:border-slate-800/80 shadow-sm">
        <h3 className="text-xs sm:text-sm font-bold text-slate-800 dark:text-white uppercase tracking-wider mb-4 pb-3 border-b border-slate-200 dark:border-slate-800/80 font-sans">
          Recent Administrative Audit Log
        </h3>
        
        {/* Table scroll helper */}
        <div className="w-full overflow-x-auto">
          <table className="w-full min-w-[600px] text-left text-xs border-collapse font-sans">
            <thead>
              <tr className="text-slate-400 dark:text-slate-500 border-b border-slate-200 dark:border-slate-800 font-semibold uppercase tracking-wider">
                <th className="py-2.5 pr-4">Action Event</th>
                <th className="py-2.5 pr-4">Details</th>
                <th className="py-2.5 pr-4">Client IP</th>
                <th className="py-2.5 text-right">Timestamp (IST)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-medium text-slate-650 dark:text-slate-300">
              {activities.map((act, index) => (
                <tr key={index} className="hover:bg-slate-100/50 dark:hover:bg-slate-850/20 transition-colors">
                  <td className="py-3 pr-4">
                    <span className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700/80 rounded-md font-mono text-[10px]">
                      {act.action}
                    </span>
                  </td>
                  <td className="py-3 pr-4 text-slate-550 dark:text-slate-400 font-sans break-words max-w-xs">{act.details}</td>
                  <td className="py-3 pr-4 font-mono text-slate-400 dark:text-slate-500">{act.ip_address}</td>
                  <td className="py-3 text-right text-slate-400 dark:text-slate-500 font-mono whitespace-nowrap">
                    {formatToIST(act.timestamp)}
                  </td>
                </tr>
              ))}
              {activities.length === 0 && (
                <tr>
                  <td colSpan={4} className="py-6 text-center text-slate-400 dark:text-slate-500 italic">
                    No recent audit logs available.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
