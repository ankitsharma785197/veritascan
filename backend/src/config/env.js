import dotenv from 'dotenv';

dotenv.config({ path: '../.env' });
dotenv.config();

function parseCsv(value) {
  return String(value || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

export const env = {
  port: process.env.PORT || 5001,
  mongoUri: process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/veritascan',
  jwtSecret: process.env.JWT_SECRET || 'change-this-dev-secret',
  geminiApiKey: process.env.GEMINI_API_KEY,
  geminiModel: process.env.GEMINI_MODEL || 'gemini-2.5-flash',
  geminiModelFallbacks: parseCsv(process.env.GEMINI_MODEL_FALLBACKS),
  clientOrigin: process.env.CLIENT_ORIGIN || 'http://127.0.0.1:5173'
};
