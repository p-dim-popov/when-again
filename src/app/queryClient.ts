import { QueryClient } from '@tanstack/react-query';

// Local IndexedDB is the source of truth; there is no server to poll. Data is
// never "stale" until we invalidate it explicitly after a mutation.
export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: Infinity,
        gcTime: Infinity,
        retry: false,
        refetchOnWindowFocus: false,
      },
    },
  });
}
