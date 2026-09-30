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
    // Achtung: die Modell-IDs sind exakt so zu schreiben, ohne Datums-Suffix.
    // `sampling` = false bedeutet: das Modell weist ein mitgesendetes
    // temperature mit HTTP 400 ab. `effort` = false: kein output_config.effort.
    models: [
      { id: 'claude-opus-5-5', label: 'Opus 5.5', sampling: false, effort: true },
      { id: 'claude-opus-5', label: 'Opus 5', sampling: false, effort: true },
      { id: 'claude-sonnet-5-5', label: 'Sonnet 5.5', sampling: false, effort: true },
      { id: 'claude-haiku-4-5', label: 'Haiku 4.5', sampling: true, effort: false }
    ]
  },
  {
    id: 'gemini',
    label: 'GEMINI',
    vendor: 'Google',
    keyField: 'google',
    models: [
      { id: 'gemini-2.5-pro', label: '2.5 Pro', sampling: true, effort: false },
      { id: 'gemini-2.5-flash', label: '2.5 Flash', sampling: true, effort: false }
    ]
  }
];

export const PROVIDER_BY_ID = Object.fromEntries(PROVIDERS.map((p) => [p.id, p]));

export function defaultModelFor(providerId) {
  return PROVIDER_BY_ID[providerId]?.models[0].id ?? null;
}

/** Eigenschaften eines Modells, unabhängig vom Anbieter. */
export function modelTraits(providerId, modelId) {
  const model = PROVIDER_BY_ID[providerId]?.models.find((m) => m.id === modelId);
  return { sampling: model?.sampling ?? true, effort: model?.effort ?? false };
}
