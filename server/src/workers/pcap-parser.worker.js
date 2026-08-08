import { parentPort, workerData } from 'worker_threads';

// Helper to check if a domain is blocked
function isDomainBlocked(sni, blockedDomains) {
  if (!sni) return false;
  const lowerSni = sni.toLowerCase();
  return blockedDomains.some(dom => lowerSni.includes(dom.toLowerCase()));
}

// Map SNI/Hostnames to AppType
function sniToAppType(sni) {
  if (!sni) return 'UNKNOWN';
  const domain = sni.toLowerCase();
  if (domain.includes('google')) return 'GOOGLE';
  if (domain.includes('youtube')) return 'YOUTUBE';
  if (domain.includes('facebook') || domain.includes('fbcdn')) return 'FACEBOOK';
  if (domain.includes('instagram') || domain.includes('cdninstagram')) return 'INSTAGRAM';
  if (domain.includes('twitter') || domain.includes('t.co') || domain.includes('x.com')) return 'TWITTER';
  if (domain.includes('netflix')) return 'NETFLIX';
  if (domain.includes('amazon') || domain.includes('aws')) return 'AMAZON';
  if (domain.includes('microsoft') || domain.includes('live.com') || domain.includes('outlook')) return 'MICROSOFT';
  if (domain.includes('apple') || domain.includes('icloud')) return 'APPLE';
  if (domain.includes('whatsapp')) return 'WHATSAPP';
  if (domain.includes('telegram')) return 'TELEGRAM';
  if (domain.includes('tiktok')) return 'TIKTOK';
  if (domain.includes('spotify')) return 'SPOTIFY';
  if (domain.includes('zoom')) return 'ZOOM';
  if (domain.includes('discord')) return 'DISCORD';
  if (domain.includes('github')) return 'GITHUB';
  if (domain.includes('cloudflare')) return 'CLOUDFLARE';
  if (domain.includes('reddit')) return 'REDDIT';
  if (domain.includes('wikipedia')) return 'WIKIPEDIA';
  if (domain.includes('linkedin')) return 'LINKEDIN';
  if (domain.includes('twitch')) return 'TWITCH';
  if (domain.includes('openai') || domain.includes('chatgpt')) return 'OPENAI';
  if (domain.includes('stackoverflow')) return 'STACKOVERFLOW';
  if (domain.includes('pinterest')) return 'PINTEREST';
  if (domain.includes('ebay')) return 'EBAY';
  if (domain.includes('yahoo')) return 'YAHOO';
  return 'UNKNOWN';
}

// TLS SNI Extractor
function extractSNI(payload) {
  // Minimum TLS record: 5 bytes header + 4 bytes handshake header
  if (payload.length < 9) return null;

  // Content Type should be Handshake (0x16)
  if (payload[0] !== 0x16) return null;

  // TLS Version (0x0300 - 0x0304)
  const version = payload.readUInt16BE(1);
  if (version < 0x0300 || version > 0x0304) return null;

  // Record length
  const recordLength = payload.readUInt16BE(3);
  if (recordLength > payload.length - 5) return null;

  // Handshake Type should be Client Hello (0x01)
  if (payload[5] !== 0x01) return null;

  // Skip TLS record header (5 bytes)
  let offset = 5;

  // Handshake header
  // Handshake Type (1 byte) + Handshake Length (3 bytes)
  offset += 4;

  // Client Hello
  // Client Version (2 bytes)
  offset += 2;

  // Random (32 bytes)
  offset += 32;

  // Session ID
  if (offset >= payload.length) return null;
  const sessionIdLength = payload[offset];
  offset += 1 + sessionIdLength;

  // Cipher Suites
  if (offset + 2 > payload.length) return null;
  const cipherSuitesLength = payload.readUInt16BE(offset);
  offset += 2 + cipherSuitesLength;

  // Compression Methods
  if (offset >= payload.length) return null;
  const compressionMethodsLength = payload[offset];
  offset += 1 + compressionMethodsLength;

  // Extensions
  if (offset + 2 > payload.length) return null;
  const extensionsLength = payload.readUInt16BE(offset);
  offset += 2;

  const extensionsEnd = offset + extensionsLength;
  const actualEnd = Math.min(extensionsEnd, payload.length);

  while (offset + 4 <= actualEnd) {
    const extType = payload.readUInt16BE(offset);
    const extLen = payload.readUInt16BE(offset + 2);
    offset += 4;

    if (offset + extLen > actualEnd) break;

    // Extension Type 0 is Server Name Indication (SNI)
    if (extType === 0) {
      if (extLen < 5) break;
      const sniListLen = payload.readUInt16BE(offset);
      if (sniListLen < 3) break;

      const sniType = payload[offset + 2];
      const sniLen = payload.readUInt16BE(offset + 3);

      if (sniType === 0 && sniLen <= extLen - 5) {
        // Extract hostname
        return payload.toString('ascii', offset + 5, offset + 5 + sniLen);
      }
      break;
    }
    offset += extLen;
  }

  return null;
}

