import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../utils/api.js';
import { ShieldCheck, ShieldAlert, Plus, Trash2, Globe, Laptop, Server, AlertCircle } from 'lucide-react';

function Rules() {
  const queryClient = useQueryClient();
  const [ruleType, setRuleType] = useState('ip');
  const [ruleValue, setRuleValue] = useState('');
  const [validationError, setValidationError] = useState('');

  // 1. Query Rules List
  const { data: rules, isLoading } = useQuery({
    queryKey: ['rules'],
    queryFn: async () => {
      const res = await api.get('/api/rules');
      return res.data;
    }
  });

  // 2. Add Rule Mutation
  const addMutation = useMutation({
    mutationFn: async (newRule) => {
      const res = await api.post('/api/rules', newRule);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rules'] });
      setRuleValue('');
      setValidationError('');
    },
    onError: (err) => {
      setValidationError(err.response?.data?.error || 'Failed to create blocking rule.');
    }
  });

  // 3. Delete Rule Mutation
  const deleteMutation = useMutation({
    mutationFn: async (id) => {
      const res = await api.delete(`/api/rules/${id}`);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rules'] });
    }
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    setValidationError('');

    const val = ruleValue.trim();
    if (!val) {
      setValidationError('Rule value cannot be empty');
      return;
    }

    // IP Validation
    if (ruleType === 'ip') {
      const ipRegex = /^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$/;
      if (!ipRegex.test(val)) {
        setValidationError('Invalid IPv4 address format (e.g. 192.168.1.100)');
        return;
      }
    }

    // Domain validation
    if (ruleType === 'domain') {
      if (val.length < 3 || !val.includes('.')) {
        setValidationError('Invalid domain format (e.g. netflix.com)');
        return;
      }
    }

    addMutation.mutate({ type: ruleType, value: val });
  };

  const getRuleIcon = (type) => {
    switch (type) {
      case 'ip': return <Server className="text-cyan-400" size={16} />;
      case 'app': return <Laptop className="text-indigo-400" size={16} />;
      case 'domain': return <Globe className="text-emerald-400" size={16} />;
      default: return <Server className="text-slate-400" size={16} />;
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
      
      {/* Column 1: Add Blocking Rule Form */}
      <div className="glass-panel p-6 rounded-xl space-y-6">
        <div>
          <h3 className="text-lg font-bold text-white">Create Blocking Rule</h3>
          <p className="text-xs text-slate-400">Add firewall policies to drop matching flows during PCAP processing</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Rule Type Select */}
          <div className="space-y-1.5">
            <label className="text-xs text-slate-400 font-medium">Policy Type</label>
            <select
              value={ruleType}
              onChange={(e) => {
                setRuleType(e.target.value);
                setRuleValue('');
                setValidationError('');
              }}
              className="w-full px-3 py-2 glass-input rounded-lg text-xs text-slate-200"
            >
              <option value="ip">Block Source IP</option>
              <option value="app">Block Application (DPI Class)</option>
              <option value="domain">Block Domain Name (Substring)</option>
            </select>
          </div>

          {/* Rule Value Input */}
          <div className="space-y-1.5">
            <label className="text-xs text-slate-400 font-medium">Value to Match</label>
            <input
              type="text"
              value={ruleValue}
              onChange={(e) => setRuleValue(e.target.value)}
              placeholder={
                ruleType === 'ip' ? 'e.g. 192.168.1.100' :
                ruleType === 'app' ? 'e.g. YouTube, TikTok, Telegram' :
                'e.g. facebook.com, doubleclick'
              }
              className="w-full px-3 py-2 glass-input rounded-lg text-xs text-slate-200"
            />
          </div>

          {validationError && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-lg text-[11px] flex items-center gap-2">
              <AlertCircle size={14} className="shrink-0" />
              <span>{validationError}</span>
            </div>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            disabled={addMutation.isPending}
            className="w-full flex items-center justify-center gap-2 py-2 bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 disabled:opacity-50 text-white rounded-lg text-xs font-semibold glow-indigo transition"
          >
            <Plus size={14} />
            {addMutation.isPending ? 'Enforcing...' : 'Add Blocking Rule'}
          </button>
        </form>

        <div className="p-3.5 bg-slate-950/40 border border-borderBg rounded-lg space-y-2 text-[11px] text-slate-400">
          <span className="font-bold text-slate-300 block">HOW BLOCKING WORKS</span>
          <p>
            When a matching rule is active, any packet possessing the matched source IP, application classification, or SNI hostname will be marked as <span className="text-rose-400 font-bold">Blocked</span> and excluded from network output streams.
          </p>
        </div>
      </div>

      {/* Column 2: Active Rules List (span 2) */}
      <div className="lg:col-span-2 glass-panel rounded-xl overflow-hidden">
        <div className="p-6 border-b border-borderBg flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
          <div>
            <h3 className="text-lg font-bold text-white">Active Firewall Rules</h3>
            <p className="text-xs text-slate-400">Live blocking rules enforced by the DPI core engine</p>
          </div>
          <span className="px-2.5 py-1 bg-slate-900 border border-borderBg rounded-full text-[10px] font-mono text-slate-400 w-fit">
            {rules?.length || 0} Rules Configured
          </span>
        </div>

        <div className="divide-y divide-borderBg">
          {isLoading ? (
            <div className="p-12 text-center text-slate-500 text-xs font-mono">Loading rules schema...</div>
          ) : rules?.length === 0 ? (
            <div className="p-12 text-center text-slate-500 text-xs flex flex-col items-center gap-2 justify-center">
              <ShieldCheck className="text-emerald-400" size={32} />
              <span className="font-mono mt-1 text-slate-400">Firewall Rules List is empty. All traffic is forwarded.</span>
            </div>
          ) : (
            rules?.map((rule) => (
              <div key={rule._id} className="p-4 flex items-center justify-between hover:bg-slate-800/10 transition">
                <div className="flex items-center gap-4">
                  <div className="p-2 bg-slate-900 border border-borderBg rounded-lg">
                    {getRuleIcon(rule.type)}
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-slate-200 font-mono">{rule.value}</div>
                    <div className="text-[10px] text-slate-500 font-mono mt-0.5">
                      Type: <span className="uppercase text-slate-400">{rule.type}</span>
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => deleteMutation.mutate(rule._id)}
                  disabled={deleteMutation.isPending}
                  className="p-2 text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition disabled:opacity-50"
                  title="Remove Rule"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))
          )}
        </div>
      </div>

    </div>
  );
}

export default Rules;
