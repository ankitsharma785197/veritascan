import pdfParse from 'pdf-parse';
import sharp from 'sharp';
import { generateGeminiAnalysis } from './gemini.js';

// Diagnosis: PDF scans were missing obvious edits because the PDF path depended almost entirely on Gemini,
// had no local metadata/text-density heuristics, and over-calibrated weak-only tampering signals into
// LIKELY_AUTHENTIC. Indicators were stored and returned correctly; the main failure was suppressed evidence.
const aiSignatures = {
  'DALL-E': ['DALL-E', 'OpenAI', 'chatgpt'],
  Google: ['Google', 'Imagen', 'SynthID'],
  Midjourney: ['Midjourney', 'midjourney.com'],
  'Stable Diffusion': ['Stable Diffusion', 'Automatic1111', 'ComfyUI', 'sd-scripts'],
  'Adobe/C2PA': ['c2pa', 'adobe:c2pa']
};

const suspiciousResolutions = new Set(['1024x1024', '1024x1792', '1792x1024', '896x1152', '1152x896']);
const monthNumbers = {
  january: 0,
  february: 1,
  march: 2,
  april: 3,
  may: 4,
  june: 5,
  july: 6,
  august: 7,
  september: 8,
  october: 9,
  november: 10,
  december: 11
};

function clampConfidence(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 50;
  return Math.max(0, Math.min(100, Math.round(numeric)));
}

function normalizeSeverity(value) {
  return ['low', 'medium', 'high'].includes(value) ? value : 'medium';
}

function normalizeGeminiResult(result, fallbackExplanation) {
  const parsed = result.parsed || {};
  const indicators = Array.isArray(parsed.indicators)
    ? parsed.indicators.map((item) => ({
        label: String(item.label || 'Gemini finding').slice(0, 80),
        severity: normalizeSeverity(item.severity),
        detail: String(item.detail || '').slice(0, 500)
      }))
    : [];

  return {
    verdict: ['LIKELY_AI_OR_EDITED', 'LIKELY_AUTHENTIC', 'INCONCLUSIVE'].includes(parsed.verdict)
      ? parsed.verdict
      : 'INCONCLUSIVE',
    confidence: clampConfidence(parsed.confidence),
    explanation: String(parsed.explanation || fallbackExplanation).slice(0, 1200),
    indicators,
    raw: result.text,
    usedModel: result.usedModel || result.model
  };
}

function parseDmyDate(value) {
  const match = String(value).match(/\b(\d{1,2})[-/](\d{1,2})[-/](\d{4})\b/);
  if (!match) return null;

  const [, day, month, year] = match;
  const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
  return Number.isNaN(date.getTime()) ? null : date;
}

function parseIsoDate(value) {
  const match = String(value).match(/\b(\d{4})-(\d{2})-(\d{2})\b/);
  if (!match) return null;

  const [, year, month, day] = match;
  const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
  return Number.isNaN(date.getTime()) ? null : date;
}

function hasActualFutureDate(text) {
  const today = new Date();
  const todayUtc = new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()));
  const dmyMatches = String(text).match(/\b\d{1,2}[-/]\d{1,2}[-/]\d{4}\b/g) || [];
  const isoMatches = String(text).match(/\b\d{4}-\d{2}-\d{2}\b/g) || [];
  const hasDmyFutureDate = dmyMatches.some((value) => {
    const date = parseDmyDate(value);
    return date && date > todayUtc;
  });
  const hasIsoFutureDate = isoMatches.some((value) => {
    const date = parseIsoDate(value);
    return date && date > todayUtc;
  });

  if (hasDmyFutureDate || hasIsoFutureDate) return true;

  const monthMatches = String(text).toLowerCase().matchAll(
    /\b(january|february|march|april|may|june|july|august|september|october|november|december)\s+(\d{4})\b/g
  );

  for (const match of monthMatches) {
    const monthDate = new Date(Date.UTC(Number(match[2]), monthNumbers[match[1]], 1));
    if (monthDate > todayUtc) return true;
  }

  return false;
}

