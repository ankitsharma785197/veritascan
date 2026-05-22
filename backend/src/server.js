import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import { connectDb } from './config/db.js';
import { env } from './config/env.js';
import { authRouter } from './routes/auth.js';
import { scansRouter } from './routes/scans.js';

const app = express();

app.use(cors({ origin: env.clientOrigin, credentials: true }));
app.use(express.json({ limit: '1mb' }));
app.use(morgan('dev'));

app.get('/api/health', (req, res) => {
  res.json({
    ok: true,
    geminiConfigured: Boolean(env.geminiApiKey)
  });
});

app.use('/api/auth', authRouter);
app.use('/api/scans', scansRouter);

app.use((error, req, res, next) => {
  console.error(error);
  const status = error.message?.includes('Unsupported') || error.message?.includes('Only JPG') ? 400 : 500;
  res.status(status).json({ message: error.message || 'Server error.' });
});

connectDb()
  .then(() => {
    app.listen(env.port, () => {
      console.log(`VeritaScan API running on http://127.0.0.1:${env.port}`);
    });
  })
  .catch((error) => {
    console.error('Failed to start server:', error.message);
    process.exit(1);
  });
