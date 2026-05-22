import mongoose from 'mongoose';

const scanSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    fileName: { type: String, required: true },
    mimeType: { type: String, required: true },
    fileSize: { type: Number, required: true },
    fileKind: { type: String, enum: ['image', 'pdf'], required: true },
    verdict: { type: String, enum: ['LIKELY_AI_OR_EDITED', 'LIKELY_AUTHENTIC', 'INCONCLUSIVE'], required: true },
    confidence: { type: Number, min: 0, max: 100, default: 0 },
    explanation: { type: String, required: true },
    indicators: [{ label: String, severity: String, detail: String }],
    metadata: mongoose.Schema.Types.Mixed,
    pdfText: { type: String, default: '' },
    geminiModel: { type: String },
    geminiRaw: { type: String, default: '' }
  },
  { timestamps: true }
);

export const Scan = mongoose.model('Scan', scanSchema);
