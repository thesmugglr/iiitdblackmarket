import type { HealthResponse } from '@iiitd/shared';

export async function getHealth(signal: AbortSignal): Promise<HealthResponse> {
  const response = await fetch('/api/health', { signal });
  if (!response.ok) throw new Error(`API returned ${response.status}`);
  return response.json() as Promise<HealthResponse>;
}