// HTTP Host Extractor
function extractHTTPHost(payload) {
  if (payload.length < 4) return null;

  // Check for common HTTP methods
  const str = payload.toString('ascii', 0, Math.min(10, payload.length));
  const hasMethod = /^(GET|POST|PUT|HEAD|DELETE|PATCH|OPTIONS)\s/.test(str);
  if (!hasMethod) return null;

  const payloadStr = payload.toString('ascii');
  const lines = payloadStr.split('\r\n');
  for (const line of lines) {
    if (line.toLowerCase().startsWith('host:')) {
      let host = line.slice(5).trim();
      // Remove port if present
      const colonIndex = host.indexOf(':');
      if (colonIndex !== -1) {
        host = host.slice(0, colonIndex);
      }
      return host;
    }
  }
  return null;
}

// DNS Query Domain Extractor
function extractDNSDomain(payload) {
  if (payload.length < 12) return null;

  // Questions count (bytes 4-5)
  const qCount = payload.readUInt16BE(4);
  if (qCount === 0) return null;

  // Parse questions section starting at byte 12
  let offset = 12;
  const labels = [];

  while (offset < payload.length) {
    const len = payload[offset];
    if (len === 0) {
      offset += 1;
      break; // End of QNAME
    }

    if (offset + 1 + len > payload.length) return null;

    labels.push(payload.toString('ascii', offset + 1, offset + 1 + len));
    offset += 1 + len;
  }

  if (labels.length > 0) {
    return labels.join('.');
  }
  return null;
}

