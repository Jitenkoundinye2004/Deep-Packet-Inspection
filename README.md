# DPI Engine - Deep Packet Inspection & Firewall System

This project is a full-stack Web-Based Network Firewall and Packet Analyzer built using the MERN stack (React, Node.js, Express, MongoDB, Redis) and Socket.IO. It simulates how network firewalls inspect traffic, block unwanted websites, and report real-time telemetry.

---

## 1. Project Overview

```
User PCAP Upload ──► [Express Server] ──► Spawns Worker Thread (DPI Engine)
                                                  │
   ┌──────────────────────────────────────────────┘
   ▼
[pcap-parser.worker.js] ──► Decodes L2/L3/L4/L7 ──► Evaluates Rules ──► Stream updates (Socket.IO)
                                                                               │
   ┌───────────────────────────────────────────────────────────────────────────┘
   ▼
[React UI Dashboard] (View stats, protocol compositions, connection lists, and deep packet logs)
```

Unlike basic firewalls that only look at packet headers (IP addresses), this system performs **Deep Packet Inspection (DPI)**. It opens the packet payload to read application-layer data—specifically, the plain-text **Server Name Indication (SNI)** in encrypted HTTPS handshakes, **HTTP Host headers**, and **DNS query labels**—allowing it to block specific websites dynamically.

---

## 2. Technology Stack

* **Frontend**: React.js, Vite, Tailwind CSS, TanStack Query, Recharts, Lucide React, Socket.IO Client.
* **Backend**: Node.js (ES Modules), Express.js, Worker Threads, Socket.IO.
* **Database & Cache**: MongoDB, Mongoose, Redis (with automatic in-memory fallbacks if database servers are offline).
* **DevOps**: Docker, Docker Compose, GitHub Actions.

---

## 3. How to Run Locally

### Option A: Local Development (Fastest Setup)

1. **Install Dependencies**:
   * For the Backend:
     ```bash
     cd server
     npm install
     ```
   * For the Frontend:
     ```bash
     cd ../client
     npm install
     ```

2. **Start Backend**:
     ```bash
     cd ../server
     npm run dev
     ```
   * Runs at `http://localhost:5000`. It connects to MongoDB if available, otherwise it automatically falls back to an **In-memory Database Mock** for ease of development.

3. **Start Frontend**:
     ```bash
     cd ../client
     npm run dev
     ```
   * Runs at `http://localhost:3000`.

4. **Verify**: Open `http://localhost:3000` in your web browser.

### Option B: Docker Compose

Spin up the entire stack (MongoDB, Redis, Server, Nginx Client) with a single command in the project root:
```bash
docker-compose up --build
```
* Access the web dashboard at `http://localhost:8080`.

---

## 4. How the Deep Packet Inspection (DPI) Works

### The Network Stack (Layers)

Every network packet contains layers of information wrapper inside each other like Russian nesting dolls:

```
┌──────────────────────────────────────────────────────────────────┐
│ Ethernet Header (14 bytes)                                       │
│ ┌──────────────────────────────────────────────────────────────┐ │
│ │ IP Header (20 bytes)                                         │ │
│ │ ┌──────────────────────────────────────────────────────────┐ │ │
│ │ │ TCP Header (20 bytes)                                    │ │ │
│ │ │ ┌──────────────────────────────────────────────────────┐ │ │ │
│ │ │ │ Payload (Application Data)                           │ │ │ │
│ │ │ │ e.g., TLS Client Hello with SNI                      │ │ │ │
│ │ │ └──────────────────────────────────────────────────────┘ │ │ │
│ │ └──────────────────────────────────────────────────────────┘ │ │
│ └──────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────┘
```

The background Worker Thread (`pcap-parser.worker.js`) parses these layers sequentially:
1. **Ethernet Decoder**: Extracts MAC addresses and checks if the payload is IPv4.
2. **IP Decoder**: Extracts Source and Destination IP addresses.
3. **TCP/UDP Decoder**: Identifies port numbers and TCP flags (SYN, ACK, FIN).
4. **L7 DPI Decoder**:
   * **TLS Client Hello (HTTPS on Port 443)**: Even though HTTPS is encrypted, the initial client greeting (Client Hello) is plaintext. The parser traverses the handshake extensions to extract the **Server Name Indication (SNI)** hostname (e.g. `www.youtube.com`).
   * **HTTP Requests (Port 80)**: Parses the plaintext headers to find `Host: `.
   * **DNS Queries (Port 53)**: Decodes length-prefixed query strings to extract the domain name lookup.

---

## 5. How Blocking Works

You can define blocking rules in the UI by **Source IP**, **Domain name** (substring match), or **Application Category** (e.g., YouTube, Facebook, Netflix). 

During analysis, if any packet details match an active rule:
1. The packet is flagged as `Blocked` (dropped).
2. The parent connection stream is marked as `Blocked`.
3. The dashboard aggregates these metrics to show allowed (Forwarded) vs Blocked packet distribution in real time.
