import React, { useState, useEffect } from 'react';
import { 
  Globe, Search, Plus, RefreshCw, Trash2, ToggleLeft, ToggleRight, 
  X, AlertCircle, CheckCircle2, ChevronRight, Activity, Loader2, Sparkles, Server, Zap
} from 'lucide-react';

export default function HealthManager({ token }) {
  const [urls, setUrls] = useState([]);
  const [discovered, setDiscovered] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [activeTab, setActiveTab] = useState('monitored'); // 'monitored' or 'discovered'
  
  // Add URL states
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [formError, setFormError] = useState('');
  const [formLoading, setFormLoading] = useState(false);
  
  // Custom Render triggering state
  const [triggeringAll, setTriggeringAll] = useState(false);
  const [triggerResults, setTriggerResults] = useState(null);
  
  // Card latency data cache for sparklines
  const [sparklines, setSparklines] = useState({});
  const [checkingId, setCheckingId] = useState(null);

  const fetchHealthData = async () => {
    try {
      if (activeTab === 'monitored') {
        setLoading(true);
        const response = await fetch('/api/health', {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await response.json();
        // Separate generic from render targets if necessary, but returning everything is extremely comprehensive!
        // To highlight Method 3, we show a clean Render source indicator on each card.
        setUrls(data);
        
        // Fetch histories for enabled URLs concurrently to hydrate sparklines
        const enabledUrls = data.filter(u => u.is_enabled);
        const historyPromises = enabledUrls.map(async (u) => {
          try {
            const hRes = await fetch(`/api/health/${u.id}/history?limit=15`, {
              headers: { 'Authorization': `Bearer ${token}` }
            });
            const hData = await hRes.json();
            return { id: u.id, points: hData.map(p => p.response_time_ms) };
          } catch (e) {
            return { id: u.id, points: [] };
          }
        });
        
        const histories = await Promise.all(historyPromises);
        const sparkMap = {};
        histories.forEach(h => {
          sparkMap[h.id] = h.points;
        });
        setSparklines(sparkMap);
      } else {
        setLoading(true);
        const response = await fetch('/api/health?discovered_only=true', {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await response.json();
        setDiscovered(data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHealthData();
  }, [token, activeTab]);

  const handleAddUrl = async (e) => {
    e.preventDefault();
    setFormError('');
    setFormLoading(true);

    try {
      const response = await fetch('/api/health', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ name, url, is_enabled: true })
      });

      const res = await response.json();
      if (!response.ok) {
        throw new Error(res.detail || 'Failed to add URL.');
      }

      setShowAddModal(false);
      setName('');
      setUrl('');
      fetchHealthData();
    } catch (err) {
      setFormError(err.message);
    } finally {
      setFormLoading(false);
    }
  };

  const handleToggleEnabled = async (urlId, currentEnabled) => {
    try {
      const response = await fetch(`/api/health/${urlId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ is_enabled: !currentEnabled })
      });
      if (response.ok) {
        fetchHealthData();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleDeleteUrl = async (urlId) => {
    if (!window.confirm("Are you sure you want to remove this URL target and delete all monitoring history?")) return;
    try {
      const response = await fetch(`/api/health/${urlId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        fetchHealthData();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleManualCheck = async (urlId) => {
    try {
      setCheckingId(urlId);
      const response = await fetch(`/api/health/${urlId}/check`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        fetchHealthData();
      }
    } catch (e) {
      console.error(e);
    } finally {
      setCheckingId(null);
    }
  };

  const handleActivateDiscovered = async (disTarget) => {
    try {
      const response = await fetch('/api/health', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          name: disTarget.name,
          url: disTarget.url,
          is_enabled: true
        })
      });
      if (response.ok) {
        alert(`Discovered URL '${disTarget.name}' has been successfully activated for periodic checks!`);
        setActiveTab('monitored');
      }
    } catch (e) {
      console.error(e);
      alert("Failed to activate target.");
    }
  };

  // TRIGGER ALL KEEP WARM LINKS
  const handleTriggerAllKeepWarm = async () => {
    setTriggeringAll(true);
    setTriggerResults(null);
    try {
      const response = await fetch('/api/health/render/trigger', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      setTriggerResults(data);
      fetchHealthData();
    } catch (e) {
      console.error(e);
      alert("Failed to trigger keep-warm pings.");
    } finally {
      setTriggeringAll(false);
    }
  };

  const renderSparkline = (latencies) => {
    if (!latencies || latencies.length <= 1) {
      return (
        <span className="text-[10px] text-slate-600 font-mono tracking-wider font-semibold">
          1x check
        </span>
      );
    }

    const max = Math.max(...latencies) || 1;
    const min = Math.min(...latencies) || 0;
    const range = max - min || 1;
    
    const width = 120;
    const height = 24;
    const padding = 2;
    
    const points = latencies.map((val, idx) => {
      const x = (idx / (latencies.length - 1)) * (width - padding * 2) + padding;
      const y = height - ((val - min) / range) * (height - padding * 2) - padding;
      return `${x},${y}`;
    }).join(' ');

    return (
      <svg width={width} height={height} className="overflow-visible">
        <polyline
          fill="none"
          stroke="#9D4EDD"
          strokeWidth="1.5"
          points={points}
          className="transition-all duration-300"
        />
      </svg>
    );
  };

  // Filter only Render source targets to explicitly showcase Block 3
  const renderUrls = urls.filter(u => u.discovered_from === 'render' || u.url.includes('onrender.com'));
  const genericUrls = urls.filter(u => u.discovered_from !== 'render' && !u.url.includes('onrender.com'));

  return (
    <div className="flex-1 overflow-y-auto bg-[#080B11] p-8">
      {/* Title */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-white">
            Block 3: Render Link Triggering System
          </h2>
          <p className="text-slate-400 text-sm mt-1.5">
            Auto-ping and trigger health checks on scraped Render deployment services every 5 minutes to prevent free tier containers from sleeping.
          </p>
        </div>

        {activeTab === 'monitored' && (
          <div className="flex gap-3">
            <button
              onClick={handleTriggerAllKeepWarm}
              disabled={triggeringAll || renderUrls.filter(u => u.is_enabled).length === 0}
              className="flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-brand-indigo to-brand-purple hover:from-brand-indigo/90 hover:to-brand-purple/90 disabled:opacity-50 text-white rounded-xl text-xs font-bold shadow-lg hover:shadow-brand-indigo/10 transition-all group"
            >
              {triggeringAll ? <Loader2 size={14} className="animate-spin" /> : <Zap size={14} className="group-hover:scale-110 transition-all text-brand-gold" />}
              <span>Trigger Keep-Warm Now</span>
            </button>
            <button
              onClick={() => setShowAddModal(true)}
              className="flex items-center gap-1.5 px-4 py-2 bg-dark-800 hover:bg-slate-800 text-slate-350 border border-slate-800 rounded-xl text-xs font-bold transition-all"
            >
              <Plus size={14} />
              <span>Add Custom Link</span>
            </button>
          </div>
        )}
      </div>

      {/* RENDER INFORMATIVE ALERT BANNER */}
      <div className="mb-8 p-4 bg-brand-indigo/5 border border-brand-indigo/25 text-slate-300 text-xs rounded-2xl flex items-start gap-4 shadow-sm relative overflow-hidden">
        <div className="absolute top-0 right-0 w-24 h-24 bg-brand-indigo/5 rounded-full blur-[30px]" />
        <Zap size={22} className="shrink-0 mt-0.5 text-brand-gold animate-pulse" />
        <div className="space-y-1">
          <strong className="font-bold text-white text-sm block">How the Keep-Warm Trigger System works:</strong>
          <p className="leading-relaxed text-slate-400">
            Render free-tier applications automatically spin down (sleep) after 15 minutes of inactivity. Our keep-warm triggering engine bypasses this seamlessly by automatically executing concurrent HTTP get checks on all enabled service links **every 5 minutes**. Pinging them continuously keeps containers warm and guarantees **100% active online availability** forever!
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-800 mb-8 gap-2">
        <button
          onClick={() => setActiveTab('monitored')}
          className={`px-5 py-3 font-semibold text-sm transition-all border-b-2 flex items-center gap-2 ${
            activeTab === 'monitored'
              ? 'border-brand-indigo text-white bg-slate-800/10'
              : 'border-transparent text-slate-500 hover:text-slate-300'
          }`}
        >
          <Globe size={16} />
          <span>Active Keep-Warm Links ({renderUrls.filter(u => u.is_enabled).length})</span>
        </button>
        <button
          onClick={() => setActiveTab('discovered')}
          className={`px-5 py-3 font-semibold text-sm transition-all border-b-2 flex items-center gap-2 ${
            activeTab === 'discovered'
              ? 'border-brand-indigo text-white bg-slate-800/10'
              : 'border-transparent text-slate-500 hover:text-slate-300'
          }`}
        >
          <Sparkles size={16} className="text-brand-purple" />
          <span>Render Discovered Links ({discovered.length})</span>
        </button>
      </div>

      {/* Success logs trigger results bar */}
      {triggerResults && (
        <div className="mb-6 p-4 bg-brand-emerald/10 border border-brand-emerald/25 text-slate-300 text-xs rounded-xl flex flex-col gap-2">
          <span className="font-bold text-white flex items-center gap-1.5">
            <CheckCircle2 size={14} className="text-brand-emerald" />
            <span>{triggerResults.message}</span>
          </span>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mt-1">
            {triggerResults.results?.map((r, rIdx) => (
              <div key={rIdx} className="bg-dark-900/60 p-2 rounded-lg border border-slate-800 flex justify-between font-mono text-[10px]">
                <span className="text-slate-400 truncate max-w-[120px]">{r.name}</span>
                <span className="text-brand-cyan">{r.latency_ms?.toFixed(0)} ms</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Main Content Area */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 text-slate-500">
          <Loader2 size={32} className="animate-spin text-brand-indigo mb-3" />
          <span>Loading keep-warm trigger registries...</span>
        </div>
      ) : activeTab === 'monitored' ? (
        renderUrls.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {renderUrls.map((u) => {
              const latencies = sparklines[u.id] || [];
              const isChecking = checkingId === u.id;
              
              return (
                <div key={u.id} className="glass-panel p-6 rounded-2xl relative border border-slate-800/80 hover:border-slate-700/60 transition-all duration-300 flex flex-col justify-between min-h-[220px]">
                  <div>
                    {/* Header */}
                    <div className="flex justify-between items-start mb-3">
                      <div className="flex items-center gap-2.5 min-w-0">
                        {u.status === 'up' ? (
                          <span className="w-2.5 h-2.5 rounded-full bg-brand-emerald pulse-green shrink-0" />
                        ) : u.status === 'down' ? (
                          <span className="w-2.5 h-2.5 rounded-full bg-brand-rose pulse-red shrink-0" />
                        ) : (
                          <span className="w-2.5 h-2.5 rounded-full bg-slate-500 shrink-0" />
                        )}
                        <div className="min-w-0">
                          <h4 className="font-bold text-white text-sm tracking-wide font-sans truncate">
                            {u.name}
                          </h4>
                          <span className="text-[10px] font-bold text-slate-500 truncate block mt-0.5 lowercase tracking-wider">
                            URL: <a href={u.url} target="_blank" className="text-brand-cyan hover:underline">{u.url}</a>
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1 shrink-0 ml-2">
                        <button
                          onClick={() => handleManualCheck(u.id)}
                          disabled={isChecking || !u.is_enabled}
                          className="p-1.5 bg-dark-800 hover:bg-slate-800 disabled:opacity-50 text-slate-400 hover:text-white border border-slate-800 rounded-lg transition-all"
                          title="Trigger check manually"
                        >
                          <RefreshCw size={11} className={isChecking ? 'animate-spin text-brand-cyan' : ''} />
                        </button>
                        <button
                          onClick={() => handleToggleEnabled(u.id, u.is_enabled)}
                          className="text-slate-400 hover:text-white transition-all"
                          title={u.is_enabled ? 'Disable trigger loop' : 'Enable trigger loop'}
                        >
                          {u.is_enabled ? (
                            <ToggleRight size={22} className="text-brand-emerald" />
                          ) : (
                            <ToggleLeft size={22} className="text-slate-600" />
                          )}
                        </button>
                        <button
                          onClick={() => handleDeleteUrl(u.id)}
                          className="p-1.5 bg-dark-800 hover:bg-brand-rose/25 text-slate-500 hover:text-brand-rose border border-slate-800 rounded-lg transition-all"
                        >
                          <Trash2 size={11} />
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Body Content */}
                  <div className="bg-[#0E1524]/60 border border-slate-800/40 rounded-xl p-4 my-4 flex items-center justify-between">
                    <div>
                      <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider block">Keep-Warm uptime</span>
                      <strong className={`text-base font-extrabold block mt-0.5 ${u.uptime_percentage > 99 ? 'text-brand-emerald' : u.uptime_percentage > 95 ? 'text-amber-400' : 'text-brand-rose'}`}>
                        {u.uptime_percentage.toFixed(1)}%
                      </strong>
                    </div>

                    <div>
                      <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider block">Trigger Latency</span>
                      <strong className="text-base font-extrabold text-white block mt-0.5 font-mono">
                        {u.response_time_ms ? `${u.response_time_ms.toFixed(0)} ms` : 'N/A'}
                      </strong>
                    </div>
                  </div>

                  {/* Latency Sparkline SVG and Sync timestamp footer */}
                  <div className="flex justify-between items-center mt-2 pt-2 border-t border-slate-800/60 text-[10px] text-slate-500 font-semibold">
                    <span className="flex items-center gap-1 font-mono">
                      <Zap size={10} className="text-brand-gold" />
                      <span>Last: {u.last_check_time ? new Date(u.last_check_time).toLocaleTimeString() : 'N/A'}</span>
                    </span>
                    
                    <div className="flex items-center gap-2">
                      {u.is_enabled && renderSparkline(latencies)}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="glass-panel p-12 rounded-2xl flex flex-col items-center justify-center text-slate-500">
            <Globe size={48} className="stroke-1 text-slate-600 mb-3 animate-pulse" />
            <h4 className="text-sm font-bold text-white mb-1">No Render keep-warm triggers active</h4>
            <p className="text-xs text-slate-500 text-center max-w-xs leading-normal">
              Automated triggering keeps containers active every 5 minutes. Go to Auto-Discovered URLs tab to add your scraped services.
            </p>
          </div>
        )
      ) : (
        /* Discovered List View */
        discovered.length > 0 ? (
          <div className="glass-panel rounded-2xl overflow-hidden border border-slate-800">
            <div className="p-4 bg-dark-800/40 border-b border-slate-800 flex items-center justify-between">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                <Server size={14} className="text-brand-purple" />
                <span>Auto-Discovered Render link triggers</span>
              </span>
              <span className="text-[10px] font-mono bg-brand-purple/20 text-brand-purple border border-brand-purple/20 px-2 py-0.5 rounded">
                Found {discovered.length} links
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="text-slate-500 border-b border-slate-800 font-semibold uppercase tracking-wider">
                    <th className="p-4">Service Name</th>
                    <th className="p-4">Target Link</th>
                    <th className="p-4">Platform Origin</th>
                    <th className="p-4">Scraped console Status</th>
                    <th className="p-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-medium text-slate-300">
                  {discovered.map((dis) => (
                    <tr key={dis.id} className="hover:bg-slate-850/30">
                      <td className="p-4 font-semibold text-white">{dis.name}</td>
                      <td className="p-4 font-mono text-brand-cyan">
                        <a href={dis.url} target="_blank" className="hover:underline">{dis.url}</a>
                      </td>
                      <td className="p-4 text-slate-500">Render Account (Playwright)</td>
                      <td className="p-4">
                        <span className={`px-2 py-0.5 text-[10px] font-bold rounded-md border uppercase tracking-wider ${
                          dis.render_status?.toLowerCase() === 'live'
                            ? 'bg-brand-emerald/10 border-brand-emerald/20 text-brand-emerald'
                            : 'bg-amber-500/10 border-amber-500/20 text-amber-500'
                        }`}>
                          {dis.render_status || 'Unknown'}
                        </span>
                      </td>
                      <td className="p-4 text-right">
                        <button
                          onClick={() => handleActivateDiscovered(dis)}
                          className="px-3.5 py-1.5 bg-gradient-to-r from-brand-indigo to-brand-purple hover:from-brand-indigo/90 hover:to-brand-purple/90 text-white rounded-lg text-[10px] font-bold shadow-md transition-all flex items-center gap-1 ml-auto"
                        >
                          <Plus size={11} />
                          <span>Monitor URL</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="glass-panel p-12 rounded-2xl flex flex-col items-center justify-center text-slate-500">
            <Sparkles size={48} className="stroke-1 text-slate-600 mb-3 animate-pulse" />
            <h4 className="text-sm font-bold text-white mb-1">No discovered URLs registered</h4>
            <p className="text-xs text-slate-500 text-center max-w-xs leading-normal">
              When the automated Playwright Render scraper successfully executes, it reads active service URLs and adds them here.
            </p>
          </div>
        )
      )}

      {/* Add URL Modal Form overlay */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-dark-900/80 backdrop-blur-sm">
          <div className="w-full max-w-lg glass-panel p-8 rounded-2xl shadow-glass relative border border-slate-800">
            <button
              onClick={() => setShowAddModal(false)}
              className="absolute right-4 top-4 p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-all"
            >
              <X size={16} />
            </button>

            <div className="flex items-center gap-3 mb-6">
              <div className="p-2.5 bg-brand-indigo/10 text-brand-indigo rounded-xl border border-brand-indigo/20">
                <Globe size={18} />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">Add URL Health Monitor</h3>
                <p className="text-xs text-slate-400">Add a web service URL to enable periodic checking polls.</p>
              </div>
            </div>

            {formError && (
              <div className="mb-4 p-3 bg-brand-rose/10 border border-brand-rose/25 text-brand-rose text-xs rounded-lg flex items-center gap-2">
                <AlertCircle size={14} className="shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleAddUrl} className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                  Service Name / Label
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Algonox API Gateway"
                  className="w-full bg-[#0E1524]/60 border border-slate-800 rounded-lg py-2 px-3 text-xs text-white placeholder-slate-655 focus:outline-none focus:border-brand-indigo"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                  Target Service Endpoint URL Address
                </label>
                <input
                  type="url"
                  required
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="e.g. https://api.algonox.com/v1/health"
                  className="w-full bg-[#0E1524]/60 border border-slate-800 rounded-lg py-2 px-3 text-xs text-white placeholder-slate-655 focus:outline-none focus:border-brand-indigo font-mono"
                />
              </div>

              <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-slate-800/80">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 bg-dark-800 hover:bg-slate-800 text-slate-300 rounded-lg text-xs font-semibold transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={formLoading}
                  className="px-5 py-2 bg-gradient-to-r from-brand-indigo to-brand-purple hover:from-brand-indigo/90 hover:to-brand-purple/90 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-lg transition-all"
                >
                  {formLoading && <Loader2 size={12} className="animate-spin" />}
                  <span>Save URL Check Target</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