function mentionsDateAnomaly(indicator) {
  const text = `${indicator.label || ''} ${indicator.detail || ''}`.toLowerCase();
  return (
    text.includes('future date') ||
    text.includes('future dates') ||
    text.includes('anachronistic') ||
    text.includes('anomalous date') ||
    text.includes('anomalous future')
  );
}

function hasUnverifiedFutureDateClaim(text) {
  return (
    /future date|future dates|anachronistic|anomalous future|metadata manipulation/i.test(String(text)) &&
    !hasActualFutureDate(text)
  );
}

function calibrateImageResult(gemini) {
  const indicators = gemini.indicators.filter((indicator) => {
    if (!mentionsDateAnomaly(indicator)) return true;
    return hasActualFutureDate(`${indicator.label || ''} ${indicator.detail || ''}`);
  });

  if (gemini.verdict === 'LIKELY_AI_OR_EDITED' && gemini.indicators.length > 0 && indicators.length === 0) {
    return {
      ...gemini,
      verdict: 'LIKELY_AUTHENTIC',
      confidence: Math.min(gemini.confidence, 70),
      explanation:
        'No current-date conflict was found. The date-based concern was removed because the detected date is not in the future.',
      indicators
    };
  }

  if (indicators.length !== gemini.indicators.length) {
    return {
      ...gemini,
      confidence: Math.min(gemini.confidence, 78),
      indicators
    };
  }

  return gemini;
}

function isWeakPdfSignal(indicator) {
  const text = `${indicator.label || ''} ${indicator.detail || ''}`.toLowerCase();
  return (
    text.includes('font') ||
    text.includes('text layer') ||
    text.includes('out-of-order') ||
    text.includes('appended') ||
    text.includes('metadata') ||
    text.includes('layout') ||
    text.includes('alignment') ||
    text.includes('kerning') ||
    text.includes('baseline') ||
    text.includes('object ordering') ||
    text.includes('xref') ||
    text.includes('producer') ||
    text.includes('creator')
  );
}

function isStrongPdfTamperingSignal(indicator) {
  const text = `${indicator.label || ''} ${indicator.detail || ''}`.toLowerCase();
  return (
    text.includes('logical contradiction') ||
    text.includes('contradiction') ||
    text.includes('impossible') ||
    text.includes('overwritten') ||
    text.includes('visible text differs') ||
    text.includes('visual text differs') ||
    text.includes('mismatch between visible') ||
    text.includes('image-over-text') ||
    text.includes('image over text') ||
    text.includes('cloned') ||
    text.includes('copy-paste') ||
    text.includes('structural anomaly') ||
    text.includes('repeat semester') ||
    text.includes('backlog') ||
    text.includes('sgpa')
  );
}

function isUnverifiedChronologyConcern(indicator) {
  return String(indicator.label || '').toLowerCase() === 'unverified chronology concern';
}

function calibratePdfResult(gemini) {
  const hasFalseFutureClaim = hasUnverifiedFutureDateClaim(gemini.explanation);
  const indicators = gemini.indicators
    .map((indicator) => {
      if (mentionsDateAnomaly(indicator) && !hasActualFutureDate(`${indicator.label || ''} ${indicator.detail || ''}`)) {
        return {
          ...indicator,
          label: 'Unverified chronology concern',
          severity: 'low',
          detail: 'Gemini flagged a chronology concern, but no date in this finding is after the current date. This is not treated as future-date evidence.'
        };
      }

      if (isWeakPdfSignal(indicator) && !isStrongPdfTamperingSignal(indicator)) {
        return { ...indicator, severity: 'low' };
      }
      return indicator;
    });

  const hasStrongSignal = indicators.some(isStrongPdfTamperingSignal);
  const hasAnySignal = indicators.length > 0;
  const hasOnlyUnverifiedChronology = indicators.length > 0 && indicators.every(isUnverifiedChronologyConcern);
  const isNonAuthentic = gemini.verdict !== 'LIKELY_AUTHENTIC';
  const verdict = hasFalseFutureClaim && hasOnlyUnverifiedChronology && isNonAuthentic ? 'INCONCLUSIVE' : gemini.verdict;

  return {
    ...gemini,
    verdict,
    explanation: hasFalseFutureClaim
      ? 'A chronology concern returned by Gemini was corrected because the referenced date is not in the future. Review the remaining indicators for actual metadata, text-layer, or structural evidence.'
      : gemini.explanation,
    confidence: hasOnlyUnverifiedChronology
      ? Math.min(gemini.confidence, 55)
      : hasStrongSignal || (isNonAuthentic && gemini.confidence >= 40)
      ? gemini.confidence
      : hasAnySignal
        ? Math.min(gemini.confidence, 78)
        : gemini.confidence,
    indicators
  };
}

