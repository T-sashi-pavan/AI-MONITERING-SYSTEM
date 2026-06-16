import React, { useState, useEffect } from 'react';
import { 
  Activity, Globe, Server, CheckCircle2, AlertTriangle, 
  Clock, ShieldAlert, Check, ChevronRight, Loader2, Sparkles, Database
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
import { formatToIST, formatToISTShort } from '../utils/timeUtils';

// Register ChartJS elements
ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

export default function Dashboard({ token }) {
  const [stats, setStats] = useState(null);
  const [alerts, setAlerts] = useState([]);
  const [activities, setActivities] = useState([]);
  const [services, setServices] = useState([]);
  const [keys, setKeys] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchDashboardData = async () => {
    try {
      const headers = { 'Authorization': `Bearer ${token}` };
      
      const [statsRes, alertsRes, activityRes, servicesRes, keysRes] = await Promise.all([
        fetch('/api/analytics/summary', { headers }),
        fetch('/api/analytics/alerts?unresolved_only=true', { headers }),
        fetch('/api/analytics/activity?limit=10', { headers }),
        fetch('/api/health', { headers }),
        fetch('/api/keys', { headers })
      ]);

      const statsData = await statsRes.json();
      const alertsData = await alertsRes.json();
      const activityData = await activityRes.json();
      const servicesData = await servicesRes.json();
      const keysData = await keysRes.json();

      setStats(statsData);
      setAlerts(alertsData);
      setActivities(activityData);
      setServices(servicesData);
      setKeys(keysData);
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

  if (loading && !stats) {
    return (
      <div className="flex-1 flex items-center justify-center bg-slate-50 dark:bg-[#080B11] text-slate-500 dark:text-slate-400">
        <Loader2 size={36} className="animate-spin text-brand-indigo" />
        <span className="ml-3 font-semibold font-sans">Hydrating system overview...</span>
      </div>
    );
  }

  // Group keys by service
  const getServiceStats = (serviceName) => {
    const serviceKeys = keys.filter(k => k.service_name.toLowerCase() === serviceName.toLowerCase());
    const activeKeysCount = serviceKeys.filter(k => k.status === 'active').length;
    const totalBalance = serviceKeys.reduce((acc, k) => acc + (k.balance || 0), 0);
    return {
      count: serviceKeys.length,
      activeCount: activeKeysCount,
      balance: totalBalance,
      status: serviceKeys.length > 0 ? (activeKeysCount > 0 ? 'active' : 'inactive') : 'none'
    };
  };

  const platforms = [
    { id: 'groq', name: 'Groq Cloud', color: 'border-cyan-500/20 text-cyan-500 bg-cyan-500/5' },
    { id: 'openai', name: 'OpenAI API', color: 'border-emerald-500/20 text-emerald-500 bg-emerald-500/5' },
    { id: 'anthropic', name: 'Anthropic Claude', color: 'border-amber-500/20 text-amber-500 bg-amber-500/5' },
    { id: 'gemini', name: 'Google Gemini', color: 'border-indigo-500/20 text-indigo-500 bg-indigo-500/5' },
    { id: 'elevenlabs', name: 'ElevenLabs Speech', color: 'border-purple-500/20 text-purple-500 bg-purple-500/5' },
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
    <div className="flex-1 overflow-y-auto bg-slate-50 dark:bg-[#080B11] p-8 transition-colors duration-300">
      {/* Welcome Headline */}
      <div className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white font-sans">
            Algonox Secretary Dashboard
          </h2>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-1.5 leading-relaxed">
            Centralized health monitoring, rolling uptimes, and official API balances in **Indian Standard Time (IST)**.
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs font-semibold px-3.5 py-2 rounded-xl bg-white dark:bg-dark-900 border border-slate-200 dark:border-slate-800 shadow-sm">
          <span className="w-2.5 h-2.5 rounded-full bg-brand-emerald animate-pulse" />
          <span className="text-slate-500 dark:text-slate-400">Live polling active</span>
        </div>
      </div>

      {/* Primary KPI Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6 mb-8">
        {/* Total Services */}
        <div className="glass-card bg-white/80 dark:bg-dark-900/60 p-6 rounded-2xl border border-slate-200 dark:border-slate-800/80 relative overflow-hidden group shadow-sm transition-all duration-300 hover:shadow-md hover:-translate-y-0.5">
          <div className="flex justify-between items-start mb-4">
            <span className="text-slate-500 dark:text-slate-400 text-xs font-bold uppercase tracking-wider">Health Targets</span>
            <div className="p-2 bg-brand-indigo/10 text-brand-indigo rounded-xl border border-brand-indigo/20">
              <Server size={18} />
            </div>
          </div>
          <h3 className="text-3xl font-extrabold text-slate-800 dark:text-white">{stats?.total_services || 0}</h3>
          <p className="text-[10px] text-slate-400 dark:text-slate-500 font-medium mt-1">Configured for polling</p>
        </div>

        {/* Active Services */}
        <div className="glass-card bg-white/80 dark:bg-dark-900/60 p-6 rounded-2xl border border-slate-200 dark:border-slate-800/80 relative overflow-hidden group shadow-sm transition-all duration-300 hover:shadow-md hover:-translate-y-0.5">
          <div className="flex justify-between items-start mb-4">
            <span className="text-slate-500 dark:text-slate-400 text-xs font-bold uppercase tracking-wider">Online Targets</span>
            <div className="p-2 bg-brand-emerald/10 text-brand-emerald rounded-xl border border-brand-emerald/20">
              <CheckCircle2 size={18} />
            </div>
          </div>
          <h3 className="text-3xl font-extrabold text-brand-emerald">{stats?.active_services || 0}</h3>
          <p className="text-[10px] text-slate-400 dark:text-slate-500 font-medium mt-1">Passing health pings</p>
        </div>

        {/* Failed Services */}
        <div className="glass-card bg-white/80 dark:bg-dark-900/60 p-6 rounded-2xl border border-slate-200 dark:border-slate-800/80 relative overflow-hidden group shadow-sm transition-all duration-300 hover:shadow-md hover:-translate-y-0.5">
          <div className="flex justify-between items-start mb-4">
            <span className="text-slate-500 dark:text-slate-400 text-xs font-bold uppercase tracking-wider">Active Outages</span>
            <div className={`p-2 rounded-xl border ${stats?.failed_services > 0 ? 'bg-brand-rose/20 text-brand-rose border-brand-rose/30' : 'bg-slate-100 dark:bg-slate-800 text-slate-400 border-slate-200 dark:border-slate-700'}`}>
              <AlertTriangle size={18} />
            </div>
          </div>
          <h3 className={`text-3xl font-extrabold ${stats?.failed_services > 0 ? 'text-brand-rose' : 'text-slate-855 dark:text-white'}`}>{stats?.failed_services || 0}</h3>
          <p className="text-[10px] text-slate-400 dark:text-slate-500 font-medium mt-1">Incident alerts triggered</p>
        </div>

        {/* Average Response Time */}
        <div className="glass-card bg-white/80 dark:bg-dark-900/60 p-6 rounded-2xl border border-slate-200 dark:border-slate-800/80 relative overflow-hidden group shadow-sm transition-all duration-300 hover:shadow-md hover:-translate-y-0.5">
          <div className="flex justify-between items-start mb-4">
            <span className="text-slate-500 dark:text-slate-400 text-xs font-bold uppercase tracking-wider">Avg Latency</span>
            <div className="p-2 bg-brand-cyan/10 text-brand-cyan rounded-xl border border-brand-cyan/20">
              <Clock size={18} />
            </div>
          </div>
          <h3 className="text-3xl font-extrabold text-brand-cyan">{stats?.avg_response_time_ms || 0}<span className="text-xs font-semibold text-slate-400 ml-1">ms</span></h3>
          <p className="text-[10px] text-slate-400 dark:text-slate-500 font-medium mt-1">Average response time</p>
        </div>

        {/* Success checking rate */}
        <div className="glass-card bg-white/80 dark:bg-dark-900/60 p-6 rounded-2xl border border-slate-200 dark:border-slate-800/80 relative overflow-hidden group shadow-sm transition-all duration-300 hover:shadow-md hover:-translate-y-0.5">
          <div className="flex justify-between items-start mb-4">
            <span className="text-slate-500 dark:text-slate-400 text-xs font-bold uppercase tracking-wider">Success Rate</span>
            <div className="p-2 bg-brand-purple/10 text-brand-purple rounded-xl border border-brand-purple/20">
              <Activity size={18} />
            </div>
          </div>
          <h3 className="text-3xl font-extrabold text-brand-purple">{stats?.success_rate_pct || 100}<span className="text-xs font-semibold text-slate-400 ml-1">%</span></h3>
          <p className="text-[10px] text-slate-400 dark:text-slate-500 font-medium mt-1">Checks success last 24h</p>
        </div>
      </div>

      {/* Section 2: Platform Balances Grid (Runlayer style cards with gradients/glass effects) */}
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-4">
          <Sparkles size={16} className="text-brand-cyan" />
          <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">API Platforms Connection Status</h3>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6">
          {platforms.map((platform) => {
            const platformStats = getServiceStats(platform.id);
            return (
              <div 
                key={platform.id}
                className="glass-card bg-white/85 dark:bg-dark-900/40 p-5 rounded-2xl border border-slate-200 dark:border-slate-800/80 hover:border-brand-indigo/35 hover:shadow-glass-hover hover:-translate-y-1 transition-all duration-300 shadow-sm flex flex-col justify-between h-[155px]"
              >
                <div>
                  <div className="flex justify-between items-start">
                    <strong className="text-slate-800 dark:text-white font-bold font-sans text-sm leading-tight">
                      {platform.name}
                    </strong>
                    <span className={`px-2 py-0.5 text-[9px] font-bold rounded-lg border uppercase tracking-wider ${
                      platformStats.status === 'active'
                        ? 'bg-brand-emerald/10 border-brand-emerald/20 text-brand-emerald'
                        : platformStats.status === 'inactive'
                        ? 'bg-brand-rose/10 border-brand-rose/20 text-brand-rose'
                        : 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-500'
                    }`}>
                      {platformStats.status === 'active' ? 'Active' : platformStats.status === 'inactive' ? 'Inactive' : 'None'}
                    </span>
                  </div>
                  <span className="text-[10px] text-slate-400 font-semibold block mt-1">
                    {platformStats.count} Key{platformStats.count !== 1 ? 's' : ''} monitored
                  </span>
                </div>

                <div className="pt-4 border-t border-slate-100 dark:border-slate-800/40">
                  <span className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block">Remaining Balance</span>
                  <strong className="text-xl font-extrabold text-slate-850 dark:text-white font-mono mt-0.5 block">
                    ${platformStats.balance.toFixed(2)}
                  </strong>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Section 3: Charts & Alert Feeds */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* comparative chart panel */}
        <div className="lg:col-span-2 glass-panel bg-white dark:bg-dark-900/60 p-6 rounded-2xl h-[380px] border border-slate-200 dark:border-slate-800/80 flex flex-col shadow-sm">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-sm font-bold text-slate-800 dark:text-white uppercase tracking-wider font-sans">
              Services Uptime Rollings (%)
            </h3>
            <span className="text-[9px] px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 font-bold uppercase border border-slate-200 dark:border-slate-700">
              Live checks status
            </span>
          </div>
          <div className="flex-1 min-h-0 relative">
            {services.length > 0 ? (
              <Bar data={chartData} options={chartOptions} />
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center text-slate-500">
                <Globe size={32} className="stroke-1 mb-2 text-slate-400" />
                <span className="text-sm font-sans">No health checking URLs configured.</span>
              </div>
            )}
          </div>
        </div>

        {/* Incident Alerts Panel */}
        <div className="glass-panel bg-white dark:bg-dark-900/60 p-6 rounded-2xl h-[380px] border border-slate-200 dark:border-slate-800/80 flex flex-col overflow-hidden shadow-sm">
          <div className="flex justify-between items-center mb-4 pb-3 border-b border-slate-200 dark:border-slate-800/80">
            <h3 className="text-sm font-bold text-slate-800 dark:text-white uppercase tracking-wider flex items-center gap-2">
              <ShieldAlert size={16} className="text-brand-rose" />
              <span>Outages Alert Feed</span>
            </h3>
            <span className="text-[10px] font-bold bg-brand-rose/25 text-brand-rose border border-brand-rose/30 px-2 py-0.5 rounded-full uppercase shadow-sm">
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
                      ? 'bg-brand-rose/5 border-brand-rose/25 text-slate-600 dark:text-slate-300' 
                      : 'bg-amber-500/5 border-amber-500/25 text-slate-655 dark:text-slate-300'
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
              <div className="h-full flex flex-col items-center justify-center text-slate-400 dark:text-slate-500 pb-8">
                <CheckCircle2 size={36} className="text-brand-emerald stroke-1 mb-2 animate-bounce" />
                <span className="text-xs font-semibold text-slate-700 dark:text-slate-400">All systems operational!</span>
                <span className="text-[10px] text-slate-400 dark:text-slate-650 mt-0.5">No active downtime alerts.</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Section 4: Audit Logs */}
      <div className="glass-panel bg-white dark:bg-dark-900/60 p-6 rounded-2xl mt-6 border border-slate-200 dark:border-slate-800/80 shadow-sm">
        <h3 className="text-sm font-bold text-slate-800 dark:text-white uppercase tracking-wider mb-4 pb-3 border-b border-slate-200 dark:border-slate-800/80 font-sans">
          Recent Administrative Audit Log
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse font-sans">
            <thead>
              <tr className="text-slate-450 dark:text-slate-500 border-b border-slate-200 dark:border-slate-800 font-semibold uppercase tracking-wider">
                <th className="py-2.5">Action Event</th>
                <th className="py-2.5">Details</th>
                <th className="py-2.5">Client IP</th>
                <th className="py-2.5 text-right">Timestamp (IST)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-medium text-slate-600 dark:text-slate-300">
              {activities.map((act, index) => (
                <tr key={index} className="hover:bg-slate-100/50 dark:hover:bg-slate-850/20 transition-colors">
                  <td className="py-3">
                    <span className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700/80 rounded-md font-mono text-[10px]">
                      {act.action}
                    </span>
                  </td>
                  <td className="py-3 text-slate-500 dark:text-slate-400 font-sans">{act.details}</td>
                  <td className="py-3 font-mono text-slate-400 dark:text-slate-500">{act.ip_address}</td>
                  <td className="py-3 text-right text-slate-400 dark:text-slate-500 font-mono">
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
