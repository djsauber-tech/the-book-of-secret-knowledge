const ENDPOINT = 'https://api.anthropic.com/v1/messages';
const API_VERSION = '2023-06-01';

/**
 * Anthropic Messages API. Der Header anthropic-dangerous-direct-browser-access
 * ist nötig, weil der Aufruf direkt aus dem Browser kommt - das ist für eine
 * rein lokale Anwendung mit dem eigenen Key gedacht, nicht für ein Deployment.
 */
export async function callAnthropic(request, apiKey, { signal } = {}) {
  const response = await fetch(ENDPOINT, {
    method: 'POST',
    signal,
    headers: {
      'content-type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': API_VERSION,
      'anthropic-dangerous-direct-browser-access': 'true'
    },
    body: JSON.stringify({
      model: request.model,
      max_tokens: 1024,
      temperature: 1,
      system: request.system,
      messages: [{ role: 'user', content: request.user }]
    })
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new Error(`Anthropic ${response.status}: ${detail.slice(0, 400) || response.statusText}`);
  }

  const data = await response.json();
  return (data.content ?? [])
    .filter((part) => part.type === 'text')
    .map((part) => part.text)
    .join('\n')
    .trim();
}
