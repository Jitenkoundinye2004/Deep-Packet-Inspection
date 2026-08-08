import React from 'react';
import { Routes, Route, NavLink } from 'react-router-dom';
import { Activity, ShieldAlert, Cpu, Layers } from 'lucide-react';
import Dashboard from './pages/Dashboard.jsx';
import Packets from './pages/Packets.jsx';
import Rules from './pages/Rules.jsx';

function App() {
  return (
    <div className="flex min-h-screen bg-transparent">
      {/* Sidebar Navigation */}
      <aside className="w-64 glass-panel border-r border-borderBg flex flex-col justify-between shrink-0">
        <div>
          {/* Brand/Logo */}
          <div className="p-6 flex items-center gap-3 border-b border-borderBg">
            <div className="p-2 bg-indigo-600 rounded-lg glow-indigo text-white">
              <Cpu size={24} />
            </div>
            <div>
              <h1 className="font-extrabold text-lg bg-gradient-to-r from-indigo-400 to-cyan-400 bg-clip-text text-transparent">DPI ENGINE</h1>
              <span className="text-[10px] text-slate-400 font-mono tracking-widest uppercase">Deep Packet Inspector</span>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="p-4 space-y-2">
            <NavLink
              to="/"
              className={({ isActive }) =>
                `flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all duration-200 ${
                  isActive
                    ? 'bg-indigo-600/20 text-indigo-400 border-l-4 border-indigo-500 shadow-glow'
                    : 'text-slate-400 hover:bg-slate-800/40 hover:text-slate-200'
                }`
              }
            >
              <Activity size={18} />
              Dashboard
            </NavLink>

            <NavLink
              to="/packets"
              className={({ isActive }) =>
                `flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all duration-200 ${
                  isActive
                    ? 'bg-indigo-600/20 text-indigo-400 border-l-4 border-indigo-500 shadow-glow'
                    : 'text-slate-400 hover:bg-slate-800/40 hover:text-slate-200'
                }`
              }
            >
              <Layers size={18} />
              Packet Inspector
            </NavLink>

            <NavLink
              to="/rules"
              className={({ isActive }) =>
                `flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all duration-200 ${
                  isActive
                    ? 'bg-indigo-600/20 text-indigo-400 border-l-4 border-indigo-500 shadow-glow'
                    : 'text-slate-400 hover:bg-slate-800/40 hover:text-slate-200'
                }`
              }
            >
              <ShieldAlert size={18} />
              Blocking Rules
            </NavLink>
          </nav>
        </div>

        {/* System info footer */}
        <div className="p-4 border-t border-borderBg bg-slate-950/20 text-[11px] text-slate-500 font-mono">
          <p>System State: ONLINE</p>
          <p>Version: 2.0 (MERN)</p>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col min-w-0">
        <header className="h-16 glass-panel border-b border-borderBg flex items-center justify-between px-8 z-10">
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 shadow-glowEmerald animate-pulse"></span>
            <span className="text-xs font-mono text-slate-400">DPI ENGINE ACTIVE</span>
          </div>
          
          <div className="text-xs text-slate-400 bg-slate-900/60 border border-borderBg px-3 py-1 rounded-full font-mono">
            OS: <span className="text-slate-200 font-semibold">Node JS Sandbox</span>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-8">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/packets" element={<Packets />} />
            <Route path="/rules" element={<Rules />} />
          </Routes>
        </div>
      </main>
    </div>
  );
}

export default App;
