import express from 'express';
import multer from 'multer';
import { requireAuth } from '../middleware/auth.js';
import { Scan } from '../models/Scan.js';
import { analyzeFile } from '../services/forensics.js';
import { GeminiModelsExhaustedError } from '../services/gemini.js';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
    cb(allowed.includes(file.mimetype) ? null : new Error('Only JPG, PNG, WEBP, and PDF files are supported.'), allowed.includes(file.mimetype));
  }
});

export const scansRouter = express.Router();

scansRouter.use(requireAuth);

scansRouter.get('/', async (req, res, next) => {
  try {
    const scans = await Scan.find({ user: req.user._id })
      .sort({ createdAt: -1 })
      .limit(20)
      .select('fileName mimeType fileSize fileKind verdict confidence explanation indicators metadata geminiModel createdAt');
    res.json({ scans });
  } catch (error) {
    next(error);
  }
});

scansRouter.delete('/', async (req, res, next) => {
  try {
    const result = await Scan.deleteMany({ user: req.user._id });
    res.json({ deletedCount: result.deletedCount || 0 });
  } catch (error) {
    next(error);
  }
});

scansRouter.delete('/:id', async (req, res, next) => {
  try {
    const scan = await Scan.findOneAndDelete({ _id: req.params.id, user: req.user._id });
    if (!scan) {
      return res.status(404).json({ message: 'Scan not found.' });
    }

    res.json({ deletedId: scan._id });
  } catch (error) {
    next(error);
  }
});

scansRouter.post('/', upload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'Upload a file to scan.' });
    }

    const report = await analyzeFile({ buffer: req.file.buffer, mimeType: req.file.mimetype });
    const scan = await Scan.create({
      user: req.user._id,
      fileName: req.file.originalname,
      mimeType: req.file.mimetype,
      fileSize: req.file.size,
      ...report
    });

    res.status(201).json({ scan });
  } catch (error) {
    if (error instanceof GeminiModelsExhaustedError || error.code === 'GEMINI_MODELS_EXHAUSTED') {
      return res.status(503).json({
        error: 'AI analysis is temporarily unavailable due to rate limits. Please try again in a few minutes.'
      });
    }

    next(error);
  }
});
