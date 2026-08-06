import { io, Socket } from 'socket.io-client';
import { getBackendUrl, getSocketUrl, getE2BTrafficAccessToken } from './api';

let socket: Socket | null = null;

export const getSocket = (): Socket => {
  if (socket) return socket;

  const url = getSocketUrl();
  const e2bToken = getE2BTrafficAccessToken();

  console.log(`Connecting Socket.IO to ${url}...`);

  const socketOptions: any = {
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionAttempts: 10,
    reconnectionDelay: 1000,
    timeout: 10000,
  };

  if (e2bToken) {
    socketOptions.extraHeaders = {
      'e2b-traffic-access-token': e2bToken,
    };
    socketOptions.query = {
      'e2b-traffic-access-token': e2bToken,
    };
  }

  socket = io(url, socketOptions);

  socket.on('connect', () => {
    console.log('[Socket] Real-Time Gateway Connected:', socket?.id);
  });

  socket.on('disconnect', (reason) => {
    console.warn('[Socket] Real-Time Gateway Disconnected. Reason:', reason);
  });

  socket.on('connect_error', (error) => {
    console.error('[Socket] Connection Error:', error);
  });

  return socket;
};

export const disconnectSocket = () => {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
};

export interface AckResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
}

export const emitWithTimeout = <T = any>(
  event: string,
  data: any,
  timeoutMs: number = 10000
): Promise<AckResponse<T>> => {
  return new Promise((resolve) => {
    const s = getSocket();
    let timer: NodeJS.Timeout | null = null;
    let resolved = false;

    timer = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        console.warn(`[Socket Timeout] Event '${event}' timed out after ${timeoutMs}ms`);
        resolve({
          success: false,
          message: 'Connection timed out. Please check your network and try again.',
        });
      }
    }, timeoutMs);

    s.emit(event, data, (response: AckResponse<T>) => {
      if (!resolved) {
        resolved = true;
        if (timer) clearTimeout(timer);
        if (!response) {
          resolve({ success: false, message: 'Server returned empty response' });
        } else {
          resolve(response);
        }
      }
    });
  });
};
