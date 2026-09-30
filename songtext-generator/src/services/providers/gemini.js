const BASE = 'https://generativelanguage.googleapis.com/v1beta/models';

/** Google Gemini generateContent. Der System-Prompt geht als systemInstruction mit. */
export async function callGemini(request, apiKey, { signal } = {}) {
  const response = await fetch(`${BASE}/${encodeURIComponent(request.model)}:generateContent`, {
    method: 'POST',
    signal,
    headers: {
      'content-type': 'application/json',
      'x-goog-api-key': apiKey
    },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: request.system }] },
      contents: [{ role: 'user', parts: [{ text: request.user }] }],
      generationConfig: { temperature: 1, maxOutputTokens: 1024 }
    })
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new Error(`Gemini ${response.status}: ${detail.slice(0, 400) || response.statusText}`);
  }

  const data = await response.json();
  const candidate = data.candidates?.[0];
  if (!candidate) throw new Error('Gemini: keine Antwort erhalten (evtl. Safety-Filter)');
  return (candidate.content?.parts ?? [])
    .map((part) => part.text ?? '')
    .join('\n')
    .trim();
}
