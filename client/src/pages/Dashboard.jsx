import React, { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import io from 'socket.io-client';
import { ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, Legend } from 'recharts';
import { Activity, ShieldCheck, ShieldAlert, Database, HelpCircle, HardDrive, RefreshCw } from 'lucide-react';

const COLORS = ['#6366f1', '#06b6d4', '#10b981', '#f59e0b', '#f43f5e', '#a855f7', '#64748b'];

function Dashboard() {
  const [liveProgress, setLiveProgress] = useState(null);
  const [liveStats, setLiveStats] = useState(null);
  const [socketError, setSocketError] = useState(null);

  // Fetch static stats (default when no active upload is processing)
  const { data: dbStats, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['stats'],
    queryFn: async () => {
      const res = await axios.get('/api/stats');
      return res.data;
    }
  });

  // Socket connection for live progress updates
  useEffect(() => {
    // Connect to Socket.IO proxy
    const socket = io('/', { path: '/socket.io' });

    socket.on('connect', () => {
      console.log('Socket connected for live updates');
      setSocketError(null);
    });

    socket.on('pcap:progress', (data) => {
      console.log('pcap progress:', data);
      setLiveProgress(data.progress);
      setLiveStats(data.stats);
    });

    socket.on('pcap:done', (data) => {
      console.log('pcap done:', data);
      setLiveProgress(null);
      setLiveStats(null);
      refetch();
    });

    socket.on('pcap:error', (data) => {
      console.error('pcap error:', data);
      setSocketError(data.error);
      setLiveProgress(null);
    });

    return () => {
      socket.disconnect();
    };
  }, [refetch]);

  const stats = liveStats || dbStats;

  // Formatting utility
  const formatBytes = (bytes) => {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] gap-4">
        <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-slate-400 font-mono text-sm">Aggregating telemetry data...</p>
      </div>
    );
  }

  // Pre-process charts data
  const protocolData = stats ? [
    { name: 'TCP', value: stats.tcpPackets || 0 },
    { name: 'UDP', value: stats.udpPackets || 0 },
    { name: 'Other', value: stats.otherPackets || 0 }
  ].filter(p => p.value > 0) : [];

  const appData = stats && stats.appDistribution ? Object.entries(stats.appDistribution)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 7) : [];

  return (
    <div className="space-y-8">
      {/* Real-time parsing HUD */}
      {liveProgress !== null && (
        <div className="glass-panel p-6 rounded-xl border border-indigo-500/30 glow-indigo pulse-border space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-3 h-3 rounded-full bg-indigo-500 animate-ping"></div>
              <h2 className="text-lg font-bold text-slate-200">Analyzing Uploaded PCAP...</h2>
            </div>
            <span className="font-mono text-indigo-400 font-bold text-lg">{liveProgress}%</span>
          </div>
          
          <div className="w-full bg-slate-900 rounded-full h-3 overflow-hidden border border-borderBg">
            <div 
              className="bg-gradient-to-r from-indigo-500 to-cyan-500 h-full transition-all duration-300 ease-out rounded-full" 
              style={{ width: `${liveProgress}%` }}
            ></div>
          </div>
          
          <p className="text-xs text-slate-400 font-mono">
            Worker Thread #1 is parsing network layers and inspecting client handshakes in real time...
          </p>
        </div>
      )}

      {socketError && (
        <div className="glass-panel p-4 rounded-xl border border-rose-500/20 bg-rose-500/10 text-rose-300 text-sm flex gap-3 items-center">
          <ShieldAlert size={18} />
          <span>Error parsing PCAP: {socketError}</span>
        </div>
      )}

      {/* Header and Refresh */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-white tracking-tight">Security & Protocol Dashboard</h2>
          <p className="text-slate-400 text-sm">Real-time deep packet inspection metrics and bandwidth statistics</p>
        </div>
        <button
          onClick={() => refetch()}
          disabled={isRefetching || liveProgress !== null}
          className="flex items-center gap-2 px-4 py-2 bg-slate-900/80 border border-borderBg rounded-lg text-sm text-slate-300 hover:bg-slate-800 transition disabled:opacity-40"
        >
          <RefreshCw size={16} className={isRefetching ? 'animate-spin' : ''} />
          {isRefetching ? 'Reloading...' : 'Sync Stats'}
        </button>
      </div>

      {/* Numerical Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {/* Total Packets */}
        <div className="glass-panel p-6 rounded-xl flex items-center justify-between shadow-glow">
          <div className="space-y-1">
            <span className="text-xs font-mono uppercase text-slate-400">Total Packets</span>
            <div className="text-2xl font-bold text-white font-mono">{stats?.totalPackets?.toLocaleString() || 0}</div>
          </div>
          <div className="p-3 bg-indigo-500/10 text-indigo-400 rounded-lg">
            <Activity size={24} />
          </div>
        </div>

        {/* Total Bytes */}
        <div className="glass-panel p-6 rounded-xl flex items-center justify-between shadow-glow">
          <div className="space-y-1">
            <span className="text-xs font-mono uppercase text-slate-400">Data Analyzed</span>
            <div className="text-2xl font-bold text-white font-mono">{formatBytes(stats?.totalBytes)}</div>
          </div>
          <div className="p-3 bg-cyan-500/10 text-cyan-400 rounded-lg">
            <HardDrive size={24} />
          </div>
        </div>

        {/* Forwarded */}
        <div className="glass-panel p-6 rounded-xl flex items-center justify-between shadow-glowEmerald">
          <div className="space-y-1">
            <span className="text-xs font-mono uppercase text-slate-400">Forwarded</span>
            <div className="text-2xl font-bold text-emerald-400 font-mono">
              {stats?.forwardedPackets?.toLocaleString() || 0}
            </div>
          </div>
          <div className="p-3 bg-emerald-500/10 text-emerald-400 rounded-lg">
            <ShieldCheck size={24} />
          </div>
        </div>

        {/* Dropped / Blocked */}
        <div className="glass-panel p-6 rounded-xl flex items-center justify-between shadow-glowRose">
          <div className="space-y-1">
            <span className="text-xs font-mono uppercase text-slate-400">Blocked (Dropped)</span>
            <div className="text-2xl font-bold text-rose-500 font-mono">
              {stats?.droppedPackets?.toLocaleString() || 0}
            </div>
          </div>
          <div className="p-3 bg-rose-500/10 text-rose-500 rounded-lg">
            <ShieldAlert size={24} />
          </div>
        </div>
      </div>

      {/* Visual Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Protocol Composition (Pie Chart) */}
        <div className="glass-panel p-6 rounded-xl space-y-4">
          <div>
            <h3 className="font-bold text-slate-200">Protocol Composition</h3>
            <p className="text-xs text-slate-400">Share of TCP, UDP, and non-L4 transport packets</p>
          </div>
          <div className="h-64 flex justify-center items-center">
            {protocolData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={protocolData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {protocolData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ backgroundColor: 'rgba(10, 11, 18, 0.95)', borderColor: 'rgba(255,255,255,0.08)' }} 
                    itemStyle={{ color: '#fff' }}
                  />
                  <Legend formatter={(value) => <span className="text-slate-300 font-mono text-xs">{value}</span>} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex flex-col items-center justify-center gap-2 text-slate-500">
                <Database size={32} />
                <span className="text-xs font-mono">No protocol telemetry loaded</span>
              </div>
            )}
          </div>
        </div>

        {/* Top Applications Block (Bar Chart) */}
        <div className="glass-panel p-6 rounded-xl space-y-4">
          <div>
            <h3 className="font-bold text-slate-200">Application Classification</h3>
            <p className="text-xs text-slate-400">Classified apps detected via Client Hello SNI / HTTP Host headers</p>
          </div>
          <div className="h-64 flex justify-center items-center">
            {appData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={appData}>
                  <XAxis dataKey="name" stroke="#94a3b8" fontSize={11} tickLine={false} />
                  <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} />
                  <Tooltip 
                    cursor={{ fill: 'rgba(255, 255, 255, 0.03)' }}
                    contentStyle={{ backgroundColor: 'rgba(10, 11, 18, 0.95)', borderColor: 'rgba(255,255,255,0.08)' }} 
                    itemStyle={{ color: '#fff' }}
                  />
                  <Bar dataKey="value" name="Packet Count" fill="#6366f1" radius={[4, 4, 0, 0]}>
                    {appData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex flex-col items-center justify-center gap-2 text-slate-500">
                <HelpCircle size={32} />
                <span className="text-xs font-mono">No application streams detected</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default Dashboard;
