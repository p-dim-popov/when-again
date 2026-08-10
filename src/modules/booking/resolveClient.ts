/**
 * Resolves the client id to save, dropping the old hard requirement that a
 * client be explicitly picked first (#17-5). Order:
 *   1. an explicitly selected `clientId` wins;
 *   2. else an existing client whose name matches (case-insensitive) — never
 *      create a duplicate;
 *   3. else create a client from the typed name;
 *   4. else (empty name) → null, so the caller shows the required-field error.
 */
export async function resolveClientId(params: {
  clientId: string | null;
  name: string; // already trimmed
  clients: { id: string; name: string }[];
  createClient: (name: string) => Promise<{ id: string }>;
}): Promise<string | null> {
  const { clientId, name, clients, createClient } = params;
  if (clientId) return clientId;
  if (!name) return null;
  const existing = clients.find(
    (c) => c.name.toLowerCase() === name.toLowerCase(),
  );
  if (existing) return existing.id;
  const created = await createClient(name);
  return created.id;
}
