import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import './db.js'; // running this file creates the database tables

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

export default app;