import { fetchWithRetry, readSSE } from './http.js';

const BASE = 'https://generativelanguage.googleapis.com/v1beta/models';
const VENDOR = 'Gemini';

function body(request) {
  return JSON.stringify({
    systemInstruction: { parts: [{ text: request.system }] },
    contents: [{ role: 'user', parts: [{ text: request.user }] }],
    generationConfig: {
      temperature: request.temperature ?? 1,
      maxOutputTokens: request.maxTokens ?? 1024
    }
  });
}

function textOf(candidate) {
  return (candidate?.content?.parts ?? []).map((part) => part.text ?? '').join('');
}

/** Google Gemini generateContent, optional als SSE-Stream. */
export async function callGemini(request, apiKey, { signal, onDelta, onRetry } = {}) {
  const stream = typeof onDelta === 'function';
  const method = stream ? 'streamGenerateContent?alt=sse' : 'generateContent';
  const url = `${BASE}/${encodeURIComponent(request.model)}:${method}`;

  const response = await fetchWithRetry(
    url,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-goog-api-key': apiKey },
      body: body(request)
    },
    { signal, vendor: VENDOR, onRetry }
  );

  if (!stream) {
    const data = await response.json();
    const candidate = data.candidates?.[0];
    if (!candidate) throw new Error('Gemini: keine Antwort erhalten (evtl. Safety-Filter)');
    return textOf(candidate).trim();
  }

  let text = '';
  await readSSE(
    response,
    (event) => {
      const chunk = textOf(event.candidates?.[0]);
      if (chunk) {
        text += chunk;
        onDelta(text);
      }
    },
    signal
  );
  if (!text) throw new Error('Gemini: leerer Stream (evtl. Safety-Filter)');
  return text.trim();
}