function parsePdfDate(value) {
  if (!value) return null;

  const match = String(value).match(/D:?(\d{4})(\d{2})?(\d{2})?(\d{2})?(\d{2})?(\d{2})?/);
  if (!match) return null;

  const [, year, month = '01', day = '01', hour = '00', minute = '00', second = '00'] = match;
  const date = new Date(Date.UTC(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hour),
    Number(minute),
    Number(second)
  ));

  return Number.isNaN(date.getTime()) ? null : date;
}

function normalizePdfInfoValue(value) {
  return String(value || '').trim();
}

function buildLocalPdfIndicators({ metadata, extractedText }) {
  const indicators = [];
  const info = metadata.info || {};
  const pages = Math.max(Number(metadata.pages) || 0, 1);
  const creationDate = parsePdfDate(info.CreationDate);
  const modDate = parsePdfDate(info.ModDate);

  if (creationDate && modDate) {
    const differenceMinutes = Math.abs(modDate.getTime() - creationDate.getTime()) / 60000;
    if (differenceMinutes > 5) {
      indicators.push({
        label: 'Metadata date mismatch',
        severity: 'low',
        detail: `PDF modification time differs from creation time by about ${Math.round(differenceMinutes)} minutes, which can indicate post-generation editing.`
      });
    }
  }

  const producer = normalizePdfInfoValue(info.Producer);
  const creator = normalizePdfInfoValue(info.Creator);
  const toolText = `${producer} ${creator}`.toLowerCase();

  if (!producer || /^unknown$/i.test(producer) || !creator || /^unknown$/i.test(creator)) {
    indicators.push({
      label: 'Incomplete producer metadata',
      severity: 'low',
      detail: 'The PDF producer or creator metadata is missing or marked unknown, reducing provenance confidence.'
    });
  } else if (/(acrobat|photoshop|illustrator|canva|libreoffice|pdf-xchange|foxit|sejda|smallpdf|ilovepdf)/i.test(toolText)) {
    indicators.push({
      label: 'Editing-oriented PDF tool',
      severity: 'low',
      detail: `The PDF metadata references "${[producer, creator].filter(Boolean).join(' / ')}", which can be associated with manual document editing.`
    });
  }

  const textPerPage = extractedText.length / pages;
  if (textPerPage < 100) {
    indicators.push({
      label: 'Low text-to-page ratio',
      severity: 'medium',
      detail: `Only about ${Math.round(textPerPage)} extractable text characters per page were found, which can indicate flattened content or image-over-text tampering.`
    });
  }

  return indicators;
}

