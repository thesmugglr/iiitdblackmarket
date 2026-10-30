import Fastify from 'fastify';
import type { HealthResponse } from '@iiitd/shared';

export function buildApp() {
  const app = Fastify({ logger: true });
  // Liveness only: does not claim database readiness or student verification.
  app.get<{ Reply: HealthResponse }>('/api/health', async () => ({
    status: 'ok', service: 'iiitd-api',
  }));
  return app;
}
