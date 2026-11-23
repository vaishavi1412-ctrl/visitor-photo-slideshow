import 'dotenv/config';
import http from 'http';
import { Server } from 'socket.io';
import app from './app.js';

const PORT = process.env.PORT || 5000;

const server = http.createServer(app);

const io = new Server(server, {
  cors: { origin: process.env.CLIENT_ORIGIN || 'http://localhost:5173' },
});

// Routes will use this later to tell the TV page "a new photo arrived"
app.set('io', io);

io.on('connection', (socket) => {
  console.log('A screen connected:', socket.id);
});

server.listen(PORT, () => {
  console.log(`Backend running at http://localhost:${PORT}`);
});