async function inspectImage(buffer, mimeType) {
  const image = sharp(buffer, { failOn: 'none' });
  const metadata = await image.metadata();
  const lowerBytes = buffer.toString('latin1').toLowerCase();
  const indicators = [];

  for (const [generator, signatures] of Object.entries(aiSignatures)) {
    if (signatures.some((signature) => lowerBytes.includes(signature.toLowerCase()))) {
      indicators.push({
        label: 'Embedded AI signature',
        severity: 'high',
        detail: `${generator} marker was found in the file bytes.`
      });
    }
  }

  if (!metadata.exif && !metadata.icc && !metadata.xmp) {
    indicators.push({
      label: 'Sparse metadata',
      severity: 'low',
      detail: 'No EXIF, ICC, or XMP profile was found. This can happen after editing or export.'
    });
  }

  const resolution = `${metadata.width || 0}x${metadata.height || 0}`;
  if (suspiciousResolutions.has(resolution)) {
    indicators.push({
      label: 'Common AI canvas size',
      severity: 'medium',
      detail: `${resolution} is a common generated-image resolution.`
    });
  }

  const today = new Date().toISOString().slice(0, 10);
  const prompt = `Analyze this image for AI generation, deepfake, or tampering artifacts.
Current date for date checks is ${today}. Do not call any date "future" or "anachronistic" unless it is after ${today}.
Return only valid JSON with:
{
  "verdict": "LIKELY_AI_OR_EDITED" | "LIKELY_AUTHENTIC" | "INCONCLUSIVE",
  "confidence": 0-100,
  "explanation": "1-3 concise sentences",
  "indicators": [{"label":"short label","severity":"low|medium|high","detail":"specific visual reason"}]
}
Focus on physical, semantic, anatomical, lighting, reflection, text, and compositing inconsistencies.
Important calibration rules:
- Screenshots and downloaded chat images often have stripped metadata; do not mark edited from missing EXIF alone.
- Chat screenshots can contain old dates. Past dates are normal evidence of message history, not fabrication.
- Do not mark LIKELY_AI_OR_EDITED from dates unless the visible date is after ${today} or there is another strong visual tampering signal.
- Do not overclaim from compression or metadata alone.`;

  const gemini = calibrateImageResult(normalizeGeminiResult(
    await generateGeminiAnalysis({ prompt, fileBuffer: buffer, mimeType }),
    'Gemini analysis was inconclusive.'
  ));

  const allIndicators = [...indicators, ...gemini.indicators];
  const forcedAi = indicators.some((item) => item.severity === 'high');

  return {
    fileKind: 'image',
    verdict: forcedAi ? 'LIKELY_AI_OR_EDITED' : gemini.verdict,
    confidence: forcedAi ? Math.max(gemini.confidence, 90) : gemini.confidence,
    explanation: forcedAi
      ? `${indicators.find((item) => item.severity === 'high').detail} ${gemini.explanation}`
      : gemini.explanation,
    indicators: allIndicators,
    metadata: {
      width: metadata.width,
      height: metadata.height,
      format: metadata.format,
      space: metadata.space,
      hasExif: Boolean(metadata.exif),
      hasXmp: Boolean(metadata.xmp),
      hasIcc: Boolean(metadata.icc)
    },
    geminiModel: gemini.usedModel,
    geminiRaw: gemini.raw
  };
}

