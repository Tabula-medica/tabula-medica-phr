/**
 * phr-api-proxy — Cloudflare Worker
 *
 * Proxies tabulamedica.us/api/* to the GCP Cloud Run PHR backend.
 *
 * WHY: tabulamedica.us DNS currently routes to the Base44 web frontend (216.24.57.1).
 * The native mobile app (tabula-phr-app v66.0+) sends all API calls to
 * tabulamedica.us/api/*, but the Base44 server returns 405 for those paths.
 * This Worker intercepts /api/* and proxies them to the GCP backend before Base44
 * ever sees the request. All other requests (/, /*.html, etc.) pass through to Base44.
 *
 * Deploy once via: wrangler deploy (from this directory)
 * Route is configured in wrangler.toml: tabulamedica.us/api/*
 */

const CLOUD_RUN_ORIGIN = 'https://tabula-medica-phr-e6p3nuwp4a-uc.a.run.app';

export default {
  async fetch(request) {
    const url = new URL(request.url);

    if (!url.pathname.startsWith('/api/')) {
      // Pass non-API requests through to the Base44 origin unchanged.
      return fetch(request);
    }

    const targetUrl = new URL(url.pathname + url.search, CLOUD_RUN_ORIGIN);

    const proxyRequest = new Request(targetUrl.toString(), {
      method: request.method,
      headers: request.headers,
      body: request.method !== 'GET' && request.method !== 'HEAD' ? request.body : null,
      redirect: 'follow',
      duplex: 'half',
    });

    return fetch(proxyRequest);
  },
};
