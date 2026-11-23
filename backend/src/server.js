import 'dotenv/config';
import http from 'http';
import { Server } from 'socket.io';
import app from './app.js';
import { seedAdmin } from './utils/seedAdmin.js';

const PORT = process.env.PORT || 5000;

seedAdmin(); // creates or updates the admin account from backend/.env

const server = http.createServer(app);

const io = new Server(server, {
  cors: { origin: process.env.CLIENT_ORIGIN || 'http://localhost:5173' },
});

// Routes use this to tell the TV page "photos changed"
app.set('io', io);

io.on('connection', (socket) => {
  console.log('A screen connected:', socket.id);
});

server.listen(PORT, () => {
  console.log(`Backend running at http://localhost:${PORT}`);
});