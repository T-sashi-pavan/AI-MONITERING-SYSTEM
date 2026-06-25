import React, { useState, useEffect } from 'react';
import { 
  KeyRound, Search, Filter, Plus, RefreshCw, Download, 
  Trash2, ToggleLeft, ToggleRight, X, AlertCircle, 
  CheckCircle2, HelpCircle, Loader2, Sparkles, TrendingUp, Calendar, Clock
} from 'lucide-react';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import { formatToISTDateOnly, formatToISTShort } from '../utils/timeUtils';

// Register ChartJS elements
ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend);

export default function KeysManager({ token }) {
  const [keys, setKeys] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  
  // Modals state
  const [showAddModal, setShowAddModal] = useState(false);
  const [serviceName, setServiceName] = useState('Groq');
  const [providerName, setProviderName] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [totalQuota, setTotalQuota] = useState(100.0);
  const [usedQuota, setUsedQuota] = useState(0.0);
  const [customPingUrl, setCustomPingUrl] = useState('');
  const [formError, setFormError] = useState('');
  const [formLoading, setFormLoading] = useState(false);
  
  // Chart Expand state
  const [expandedChartId, setExpandedChartId] = useState(null);
  const [chartRange, setChartRange] = useState('7d'); // '24h' or '7d'
  
  // Sync state
  const [syncingId, setSyncingId] = useState(null);

  const fetchKeys = async () => {
    try {
      setLoading(true);
      const url = new URL('/api/keys', window.location.origin);
      if (searchQuery) url.searchParams.append('search', searchQuery);
      if (statusFilter) url.searchParams.append('status_filter', statusFilter);

      const response = await fetch(url, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      setKeys(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchKeys();
  }, [token, searchQuery, statusFilter]);

  const handleAddKey = async (e) => {
    e.preventDefault();
    setFormError('');
    setFormLoading(true);

    try {
      const response = await fetch('/api/keys', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          service_name: serviceName,
          provider_name: providerName,
          api_key: apiKey,
          total_quota: parseFloat(totalQuota),
          used_quota: parseFloat(usedQuota),
          custom_ping_url: serviceName.toLowerCase() === 'generic' ? customPingUrl : null
        })
      });

      const res = await response.json();
      if (!response.ok) {
        throw new Error(res.detail || 'Failed to add API key.');
      }

      setShowAddModal(false);
      setProviderName('');
      setApiKey('');
      setTotalQuota(100.0);
      setUsedQuota(0.0);
      setCustomPingUrl('');
      
      fetchKeys();
    } catch (err) {
      setFormError(err.message);
    } finally {
      setFormLoading(false);
    }
  };

  const handleToggleActive = async (keyId, currentEnabled) => {
    try {
      const response = await fetch(`/api/keys/${keyId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ is_enabled: !currentEnabled })
      });
      if (response.ok) {
        fetchKeys();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleDeleteKey = async (keyId) => {
    if (!window.confirm("Are you sure you want to remove this API key from monitoring?")) return;
    try {
      const response = await fetch(`/api/keys/${keyId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        fetchKeys();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleSyncKey = async (keyId) => {
    try {
      setSyncingId(keyId);
      const response = await fetch(`/api/keys/${keyId}/sync`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        fetchKeys();
      }
    } catch (e) {
      console.error(e);
    } finally {
      setSyncingId(null);
    }
  };

  const handleExport = (format) => {
    const exportUrl = `/api/keys/export/${format}`;
    const link = document.createElement('a');
    link.href = exportUrl;
    link.download = `api_monitoring_keys.${format}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Helper to compile Line Chart data in IST
  const renderTrendChart = (keyObj) => {
    const is24h = chartRange === '24h';
    let logs = [];
    
    if (is24h) {
      logs = (keyObj.hourly_usage_logs || []).slice(-24);
    } else {
      const fullDaily = keyObj.daily_usage_logs || [];
      const daysToTake = chartRange === '7d' ? 7 : chartRange === '30d' ? 30 : 90;
      logs = fullDaily.slice(-daysToTake);
    }
    
    if (logs.length === 0) {
      return (
        <div className="py-8 text-center text-xs text-slate-500 font-mono">
          No usage logs synced. Perform manual sync first.
        </div>
      );
    }

    const labels = logs.map(l => {
      const date = new Date(l.timestamp);
      // Format as IST hours or IST short date
      return is24h 
        ? date.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hour12: false }) 
        : date.toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', month: 'short', day: 'numeric' });
    });

    const isDarkMode = document.documentElement.classList.contains('dark');

    const data = {
      labels,
      datasets: [
        {
          label: 'API Used Quota ($)',
          data: logs.map(l => l.used),
          borderColor: '#9D4EDD',
          backgroundColor: 'rgba(157, 78, 221, 0.08)',
          borderWidth: 2,
          pointBackgroundColor: '#A855F7',
          tension: 0.3,
          fill: true,
        }
      ]
    };

    const options = {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: isDarkMode ? '#111827' : '#ffffff',
          padding: 8,
          cornerRadius: 6,
          titleFont: { family: 'Outfit', size: 11 },
          bodyFont: { family: 'Outfit', size: 11 }
        }
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: { color: isDarkMode ? '#6B7280' : '#4b5563', font: { family: 'Outfit', size: 9 } }
        },
        y: {
          grid: { color: isDarkMode ? 'rgba(255, 255, 255, 0.03)' : 'rgba(0, 0, 0, 0.03)' },
          ticks: { color: isDarkMode ? '#6B7280' : '#4b5563', font: { family: 'Outfit', size: 9 } }
        }
      }
    };

    return (
      <div className="h-[180px] mt-4 relative">
        <Line data={data} options={options} />
      </div>
    );
  };

  return (
    <div className="flex-1 overflow-y-auto bg-slate-50 dark:bg-[#080B11] p-8 transition-colors duration-300">
      {/* Title & Actions Bar */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-slate-855 dark:text-white font-sans">
            API Keys Registry
          </h2>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-1.5 leading-relaxed">
            Monitor official keys (Groq, OpenAI, Anthropic, Gemini, ElevenLabs) to track real-time quota usage, balances, and daily/hourly trends in **IST**.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => handleExport('csv')}
            className="flex items-center gap-1.5 px-3 py-2 bg-white dark:bg-dark-800 hover:bg-slate-50 dark:hover:bg-slate-850 text-slate-600 dark:text-slate-350 rounded-xl text-xs font-semibold border border-slate-200 dark:border-slate-800 transition-all shadow-sm cursor-pointer"
          >
            <Download size={14} />
            <span>CSV</span>
          </button>
          <button
            onClick={() => handleExport('excel')}
            className="flex items-center gap-1.5 px-3 py-2 bg-white dark:bg-dark-800 hover:bg-slate-50 dark:hover:bg-slate-855 text-slate-600 dark:text-slate-350 rounded-xl text-xs font-semibold border border-slate-200 dark:border-slate-800 transition-all shadow-sm cursor-pointer"
          >
            <Download size={14} />
            <span>Excel</span>
          </button>
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-brand-indigo to-brand-purple hover:from-brand-indigo/90 hover:to-brand-purple/90 text-white rounded-xl text-xs font-bold shadow-lg hover:shadow-brand-indigo/10 transition-all cursor-pointer"
          >
            <Plus size={14} />
            <span>Inject API Key</span>
          </button>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="glass-panel bg-white/80 dark:bg-dark-900/60 p-4 rounded-2xl border border-slate-200 dark:border-slate-800/80 mb-6 flex flex-col md:flex-row gap-4 items-center justify-between shadow-sm">
        <div className="relative w-full md:max-w-md">
          <Search size={16} className="absolute left-3 top-3 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search API keys by platform or provider label..."
            className="w-full bg-slate-50 dark:bg-[#0E1524]/60 border border-slate-200 dark:border-slate-800 rounded-xl py-2 pl-10 pr-4 text-xs text-slate-800 dark:text-white placeholder-slate-400 focus:outline-none focus:border-brand-indigo focus:ring-1 focus:ring-brand-indigo transition-all"
          />
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto">
          <div className="flex items-center gap-2 bg-slate-50 dark:bg-[#0E1524]/60 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-1.5 text-xs text-slate-500 dark:text-slate-450">
            <Filter size={14} />
            <span>Status:</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-transparent text-slate-700 dark:text-white font-semibold focus:outline-none cursor-pointer"
            >
              <option value="">All Statuses</option>
              <option value="active">Active</option>
              <option value="invalid">Invalid</option>
              <option value="unknown">Unknown</option>
            </select>
          </div>
        </div>
      </div>

      {/* Keys Inventory Table */}
      {loading && keys.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-slate-500">
          <Loader2 size={32} className="animate-spin text-brand-indigo mb-3" />
          <span className="font-sans text-xs">Syncing API metrics...</span>
        </div>
      ) : keys.length > 0 ? (
        <div className="glass-panel bg-white/80 dark:bg-dark-900/60 overflow-hidden border border-slate-200 dark:border-slate-800/80 rounded-2xl shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs font-sans">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider bg-slate-100/50 dark:bg-dark-900/40">
                  <th className="p-4">Account Label / Platform</th>
                  <th className="p-4">Masked Key ID</th>
                  <th className="p-4">Status</th>
                  <th className="p-4">Remaining Balance</th>
                  <th className="p-4">Total Quota</th>
                  <th className="p-4">Expires (IST)</th>
                  <th className="p-4">Created At (IST)</th>
                  <th className="p-4">Last Used (IST)</th>
                  <th className="p-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-850 font-medium text-slate-600 dark:text-slate-350">
                {keys.map((k) => {
                  const usage = k.usage_info;
                  const isSyncing = syncingId === k.id;
                  const isChartExpanded = expandedChartId === k.id;
                  
                  return (
                    <React.Fragment key={k.id}>
                      <tr className="hover:bg-slate-100/50 dark:hover:bg-slate-850/20 transition-all duration-150 border-b border-slate-200/50 dark:border-slate-800/40">
                        <td className="p-4">
                          <div className="flex items-center gap-3">
                            <div className="p-2 bg-brand-indigo/10 text-brand-indigo rounded-lg border border-brand-indigo/20">
                              <KeyRound size={14} />
                            </div>
                            <div>
                              <strong className="text-slate-800 dark:text-white text-sm block font-sans leading-tight">{k.provider_name}</strong>
                              <span className="text-[10px] text-slate-400 dark:text-slate-500 font-semibold uppercase tracking-wider">{k.service_name}</span>
                            </div>
                          </div>
                        </td>
                        <td className="p-4 font-mono text-[11px] text-slate-500 dark:text-slate-400 select-all">{k.masked_key}</td>
                        <td className="p-4">
                          <div className="flex items-center gap-1.5">
                            {k.status === 'active' ? (
                              <>
                                <span className="w-2 h-2 rounded-full bg-brand-emerald pulse-green" />
                                <span className="text-brand-emerald text-[11px] font-bold">Active</span>
                              </>
                            ) : k.status === 'invalid' ? (
                              <>
                                <span className="w-2 h-2 rounded-full bg-brand-rose pulse-red" />
                                <span className="text-brand-rose text-[11px] font-bold">Invalid</span>
                              </>
                            ) : (
                              <>
                                <span className="w-2 h-2 rounded-full bg-slate-400" />
                                <span className="text-slate-400 dark:text-slate-500 text-[11px] font-bold">Unknown</span>
                              </>
                            )}
                          </div>
                        </td>
                        <td className="p-4">
                          <strong className="text-sm font-extrabold text-brand-emerald font-mono">${k.balance.toFixed(2)}</strong>
                        </td>
                        <td className="p-4 font-mono text-slate-400 dark:text-slate-500">${usage?.total?.toFixed(0) || '0'}</td>
                        <td className="p-4 text-slate-400 dark:text-slate-550 font-mono">{formatToISTDateOnly(k.expiry_time)}</td>
                        <td className="p-4 text-slate-400 dark:text-slate-550 font-mono">{formatToISTDateOnly(k.created_at_time)}</td>
                        <td className="p-4 text-slate-400 dark:text-slate-550 font-mono truncate max-w-[120px]" title={formatToISTShort(k.last_used_time)}>
                          {formatToISTShort(k.last_used_time)}
                        </td>
                        <td className="p-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => setExpandedChartId(isChartExpanded ? null : k.id)}
                              className={`p-1.5 border rounded-lg text-xs font-semibold flex items-center gap-1 transition-all cursor-pointer ${
                                isChartExpanded 
                                  ? 'bg-brand-indigo/15 text-brand-indigo border-brand-indigo/35' 
                                  : 'bg-white dark:bg-dark-800 border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white'
                              }`}
                              title="Toggle Usage Trends Charts"
                            >
                              <TrendingUp size={12} />
                              <span>Trends</span>
                            </button>
                            <button
                              onClick={() => handleSyncKey(k.id)}
                              disabled={isSyncing}
                              className="p-1.5 bg-white dark:bg-dark-800 border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-850 text-slate-500 dark:text-slate-400 hover:text-slate-850 dark:hover:text-white rounded-lg transition-all cursor-pointer"
                              title="Manual validation sync"
                            >
                              <RefreshCw size={12} className={isSyncing ? 'animate-spin text-brand-cyan' : ''} />
                            </button>
                            <button
                              onClick={() => handleToggleActive(k.id, k.is_enabled)}
                              className="text-slate-400 hover:text-white transition-all cursor-pointer"
                              title={k.is_enabled ? 'Disable Key' : 'Enable Key'}
                            >
                              {k.is_enabled ? (
                                <ToggleRight size={22} className="text-brand-emerald" />
                              ) : (
                                <ToggleLeft size={22} className="text-slate-400 dark:text-slate-600" />
                              )}
                            </button>
                            <button
                              onClick={() => handleDeleteKey(k.id)}
                              className="p-1.5 bg-white dark:bg-dark-800 border border-slate-200 dark:border-slate-800 hover:bg-brand-rose/10 hover:border-brand-rose/20 text-slate-400 dark:text-slate-500 hover:text-brand-rose rounded-lg transition-all cursor-pointer"
                              title="Delete Key"
                            >
                              <Trash2 size={12} />
                            </button>
                          </div>
                        </td>
                      </tr>
                      
                      {/* Sub-row Collapsible Drawer Chart */}
                      {isChartExpanded && (
                        <tr className="bg-slate-100/40 dark:bg-[#0b0f19]/40">
                          <td colSpan={9} className="p-6 border-b border-slate-200 dark:border-slate-800/80">
                            <div className="glass-panel bg-white dark:bg-dark-900/60 p-6 rounded-2xl border border-slate-200/60 dark:border-slate-800/50 shadow-inner">
                              <div className="flex justify-between items-center text-[10px] font-bold mb-4 font-sans">
                                <span className="text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                                  <TrendingUp size={13} className="text-brand-indigo" />
                                  <span>Usage Statistics Timeline ({k.provider_name})</span>
                                </span>
                                
                                <div className="flex bg-slate-100 dark:bg-[#0E1524]/60 border border-slate-200 dark:border-slate-800 rounded-lg p-0.5 overflow-hidden">
                                  {['24h', '7d', '30d', '90d'].map((rangeOption) => (
                                    <button
                                      key={rangeOption}
                                      type="button"
                                      onClick={() => setChartRange(rangeOption)}
                                      className={`px-3 py-1 rounded-md text-[9px] uppercase tracking-wider transition-all font-semibold cursor-pointer ${
                                        chartRange === rangeOption 
                                          ? 'bg-brand-indigo text-white shadow-sm' 
                                          : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                                      }`}
                                    >
                                      {rangeOption === '24h' ? '24 Hrs' : rangeOption === '7d' ? '7 Days' : rangeOption === '30d' ? '30 Days' : '3 Months'}
                                    </button>
                                  ))}
                                </div>
                              </div>
                              
                              {renderTrendChart(k)}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="glass-panel bg-white dark:bg-dark-900/60 p-12 rounded-2xl flex flex-col items-center justify-center border border-slate-200 dark:border-slate-805/80 text-slate-400 dark:text-slate-500 shadow-sm">
          <KeyRound size={48} className="stroke-1 text-slate-300 dark:text-slate-600 mb-3" />
          <h4 className="text-sm font-bold text-slate-800 dark:text-white mb-1 font-sans">No keys registered yet</h4>
          <p className="text-xs text-slate-500 dark:text-slate-450 text-center max-w-xs leading-normal">
            Click "Inject API Key" above to start tracking API balances and usage limits.
          </p>
        </div>
      )}

      {/* Add API Key Modal Form Overlay */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-dark-900/80 backdrop-blur-sm">
          <div className="w-full max-w-lg glass-panel bg-white dark:bg-dark-900 p-8 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl relative">
            <button
              onClick={() => setShowAddModal(false)}
              className="absolute right-4 top-4 p-1.5 text-slate-400 hover:text-slate-800 dark:hover:text-white rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-all cursor-pointer"
            >
              <X size={16} />
            </button>

            <div className="flex items-center gap-3 mb-6">
              <div className="p-2.5 bg-brand-indigo/10 text-brand-indigo rounded-xl border border-brand-indigo/20">
                <Sparkles size={18} className="animate-pulse" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-800 dark:text-white font-sans">Register Official API Key</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">Configure key checks and quota balances.</p>
              </div>
            </div>

            {formError && (
              <div className="mb-4 p-3 bg-brand-rose/10 border border-brand-rose/25 text-brand-rose text-xs rounded-lg flex items-center gap-2 font-sans">
                <AlertCircle size={14} className="shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleAddKey} className="space-y-4 font-sans">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">
                    Platform / Service
                  </label>
                  <select
                    value={serviceName}
                    onChange={(e) => setServiceName(e.target.value)}
                    className="w-full bg-slate-100 dark:bg-[#0E1524]/60 border border-slate-200 dark:border-slate-800 rounded-lg py-2 px-3 text-xs text-slate-800 dark:text-white focus:outline-none focus:border-brand-indigo cursor-pointer font-sans"
                  >
                    <option value="Groq">Groq</option>
                    <option value="OpenAI">OpenAI</option>
                    <option value="Anthropic">Anthropic (Claude)</option>
                    <option value="Gemini">Gemini</option>
                    <option value="ElevenLabs">ElevenLabs</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">
                    Account Label
                  </label>
                  <input
                    type="text"
                    required
                    value={providerName}
                    onChange={(e) => setProviderName(e.target.value)}
                    placeholder="e.g. Production Team"
                    className="w-full bg-slate-100 dark:bg-[#0E1524]/60 border border-slate-200 dark:border-slate-800 rounded-lg py-2 px-3 text-xs text-slate-800 dark:text-white placeholder-slate-400 focus:outline-none focus:border-brand-indigo"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">
                  Secret API Key Token
                </label>
                <input
                  type="password"
                  required
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="e.g. sk-... or gsk_..."
                  className="w-full bg-slate-100 dark:bg-[#0E1524]/60 border border-slate-200 dark:border-slate-800 rounded-lg py-2 px-3 text-xs text-slate-800 dark:text-white placeholder-slate-400 focus:outline-none focus:border-brand-indigo font-mono"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">
                    Total USD Quota Limit
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    value={totalQuota}
                    onChange={(e) => setTotalQuota(e.target.value)}
                    className="w-full bg-slate-100 dark:bg-[#0E1524]/60 border border-slate-200 dark:border-slate-800 rounded-lg py-2 px-3 text-xs text-slate-800 dark:text-white focus:outline-none focus:border-brand-indigo"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">
                    Known Used USD Quota
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    value={usedQuota}
                    onChange={(e) => setUsedQuota(e.target.value)}
                    className="w-full bg-slate-100 dark:bg-[#0E1524]/60 border border-slate-200 dark:border-slate-800 rounded-lg py-2 px-3 text-xs text-slate-800 dark:text-white focus:outline-none focus:border-brand-indigo"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-slate-200 dark:border-slate-800/80">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 bg-slate-100 dark:bg-dark-800 hover:bg-slate-200 dark:hover:bg-slate-850 text-slate-655 dark:text-slate-300 rounded-lg text-xs font-semibold transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={formLoading}
                  className="px-5 py-2 bg-gradient-to-r from-brand-gold to-brand-amber hover:from-brand-gold/90 hover:to-brand-amber/90 text-white rounded-lg text-xs font-extrabold flex items-center gap-1.5 shadow-lg transition-all cursor-pointer"
                >
                  {formLoading && <Loader2 size={12} className="animate-spin" />}
                  <span>Save Key</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
