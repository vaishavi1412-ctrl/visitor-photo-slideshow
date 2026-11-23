import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import './db.js'; // running this file creates the database tables
import visitorRoutes from './routes/visitors.js';

const app = express();

app.use(
  cors({
    origin: process.env.CLIENT_ORIGIN || 'http://localhost:5173',
    credentials: true,
  })
);
app.use(express.json());
app.use(cookieParser());

// A simple route to check that the server is alive
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.use('/api/visitors', visitorRoutes);

// Catches any error and sends a safe message (no secrets, no stack traces)
app.use((err, req, res, next) => {
  console.error(err);
  const status = err.status && err.status < 500 ? err.status : 500;
  res.status(status).json({
    error: status < 500 ? err.message : 'Something went wrong on the server.',
  });
});

export default app;