// Parse single packet buffer
function parsePacket(packetBuf) {
  const parsed = {
    etherType: null,
    srcMac: '',
    destMac: '',
    srcIp: '',
    destIp: '',
    srcPort: 0,
    destPort: 0,
    protocol: 'UNKNOWN',
    appType: 'UNKNOWN',
    sni: '',
    summary: '',
    hasIp: false,
    payloadOffset: 0,
    payloadLength: 0
  };

  // Ethernet header (14 bytes)
  if (packetBuf.length < 14) return parsed;
  parsed.destMac = [...packetBuf.slice(0, 6)].map(b => b.toString(16).padStart(2, '0')).join(':');
  parsed.srcMac = [...packetBuf.slice(6, 12)].map(b => b.toString(16).padStart(2, '0')).join(':');
  parsed.etherType = packetBuf.readUInt16BE(12);

  // If not IPv4 (0x0800), return
  if (parsed.etherType !== 0x0800) {
    parsed.summary = `Other Protocol (EtherType: 0x${parsed.etherType.toString(16)})`;
    return parsed;
  }

  // IPv4 Header
  let offset = 14;
  if (packetBuf.length < offset + 20) return parsed;

  const versionIhl = packetBuf[offset];
  const version = versionIhl >> 4;
  const ihl = versionIhl & 0x0f;
  const ipHeaderLen = ihl * 4;

  if (version !== 4 || packetBuf.length < offset + ipHeaderLen) return parsed;

  parsed.hasIp = true;
  const protoNum = packetBuf[offset + 9];
  parsed.srcIp = `${packetBuf[offset+12]}.${packetBuf[offset+13]}.${packetBuf[offset+14]}.${packetBuf[offset+15]}`;
  parsed.destIp = `${packetBuf[offset+16]}.${packetBuf[offset+17]}.${packetBuf[offset+18]}.${packetBuf[offset+19]}`;

  offset += ipHeaderLen;

  if (protoNum === 6) {
    // TCP
    parsed.protocol = 'TCP';
    if (packetBuf.length < offset + 20) return parsed;

    parsed.srcPort = packetBuf.readUInt16BE(offset);
    parsed.destPort = packetBuf.readUInt16BE(offset + 2);

    const dataOffset = (packetBuf[offset + 12] >> 4) * 4;
    const flags = packetBuf[offset + 13];

    // TCP Flags
    const syn = (flags & 0x02) !== 0;
    const ack = (flags & 0x10) !== 0;
    const fin = (flags & 0x01) !== 0;
    const rst = (flags & 0x04) !== 0;

    let flagStr = [];
    if (syn) flagStr.push('SYN');
    if (ack) flagStr.push('ACK');
    if (fin) flagStr.push('FIN');
    if (rst) flagStr.push('RST');

    parsed.summary = `TCP ${parsed.srcPort} -> ${parsed.destPort} [${flagStr.join(',')}]`;

    offset += dataOffset;
    if (offset < packetBuf.length) {
      parsed.payloadOffset = offset;
      parsed.payloadLength = packetBuf.length - offset;
      const payload = packetBuf.slice(offset);

      // Deep Packet Inspection
      if (parsed.destPort === 443 || parsed.srcPort === 443) {
        parsed.appType = 'HTTPS';
        const sni = extractSNI(payload);
        if (sni) {
          parsed.sni = sni;
          parsed.appType = sniToAppType(sni);
          parsed.summary = `TLS Client Hello [SNI: ${sni}] (${parsed.appType})`;
        } else {
          parsed.summary = `HTTPS/TLS Traffic`;
        }
      } else if (parsed.destPort === 80 || parsed.srcPort === 80) {
        parsed.appType = 'HTTP';
        const host = extractHTTPHost(payload);
        if (host) {
          parsed.sni = host;
          parsed.appType = sniToAppType(host);
          parsed.summary = `HTTP Request [Host: ${host}] (${parsed.appType})`;
        } else {
          parsed.summary = `HTTP Traffic`;
        }
      }
    }
  } else if (protoNum === 17) {
    // UDP
    parsed.protocol = 'UDP';
    if (packetBuf.length < offset + 8) return parsed;

    parsed.srcPort = packetBuf.readUInt16BE(offset);
    parsed.destPort = packetBuf.readUInt16BE(offset + 2);

    parsed.summary = `UDP ${parsed.srcPort} -> ${parsed.destPort}`;

    offset += 8;
    if (offset < packetBuf.length) {
      parsed.payloadOffset = offset;
      parsed.payloadLength = packetBuf.length - offset;
      const payload = packetBuf.slice(offset);

      // DNS Inspection
      if (parsed.destPort === 53 || parsed.srcPort === 53) {
        parsed.appType = 'DNS';
        const dnsDomain = extractDNSDomain(payload);
        if (dnsDomain) {
          parsed.sni = dnsDomain;
          parsed.appType = sniToAppType(dnsDomain);
          parsed.summary = `DNS Query [${dnsDomain}]`;
        } else {
          parsed.summary = `DNS Traffic`;
        }
      }
    }
  } else {
    parsed.protocol = `PROTO_${protoNum}`;
    parsed.summary = `IP Protocol ${protoNum}`;
  }

  return parsed;
}

