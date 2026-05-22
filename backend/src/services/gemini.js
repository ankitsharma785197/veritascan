import { env } from '../config/env.js';

// Diagnosis: Gemini used a single configured model and surfaced raw non-2xx responses, so a 429 quota
// response failed the whole scan even when other free-tier Flash models still had quota available.
const DEFAULT_MODEL_FALLBACKS = ['gemini-2.5-flash-lite', 'gemini-2.0-flash'];
const ALLOWED_FREE_QUOTA_MODELS = new Set(['gemini-2.5-flash', 'gemini-2.5-flash-lite', 'gemini-2.0-flash']);
const primaryModel = ALLOWED_FREE_QUOTA_MODELS.has(env.geminiModel) ? env.geminiModel : 'gemini-2.5-flash';
const configuredFallbacks = env.geminiModelFallbacks.length ? env.geminiModelFallbacks : DEFAULT_MODEL_FALLBACKS;
const MODEL_FALLBACK_CHAIN = [...new Set([primaryModel, ...configuredFallbacks])]
  .filter((model) => ALLOWED_FREE_QUOTA_MODELS.has(model));

export class RateLimitError extends Error {
  constructor(message, retryAfterSeconds) {
    super(message);
    this.name = 'RateLimitError';
    this.status = 429;
    this.code = 429;
    this.retryAfter = retryAfterSeconds;
  }
}

export class GeminiModelsExhaustedError extends Error {
  constructor(lastError) {
    super(`All Gemini models exhausted quota. Last error: ${lastError?.message || 'No Gemini model accepted the request.'}`);
    this.name = 'GeminiModelsExhaustedError';
    this.status = 503;
    this.code = 'GEMINI_MODELS_EXHAUSTED';
    this.retryAfter = lastError?.retryAfter;
  }
}

function parseJsonFromText(text) {
  const fenced = text.match(/```json\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1] : text.match(/\{[\s\S]*\}/)?.[0];
  if (!candidate) return null;

  try {
    return JSON.parse(candidate);
  } catch {
    return null;
  }
}

function retryDelayFromErrorBody(body) {
  const retryInfo = body?.error?.details?.find((detail) => String(detail?.['@type'] || '').includes('RetryInfo'));
  const retryDelay = retryInfo?.retryDelay;
  if (!retryDelay) return undefined;

  const match = String(retryDelay).match(/^(\d+(?:\.\d+)?)s$/);
  return match ? Math.ceil(Number(match[1])) : undefined;
}

async function readJsonResponse(response) {
  try {
    return await response.json();
  } catch {
    return {};
  }
}

async function callGemini(model, requestBody) {
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-goog-api-key': env.geminiApiKey
    },
    body: JSON.stringify(requestBody)
  });

  const data = await readJsonResponse(response);

  if (!response.ok) {
    const message = data?.error?.message || `Gemini API error ${response.status}`;
    if (response.status === 429 || data?.error?.code === 429) {
      throw new RateLimitError(message, retryDelayFromErrorBody(data));
    }

    const error = new Error(`Gemini API error ${response.status}: ${message}`);
    error.status = response.status;
    error.body = data;
    throw error;
  }

  const text = data?.candidates?.[0]?.content?.parts?.map((part) => part.text || '').join('\n').trim() || '';
  return { text, parsed: parseJsonFromText(text), model };
}

async function callGeminiWithFallback(requestBody) {
  let lastError;

  for (let index = 0; index < MODEL_FALLBACK_CHAIN.length; index += 1) {
    const model = MODEL_FALLBACK_CHAIN[index];
    try {
      const result = await callGemini(model, requestBody);
      if (index > 0) {
        console.warn(`[Gemini] Primary quota exhausted, used fallback: ${model}`);
      } else {
        console.log(`[Gemini] Used model: ${model}`);
      }
      return { ...result, usedModel: model, usedFallback: index > 0 };
    } catch (error) {
      if (error.status === 429 || error.code === 429) {
        lastError = error;
        console.warn(`[Gemini] Rate limit hit for ${model}; trying next fallback.`);
        continue;
      }

      throw error;
    }
  }

  throw new GeminiModelsExhaustedError(lastError);
}

export async function generateGeminiAnalysis({ prompt, fileBuffer, mimeType }) {
  if (!env.geminiApiKey) {
    throw new Error('GEMINI_API_KEY is missing in .env');
  }

  const payload = {
    contents: [
      {
        parts: [
          { text: prompt },
          {
            inline_data: {
              mime_type: mimeType,
              data: fileBuffer.toString('base64')
            }
          }
        ]
      }
    ],
    generationConfig: {
      temperature: 0.2,
      responseMimeType: 'application/json'
    }
  };

  return callGeminiWithFallback(payload);
}
