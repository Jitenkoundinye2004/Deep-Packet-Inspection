import http from 'http';
import { Server } from 'socket.io';
import app from './app.js';
import { connectDB } from './config/db.js';
import { connectRedis } from './config/redis.js';
import { dpiService } from './services/dpi.service.js';

const PORT = process.env.PORT || 5000;

async function startServer() {
  // 1. Connect to data services
  await connectDB();
  connectRedis();

  // 2. Create HTTP Server
  const server = http.createServer(app);

  // 3. Setup Socket.IO
  const io = new Server(server, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST']
    }
  });

  // Attach socket server instance to express app so routes can access it
  app.set('io', io);

  io.on('connection', (socket) => {
    console.log(`🔌 Client connected: ${socket.id}`);

    // If currently parsing a PCAP, let the newly connected socket know the progress
    if (dpiService.isProcessing()) {
      socket.emit('pcap:progress', {
        progress: dpiService.getCurrentProgress(),
        message: 'Analysis already in progress...'
      });
    }

    socket.on('disconnect', () => {
      console.log(`🔌 Client disconnected: ${socket.id}`);
    });
  });

  // 4. Start Server
  server.listen(PORT, () => {
    console.log(`🚀 Packet Analyzer Server is running on port ${PORT}`);
  });
}

startServer().catch(err => {
  console.error('💥 Critical failure starting server:', err);
  process.exit(1);
});
