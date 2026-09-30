/**
 * Provider-Registry auf Domain-Ebene: welche KI-Modelle pro Block wählbar
 * sind. Die konkreten HTTP-Aufrufe liegen in services/providers/*.
 */
export const PROVIDERS = [
  {
    id: 'claude',
    label: 'CLAUDE',
    vendor: 'Anthropic',
    keyField: 'anthropic',
    models: [
      { id: 'claude-opus-5', label: 'Opus 5' },
      { id: 'claude-sonnet-5-5', label: 'Sonnet 5.5' },
      { id: 'claude-haiku-4-5-20251001', label: 'Haiku 4.5' }
    ]
  },
  {
    id: 'gemini',
    label: 'GEMINI',
    vendor: 'Google',
    keyField: 'google',
    models: [
      { id: 'gemini-2.5-pro', label: '2.5 Pro' },
      { id: 'gemini-2.5-flash', label: '2.5 Flash' }
    ]
  }
];

export const PROVIDER_BY_ID = Object.fromEntries(PROVIDERS.map((p) => [p.id, p]));

export function defaultModelFor(providerId) {
  return PROVIDER_BY_ID[providerId]?.models[0].id ?? null;
}
