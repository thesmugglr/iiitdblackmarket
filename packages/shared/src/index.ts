// Type-only contracts shared by the browser and API. No secrets or server code.
export interface HealthResponse {
  status: 'ok';
  service: 'iiitd-api';
}
