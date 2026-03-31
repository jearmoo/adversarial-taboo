import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import path from 'path';
import { RoomManager } from './game/RoomManager';
import { registerHandlers } from './socket/handlers';
import { logger } from './logger';

const PORT = parseInt(process.env.PORT || '4040', 10);
const app = express();
const httpServer = createServer(app);

const io = new Server(httpServer, {
  cors: {
    origin: process.env.NODE_ENV === 'production' ? false : ['http://localhost:5173'],
    methods: ['GET', 'POST'],
  },
  transports: ['websocket', 'polling'],
});

if (process.env.NODE_ENV === 'production') {
  const clientPath = path.join(__dirname, '..', 'public');
  app.use(express.static(clientPath));
  app.get('*', (_req, res) => {
    res.sendFile(path.join(clientPath, 'index.html'));
  });
}

const rooms = new RoomManager();
registerHandlers(io, rooms);

io.engine.on('connection_error', (err: any) => {
  logger.error('server', 'Socket.IO connection error', { code: err.code, message: err.message });
});

httpServer.listen(PORT, () => {
  logger.info('server', `Adversarial Taboo server started on port ${PORT}`);
});
