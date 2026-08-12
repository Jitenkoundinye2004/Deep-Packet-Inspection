import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, connectSocket } from '../utils/api.js';
import { Upload, Layers, ShieldCheck, ShieldAlert, ChevronRight, Eye, Search, AlertCircle, FileCode } from 'lucide-react';

function Packets() {
  const queryClient = useQueryClient();
  const [selectedFlow, setSelectedFlow] = useState(null);
  const [selectedPacket, setSelectedPacket] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [uploadError, setUploadError] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [liveProgress, setLiveProgress] = useState(null);

  // 1. Fetch Flows
  const { data: flows, isLoading: isLoadingFlows, refetch: refetchFlows } = useQuery({
    queryKey: ['flows'],
    queryFn: async () => {
      const res = await api.get('/api/flows');
      return res.data;
    }
  });

  // 2. Fetch Packets for Selected Flow
  const { data: packets, isLoading: isLoadingPackets } = useQuery({
    queryKey: ['packets', selectedFlow?.flowId],
    queryFn: async () => {
      if (!selectedFlow) return [];
      const res = await api.get(`/api/packets?flowId=${selectedFlow.flowId}`);
      return res.data;
    },
    enabled: !!selectedFlow
  });

  // Socket connection for live progress and refresh trigger
  useEffect(() => {
    const socket = connectSocket();

    socket.on('pcap:progress', (data) => {
      setLiveProgress(data.progress);
    });

    socket.on('pcap:done', (data) => {
      setLiveProgress(null);
      refetchFlows();
      queryClient.invalidateQueries({ queryKey: ['stats'] });
      if (selectedFlow) {
        queryClient.invalidateQueries({ queryKey: ['packets', selectedFlow.flowId] });
      }
    });

    socket.on('pcap:error', (data) => {
      setLiveProgress(null);
      setUploadError(data.error);
    });

    return () => {
      socket.disconnect();
    };
  }, [refetchFlows, queryClient, selectedFlow]);

  // 3. Upload PCAP Mutation
  const uploadMutation = useMutation({
    mutationFn: async (file) => {
      const formData = new FormData();
      formData.append('pcap', file);
      const res = await api.post('/api/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      return res.data;
    },
    onMutate: () => {
      setUploading(true);
      setUploadError(null);
    },
    onSuccess: () => {
      setUploading(false);
    },
    onError: (err) => {
      setUploading(false);
      setUploadError(err.response?.data?.error || err.message);
    }
  });

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      uploadMutation.mutate(file);
    }
  };

  const formatBytes = (bytes) => {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // Filter flows
  const filteredFlows = flows?.filter(flow => {
    const term = searchTerm.toLowerCase();
    const matchesSearch = 
      flow.srcIp.toLowerCase().includes(term) ||
      flow.destIp.toLowerCase().includes(term) ||
      (flow.sni && flow.sni.toLowerCase().includes(term)) ||
      flow.appType.toLowerCase().includes(term);

    const matchesStatus = 
      statusFilter === 'all' ? true :
      statusFilter === 'blocked' ? flow.blocked :
      statusFilter === 'forwarded' ? !flow.blocked : true;

    return matchesSearch && matchesStatus;
  });

  return (
    <div className="grid grid-cols-1 xl:grid-cols-3 gap-8 items-start">
      
      {/* Column 1: Flows Table & Upload Zone (span 2) */}
      <div className="xl:col-span-2 space-y-6">
        
        {/* Upload Zone */}
        <div className="glass-panel p-6 rounded-xl space-y-4">
          <h3 className="text-lg font-bold text-white">Upload Traffic Capture</h3>
          <p className="text-xs text-slate-400">Supported formats: standard PCAP files (max 50MB). Binary parsing runs in node workers.</p>
          
          <div className="flex flex-col items-center justify-center border-2 border-dashed border-borderBg hover:border-indigo-500/50 rounded-xl p-8 transition bg-slate-950/20 relative">
            <input 
              type="file" 
              accept=".pcap" 
              onChange={handleFileUpload}
              disabled={uploading}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            />
            <div className="flex flex-col items-center gap-3 pointer-events-none">
              <Upload size={32} className="text-indigo-400 animate-bounce" />
              <div className="text-sm font-semibold text-slate-300">
                {uploading ? 'Processing capture...' : 'Drag & drop PCAP file or click to browse'}
              </div>
              <span className="text-xs text-slate-500">Includes IP, TCP, UDP, TLS SNI payloads</span>
            </div>
          </div>

          {liveProgress !== null && (
            <div className="space-y-2 p-3 bg-indigo-500/10 border border-indigo-500/20 rounded-lg">
              <div className="flex justify-between text-xs font-mono">
                <span className="text-slate-300">Offloaded Worker Parsing...</span>
                <span className="text-indigo-400 font-bold">{liveProgress}%</span>
              </div>
              <div className="w-full bg-slate-900 rounded-full h-2 overflow-hidden border border-borderBg">
                <div 
                  className="bg-gradient-to-r from-indigo-500 to-cyan-500 h-full transition-all duration-300 rounded-full" 
                  style={{ width: `${liveProgress}%` }}
                ></div>
              </div>
            </div>
          )}

          {uploadError && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-lg text-xs flex items-center gap-2">
              <AlertCircle size={14} />
              <span>{uploadError}</span>
            </div>
          )}

          {uploadMutation.isSuccess && liveProgress === null && (
            <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-lg text-xs flex items-center gap-2">
              <ShieldCheck size={14} />
              <span>PCAP parsed successfully. Live telemetry updated!</span>
            </div>
          )}
        </div>

        {/* Flows Table */}
        <div className="glass-panel rounded-xl overflow-hidden">
          <div className="p-4 sm:p-6 border-b border-borderBg flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
            <div>
              <h3 className="text-lg font-bold text-white">Tracked Connections</h3>
              <p className="text-xs text-slate-400">Bidirectional conversations parsed from network headers</p>
            </div>
            
            {/* Filter and Search Bar */}
            <div className="flex flex-col sm:flex-row items-center gap-3 w-full lg:w-auto">
              <div className="relative w-full sm:flex-1 md:w-64">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  type="text"
                  placeholder="Search IP, Host or App..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-4 py-1.5 glass-input rounded-lg text-xs text-slate-200"
                />
              </div>

              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full sm:w-auto px-3 py-1.5 glass-input rounded-lg text-xs text-slate-200"
              >
                <option value="all">All States</option>
                <option value="forwarded">Forwarded</option>
                <option value="blocked">Blocked</option>
              </select>
            </div>
          </div>

          <div className="overflow-x-auto">
            {isLoadingFlows ? (
              <div className="p-12 text-center text-slate-500 text-xs font-mono">Loading active streams...</div>
            ) : filteredFlows?.length === 0 ? (
              <div className="p-12 text-center text-slate-500 text-xs font-mono">No network streams found</div>
            ) : (
              <table className="w-full text-left border-collapse min-w-[700px]">
                <thead>
                  <tr className="border-b border-borderBg bg-slate-950/20 text-slate-400 text-[10px] font-mono uppercase tracking-wider">
                    <th className="p-4">Flow ID / Source IP</th>
                    <th className="p-4">Destination IP</th>
                    <th className="p-4">Protocol</th>
                    <th className="p-4">Application (SNI)</th>
                    <th className="p-4">Volume</th>
                    <th className="p-4 text-center">Status</th>
                    <th className="p-4"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-borderBg text-xs">
                  {filteredFlows?.map((flow) => (
                    <tr 
                      key={flow.flowId}
                      className={`hover:bg-slate-800/20 transition-all cursor-pointer ${selectedFlow?.flowId === flow.flowId ? 'bg-indigo-600/10' : ''}`}
                      onClick={() => {
                        setSelectedFlow(flow);
                        setSelectedPacket(null);
                      }}
                    >
                      <td className="p-4">
                        <div className="font-semibold text-slate-200">{flow.srcIp}</div>
                        <div className="text-[10px] text-slate-500 font-mono mt-0.5">Port: {flow.srcPort}</div>
                      </td>
                      <td className="p-4">
                        <div className="font-semibold text-slate-200">{flow.destIp}</div>
                        <div className="text-[10px] text-slate-500 font-mono mt-0.5">Port: {flow.destPort}</div>
                      </td>
                      <td className="p-4">
                        <span className="px-2 py-0.5 bg-slate-900 border border-borderBg rounded text-[10px] font-mono text-slate-300">
                          {flow.protocol}
                        </span>
                      </td>
                      <td className="p-4">
                        <div className="font-medium text-slate-200">{flow.appType}</div>
                        {flow.sni && (
                          <div className="text-[10px] text-slate-400 font-mono truncate max-w-[150px] mt-0.5">{flow.sni}</div>
                        )}
                      </td>
                      <td className="p-4 font-mono text-slate-300">
                        <div>{flow.packets} pkts</div>
                        <div className="text-[10px] text-slate-500 mt-0.5">{formatBytes(flow.bytes)}</div>
                      </td>
                      <td className="p-4 text-center">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-semibold ${
                          flow.blocked 
                            ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20' 
                            : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                        }`}>
                          {flow.blocked ? <ShieldAlert size={10} /> : <ShieldCheck size={10} />}
                          {flow.blocked ? 'Blocked' : 'Forwarded'}
                        </span>
                      </td>
                      <td className="p-4">
                        <ChevronRight size={16} className={`text-slate-500 transition-transform ${selectedFlow?.flowId === flow.flowId ? 'rotate-90 text-indigo-400' : ''}`} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>

      {/* Column 2: Packets & Details Sidebar (span 1) */}
      <div className="space-y-6">
        
        {/* Packets List */}
        {selectedFlow && (
          <div className="glass-panel rounded-xl overflow-hidden">
            <div className="p-6 border-b border-borderBg">
              <h3 className="text-sm font-bold text-white">Packets in Flow</h3>
              <p className="text-[11px] text-slate-500 truncate">{selectedFlow.flowId}</p>
            </div>
            
            <div className="max-h-[300px] overflow-y-auto divide-y divide-borderBg">
              {isLoadingPackets ? (
                <div className="p-8 text-center text-slate-500 text-xs font-mono">Parsing segment...</div>
              ) : packets?.length === 0 ? (
                <div className="p-8 text-center text-slate-500 text-xs font-mono">No packets cached</div>
              ) : (
                packets?.map((pkt) => (
                  <div
                    key={pkt._id || pkt.packetId}
                    onClick={() => setSelectedPacket(pkt)}
                    className={`p-4 flex justify-between items-center cursor-pointer transition ${
                      selectedPacket?.packetId === pkt.packetId ? 'bg-indigo-600/15' : 'hover:bg-slate-800/10'
                    }`}
                  >
                    <div className="space-y-1 min-w-0 pr-2">
                      <div className="text-xs font-semibold text-slate-300 font-mono flex items-center gap-2">
                        <span>#{pkt.packetId}</span>
                        <span className="text-[10px] text-slate-500">
                          {new Date(pkt.timestamp).toLocaleTimeString()}
                        </span>
                      </div>
                      <div className="text-[10px] text-slate-400 truncate font-mono">{pkt.summary}</div>
                    </div>
                    <div className="shrink-0 flex items-center gap-2">
                      <span className="text-[10px] font-mono text-slate-400">{pkt.length} B</span>
                      <Eye size={12} className={selectedPacket?.packetId === pkt.packetId ? 'text-indigo-400' : 'text-slate-500'} />
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* Packet Inspector (Hex/Header decode) */}
        {selectedPacket && (
          <div className="glass-panel p-6 rounded-xl border border-indigo-500/20 space-y-4 shadow-glass">
            <div className="flex items-center gap-2 pb-2 border-b border-borderBg">
              <FileCode className="text-indigo-400" size={18} />
              <h3 className="font-bold text-white text-sm">Deep Layer Decoder</h3>
            </div>

            <div className="space-y-3 text-xs font-mono">
              {/* Frame Info */}
              <div className="p-2.5 bg-slate-950/40 border border-borderBg rounded">
                <span className="text-[10px] text-indigo-400 block font-bold mb-1">FRAME METRICS</span>
                <div className="grid grid-cols-2 gap-y-1 text-slate-300">
                  <div>Timestamp:</div>
                  <div className="text-right text-slate-400">{new Date(selectedPacket.timestamp).toISOString().split('T')[1].slice(0, -1)}</div>
                  <div>Length:</div>
                  <div className="text-right text-slate-400">{selectedPacket.length} bytes</div>
                  <div>Status:</div>
                  <div className={`text-right font-semibold ${selectedPacket.blocked ? 'text-rose-400' : 'text-emerald-400'}`}>
                    {selectedPacket.blocked ? 'BLOCKED' : 'FORWARDED'}
                  </div>
                </div>
              </div>

              {/* L2 - Ethernet */}
              <div className="p-2.5 bg-slate-950/40 border border-borderBg rounded">
                <span className="text-[10px] text-indigo-400 block font-bold mb-1">L2 ETHERNET HEADER</span>
                <div className="grid grid-cols-2 gap-y-1 text-slate-300">
                  <div>EtherType:</div>
                  <div className="text-right text-slate-400">0x0800 (IPv4)</div>
                </div>
              </div>

              {/* L3 - IP */}
              <div className="p-2.5 bg-slate-950/40 border border-borderBg rounded">
                <span className="text-[10px] text-indigo-400 block font-bold mb-1">L3 IPv4 HEADER</span>
                <div className="grid grid-cols-2 gap-y-1 text-slate-300">
                  <div>Source IP:</div>
                  <div className="text-right text-slate-400">{selectedPacket.srcIp}</div>
                  <div>Destination IP:</div>
                  <div className="text-right text-slate-400">{selectedPacket.destIp}</div>
                  <div>Protocol:</div>
                  <div className="text-right text-slate-400">{selectedPacket.protocol}</div>
                </div>
              </div>

              {/* L4 - TCP/UDP */}
              {(selectedPacket.srcPort || selectedPacket.destPort) && (
                <div className="p-2.5 bg-slate-950/40 border border-borderBg rounded">
                  <span className="text-[10px] text-indigo-400 block font-bold mb-1">L4 {selectedPacket.protocol} HEADER</span>
                  <div className="grid grid-cols-2 gap-y-1 text-slate-300">
                    <div>Source Port:</div>
                    <div className="text-right text-slate-400">{selectedPacket.srcPort}</div>
                    <div>Destination Port:</div>
                    <div className="text-right text-slate-400">{selectedPacket.destPort}</div>
                  </div>
                </div>
              )}

              {/* L7 - Application DPI */}
              {selectedPacket.appType !== 'UNKNOWN' && (
                <div className="p-2.5 bg-indigo-500/5 border border-indigo-500/20 rounded">
                  <span className="text-[10px] text-indigo-400 block font-bold mb-1">L7 DPI ANALYSIS</span>
                  <div className="grid grid-cols-2 gap-y-1 text-slate-300">
                    <div>App Class:</div>
                    <div className="text-right text-slate-200 font-bold">{selectedPacket.appType}</div>
                    {selectedPacket.sni && (
                      <>
                        <div>SNI Host:</div>
                        <div className="text-right text-slate-400 break-all">{selectedPacket.sni}</div>
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {!selectedFlow && (
          <div className="glass-panel p-8 rounded-xl flex flex-col items-center justify-center gap-3 text-center text-slate-500">
            <Layers size={36} />
            <p className="text-xs font-mono">Select a connection flow from the tracker to inspect individual packets</p>
          </div>
        )}
      </div>

    </div>
  );
}

export default Packets;
