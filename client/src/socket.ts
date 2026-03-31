import { io, Socket } from 'socket.io-client';
import { SESSION_KEY } from './constants';

const URL = import.meta.env.PROD ? window.location.origin : 'http://localhost:4040';

export const socket: Socket = io(URL, {
  transports: ['websocket', 'polling'],
  autoConnect: true,
});

// Auto-reconnect from saved session (skip if URL has a room code)
socket.on('connect', () => {
  const urlPath = window.location.pathname.replace(/^\//, '');
  if (/^[A-Za-z0-9]{4}$/.test(urlPath)) return;

  const saved = localStorage.getItem(SESSION_KEY);
  if (saved) {
    try {
      const { roomCode, playerId, playerName } = JSON.parse(saved);
      if (roomCode && playerId && playerName) {
        socket.emit('room:join', { roomCode, playerName, sessionId: playerId });
      }
    } catch (_e) { /* corrupt session data */ }
  }
});