// Main processing logic
async function run() {
  const { fileBuffer, rules } = workerData;
  const buffer = Buffer.from(fileBuffer);

  const blockedIPs = new Set(rules.filter(r => r.type === 'ip').map(r => r.value));
  const blockedApps = new Set(rules.filter(r => r.type === 'app').map(r => r.value.toUpperCase()));
  const blockedDomains = rules.filter(r => r.type === 'domain').map(r => r.value);

  // PCAP global header is 24 bytes
  if (buffer.length < 24) {
    throw new Error('Invalid PCAP file: Too short');
  }

  const magic = buffer.readUInt32LE(0);
  let isLittleEndian = true;
  if (magic === 0xa1b2c3d4 || magic === 0xa1b23c4d) {
    isLittleEndian = true;
  } else if (magic === 0xd4c3b2a1 || magic === 0x4d3cb2a1) {
    isLittleEndian = false;
  } else {
    throw new Error('Invalid PCAP file: Unsupported magic number 0x' + magic.toString(16));
  }

  const readUInt32 = isLittleEndian
    ? (buf, offset) => buf.readUInt32LE(offset)
    : (buf, offset) => buf.readUInt32BE(offset);

  const linkType = readUInt32(buffer, 20);
  if (linkType !== 1) {
    throw new Error('Unsupported PCAP link type: ' + linkType + '. Only Ethernet link type is supported.');
  }

  let offset = 24;
  let packetId = 0;
  const packets = [];
  const flowsMap = new Map();

  const stats = {
    totalPackets: 0,
    totalBytes: 0,
    forwardedPackets: 0,
    droppedPackets: 0,
    tcpPackets: 0,
    udpPackets: 0,
    otherPackets: 0,
    appDistribution: {}
  };

  const startTime = Date.now();
  let lastProgressSent = Date.now();

  while (offset + 16 <= buffer.length) {
    const tsSec = readUInt32(buffer, offset);
    const tsUsec = readUInt32(buffer, offset + 4);
    const capLen = readUInt32(buffer, offset + 8);
    const origLen = readUInt32(buffer, offset + 12);

    offset += 16;

    if (offset + capLen > buffer.length) {
      break; // Truncated packet at EOF
    }

    const packetData = buffer.slice(offset, offset + capLen);
    offset += capLen;

    packetId++;
    stats.totalPackets++;
    stats.totalBytes += origLen;

    const parsed = parsePacket(packetData);

    // Track protocol stats
    if (parsed.protocol === 'TCP') stats.tcpPackets++;
    else if (parsed.protocol === 'UDP') stats.udpPackets++;
    else stats.otherPackets++;

    // Classify app distribution
    const appType = parsed.appType;
    stats.appDistribution[appType] = (stats.appDistribution[appType] || 0) + 1;

    // Check blocking rules
    let isBlocked = false;
    if (parsed.hasIp) {
      if (blockedIPs.has(parsed.srcIp) || blockedIPs.has(parsed.destIp)) {
        isBlocked = true;
      }
    }
    if (blockedApps.has(appType.toUpperCase())) {
      isBlocked = true;
    }
    if (parsed.sni && isDomainBlocked(parsed.sni, blockedDomains)) {
      isBlocked = true;
    }

    if (isBlocked) {
      stats.droppedPackets++;
    } else {
      stats.forwardedPackets++;
    }

    // Build flow identifier (Five-Tuple)
    let flowId = 'unknown';
    if (parsed.hasIp) {
      const parts = [parsed.srcIp, parsed.destIp, parsed.srcPort, parsed.destPort, parsed.protocol];
      flowId = parts.join('-');
      // Check reverse flow too to group bidirectional traffic together
      const reverseFlowId = [parsed.destIp, parsed.srcIp, parsed.destPort, parsed.srcPort, parsed.protocol].join('-');

      let flowObj = flowsMap.get(flowId) || flowsMap.get(reverseFlowId);
      if (!flowObj) {
        flowObj = {
          flowId,
          srcIp: parsed.srcIp,
          destIp: parsed.destIp,
          srcPort: parsed.srcPort,
          destPort: parsed.destPort,
          protocol: parsed.protocol,
          appType: parsed.appType === 'UNKNOWN' ? 'UNKNOWN' : parsed.appType,
          sni: parsed.sni || '',
          packets: 0,
          bytes: 0,
          blocked: false,
          firstSeen: new Date(tsSec * 1000 + Math.floor(tsUsec / 1000)),
          lastSeen: new Date(tsSec * 1000 + Math.floor(tsUsec / 1000))
        };
        flowsMap.set(flowId, flowObj);
      }

      flowObj.packets++;
      flowObj.bytes += origLen;
      flowObj.lastSeen = new Date(tsSec * 1000 + Math.floor(tsUsec / 1000));
      if (isBlocked) {
        flowObj.blocked = true;
      }
      // If we find SNI later in the stream, update flow
      if (parsed.sni && !flowObj.sni) {
        flowObj.sni = parsed.sni;
        flowObj.appType = parsed.appType;
      }
    }

    packets.push({
      packetId,
      flowId,
      timestamp: new Date(tsSec * 1000 + Math.floor(tsUsec / 1000)),
      length: origLen,
      srcIp: parsed.srcIp || 'N/A',
      destIp: parsed.destIp || 'N/A',
      srcPort: parsed.srcPort || null,
      destPort: parsed.destPort || null,
      protocol: parsed.protocol,
      appType: parsed.appType,
      sni: parsed.sni || '',
      blocked: isBlocked,
      summary: parsed.summary
    });

    // Send status update every 200ms or 1000 packets to keep the UI responsive
    if (Date.now() - lastProgressSent > 200 || packetId % 2000 === 0) {
      parentPort.postMessage({
        type: 'progress',
        progress: Math.min(Math.round((offset / buffer.length) * 100), 99),
        stats: { ...stats, activeConnections: flowsMap.size }
      });
      lastProgressSent = Date.now();
    }
  }

  // Final response back to server thread
  parentPort.postMessage({
    type: 'done',
    packets,
    flows: Array.from(flowsMap.values()),
    stats: { ...stats, activeConnections: flowsMap.size }
  });
}

run().catch(err => {
  parentPort.postMessage({
    type: 'error',
    error: err.message
  });
});
