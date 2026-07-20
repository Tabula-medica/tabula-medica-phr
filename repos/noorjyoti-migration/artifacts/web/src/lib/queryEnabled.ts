// Helper for orval-generated react-query hooks where the typed UseQueryOptions
// requires a `queryKey` even though the hook supplies its own. This lets callers
// pass just `{ enabled }` without resorting to inline `as never` casts.
export function enabledWhen(enabled: boolean) {
  return { enabled } as { enabled: boolean; queryKey: never };
}
