import axios from 'axios';
import io from 'socket.io-client';

export const BACKEND_URL = import.meta.env.VITE_API_URL || '';

export const api = axios.create({
  baseURL: BACKEND_URL
});

export const connectSocket = () => {
  // If BACKEND_URL is set, use it as connection origin, otherwise connect to same origin
  const socketUrl = BACKEND_URL || window.location.origin;
  return io(socketUrl, { 
    path: '/socket.io',
    transports: ['websocket', 'polling'] // Ensure compatibility with hosting environments
  });
};
