import { io, Socket } from 'socket.io-client';
import { getBackendUrl, getSocketUrl, getE2BTrafficAccessToken } from './api';

let socket: Socket | null = null;

export const getSocket = (): Socket => {
  if (socket) return socket;

  const url = getSocketUrl();
  const e2bToken = getE2BTrafficAccessToken();

  console.log(`Connecting Socket.IO to ${url}...`);

  // Build connection configurations
  const socketOptions: any = {
    transports: ['websocket', 'polling'], // Fallback mechanism for maximum reliability
    reconnection: true,
    reconnectionAttempts: 10,
    reconnectionDelay: 1000,
    timeout: 10000,
  };

  // Inject E2B sandbox authentication headers to bypass proxy filters if active
  if (e2bToken) {
    socketOptions.extraHeaders = {
      'e2b-traffic-access-token': e2bToken,
    };
    // Include in query parameters for polling fallback
    socketOptions.query = {
      'e2b-traffic-access-token': e2bToken,
    };
  }

  socket = io(url, socketOptions);

  socket.on('connect', () => {
    console.log('Real-Time Gateway Connected!', socket?.id);
  });

  socket.on('disconnect', (reason) => {
    console.warn('Real-Time Gateway Disconnected. Reason:', reason);
  });

  socket.on('connect_error', (error) => {
    console.error('Real-Time Gateway Connection Error:', error);
  });

  return socket;
};

export const disconnectSocket = () => {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
};