async function inspectPdf(buffer) {
  let parsedPdf = {};
  let extractionError = '';
  try {
    parsedPdf = await pdfParse(buffer);
  } catch (error) {
    extractionError = error.message || 'PDF text extraction failed.';
  }

  const extractedText = (parsedPdf.text || '').replace(/\s+/g, ' ').trim();
  const metadata = {
    pages: parsedPdf.numpages || 0,
    info: parsedPdf.info || {},
    hasExtractableText: extractedText.length > 0,
    extractedTextLength: extractedText.length,
    extractionError
  };
  const localIndicators = buildLocalPdfIndicators({ metadata, extractedText });

  const today = new Date().toISOString().slice(0, 10);
  const prompt = `Analyze this PDF for document tampering and OCR/text-layer mismatch.
Current date for date checks is ${today}. Do not call a date "future" unless it is after ${today}.
PDF metadata extracted by the server:
${JSON.stringify(metadata.info || {}, null, 2).slice(0, 4000)}

The server extracted this embedded text layer. Use it even if it is short, sparse, or empty:
"""${extractedText ? extractedText.slice(0, 12000) : '[NO EXTRACTABLE PDF TEXT FOUND]'}"""

Return only valid JSON with:
{
  "verdict": "LIKELY_AI_OR_EDITED" | "LIKELY_AUTHENTIC" | "INCONCLUSIVE",
  "confidence": 0-100,
  "explanation": "1-3 concise sentences",
  "indicators": [{"label":"short label","severity":"low|medium|high","detail":"specific reason"}]
}
Compare visible page content against the embedded text layer where possible. Explicitly check for:
- Font inconsistencies, including mixed fonts, synthetic fonts, unusual font embedding, and font substitutions.
- Text alignment anomalies, including irregular spacing, kerning, baseline shifts, changed line height, or pasted text that does not align with surrounding content.
- Layer inconsistencies, including objects added on top of existing content, new text layers above original content, and image blocks placed over text.
- Metadata contradictions, including creation date versus modification date mismatches, producer/creator tool mismatches, or editing-tool traces.
- Copy-paste artifacts, including repeated object IDs, cloned visual elements, duplicated text fragments, and inconsistent object reuse.
- Image-over-text tampering, including flattened image regions covering original text or mismatches between visible text and embedded text.
- Structural anomalies in object ordering, incremental updates, appended objects, cross-reference tables, and out-of-order content streams.
- AI-generated text patterns in the text layer, including generic phrasing, impossible values, or semantic inconsistencies.
Important calibration rules:
- Low-confidence signals must still be returned in indicators; do not omit font, alignment, metadata, text-layer, or structural concerns just because they are weak.
- Official university, bank, invoice, and government PDFs can have mixed fonts, overlays, and non-sequential text objects. Mark those as low severity unless they combine with stronger contradictions.
- Return INCONCLUSIVE, not LIKELY_AUTHENTIC, when there are weak but meaningful tampering indicators.
- Return LIKELY_AI_OR_EDITED when there is strong evidence such as visible text differing from extracted text, overwritten values, inconsistent totals, impossible academic results, contradictory pass/fail/backlog/SGPA fields, image-over-text replacement, or clear visual splicing.`;

  const gemini = calibratePdfResult(normalizeGeminiResult(
    await generateGeminiAnalysis({ prompt, fileBuffer: buffer, mimeType: 'application/pdf' }),
    'Gemini PDF analysis was inconclusive.'
  ));

  const indicators = [...localIndicators, ...gemini.indicators];
  if (!metadata.hasExtractableText) {
    indicators.unshift({
      label: 'No extractable text layer',
      severity: 'medium',
      detail: 'The PDF appears image-only or flattened, so OCR-style visual review is required.'
    });
  }

  if (extractionError) {
    indicators.unshift({
      label: 'PDF text extraction failed',
      severity: 'medium',
      detail: extractionError
    });
  }

  const hasHighIndicator = indicators.some((indicator) => indicator.severity === 'high');
  const hasMediumIndicator = indicators.some((indicator) => indicator.severity === 'medium');
  const hasOnlyLowIndicators = indicators.length > 0 && indicators.every((indicator) => indicator.severity === 'low');
  const hasLocalEvidence = localIndicators.length > 0;
  let verdict = gemini.verdict;
  let confidence = gemini.confidence;
  let explanation = gemini.explanation;

  if (gemini.verdict === 'LIKELY_AUTHENTIC' && (hasHighIndicator || hasMediumIndicator || hasOnlyLowIndicators)) {
    verdict = hasHighIndicator ? 'LIKELY_AI_OR_EDITED' : 'INCONCLUSIVE';
    confidence = hasHighIndicator ? Math.max(confidence, 70) : hasMediumIndicator ? Math.max(Math.min(confidence, 68), 52) : Math.max(Math.min(confidence, 60), 42);
    explanation = hasLocalEvidence
      ? 'Local PDF heuristics found provenance, text-density, or metadata signals that prevent a clean authenticity verdict.'
      : 'Gemini returned weak tampering indicators, so the result is treated as inconclusive instead of cleanly authentic.';
  }

  return {
    fileKind: 'pdf',
    verdict,
    confidence,
    explanation,
    indicators,
    metadata,
    pdfText: extractedText.slice(0, 20000),
    geminiModel: gemini.usedModel,
    geminiRaw: gemini.raw
  };
}

export async function analyzeFile({ buffer, mimeType }) {
  if (mimeType === 'application/pdf') {
    return inspectPdf(buffer);
  }

  if (mimeType.startsWith('image/')) {
    return inspectImage(buffer, mimeType);
  }

  throw new Error('Unsupported file type. Upload an image or PDF.');
}
