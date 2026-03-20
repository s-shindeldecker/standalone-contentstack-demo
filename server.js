/**
 * Local API server that bridges LaunchDarkly flag values to Contentstack content.
 *
 * The React frontend reads a JSON feature flag from LaunchDarkly that contains a
 * "CMSReference" — a pointer to a Contentstack entry or asset. It sends that
 * reference here, and this server fetches the actual content from the Contentstack
 * Content Delivery API, returning a normalized preview object the frontend can render.
 */

import 'dotenv/config';
import express from 'express';
import cors from 'cors';

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json());

// ---------------------------------------------------------------------------
// Configuration — loaded once from environment variables
// ---------------------------------------------------------------------------

const CONTENTSTACK_CONFIG = {
  apiKey:        process.env.CONTENTSTACK_API_KEY,
  deliveryToken: process.env.CONTENTSTACK_DELIVERY_TOKEN,
  environment:   process.env.CONTENTSTACK_ENVIRONMENT,
};

const BASE_URL = 'https://cdn.contentstack.io/v3';

function contentstackHeaders() {
  return {
    api_key:      CONTENTSTACK_CONFIG.apiKey,
    access_token: CONTENTSTACK_CONFIG.deliveryToken,
    'Content-Type': 'application/json',
  };
}

// ---------------------------------------------------------------------------
// POST /api/content  —  Resolve a CMSReference to renderable content
// ---------------------------------------------------------------------------

app.post('/api/content', async (req, res) => {
  const ref = req.body;

  if (!ref?.entryId || !ref?.environment) {
    return res.status(400).json({ error: 'Missing required fields: entryId, environment' });
  }

  if (ref.cmsType && ref.cmsType !== 'contentstack') {
    return res.status(400).json({ error: 'Only cmsType "contentstack" is supported' });
  }

  try {
    const preview = ref.contentType === 'asset'
      ? await fetchAsset(ref)
      : await fetchEntry(ref);

    return res.json(preview);
  } catch (err) {
    console.error('Error fetching content:', err.message);
    return res.status(502).json({ error: err.message });
  }
});

// ---------------------------------------------------------------------------
// Contentstack fetchers
// ---------------------------------------------------------------------------

async function fetchAsset({ entryId, environment }) {
  const url = `${BASE_URL}/assets/${entryId}?environment=${environment}`;
  const response = await fetch(url, { headers: contentstackHeaders() });

  if (!response.ok) throw new Error(`Contentstack asset fetch failed: HTTP ${response.status}`);

  const { asset } = await response.json();

  return {
    title:    asset.title || asset.filename,
    summary:  `Asset: ${asset.filename}`,
    imageUrl: asset.url,
    structuredData: asset,
  };
}

async function fetchEntry({ entryId, environment, contentType }) {
  // Resolve content type if the flag variation didn't specify one
  const resolvedType = contentType || await discoverContentType(entryId);
  if (!resolvedType) throw new Error('Could not resolve content type for this entry');

  const url = `${BASE_URL}/content_types/${resolvedType}/entries/${entryId}?environment=${environment}`;
  const response = await fetch(url, { headers: contentstackHeaders() });

  if (!response.ok) throw new Error(`Contentstack entry fetch failed: HTTP ${response.status}`);

  const { entry } = await response.json();

  return {
    title:    entry.title || 'Untitled',
    summary:  entry.summary || '',
    html:     entry.body || '',
    imageUrl: entry.image?.url,
    structuredData: entry,
  };
}

/**
 * Auto-discover which content type owns a given entry ID by iterating over
 * all content types and probing for the entry in each one.
 */
async function discoverContentType(entryId) {
  const typesUrl = `${BASE_URL}/content_types?environment=${CONTENTSTACK_CONFIG.environment}`;
  const typesRes = await fetch(typesUrl, { headers: contentstackHeaders() });

  if (!typesRes.ok) return null;

  const { content_types } = await typesRes.json();

  for (const ct of content_types) {
    const probeUrl = `${BASE_URL}/content_types/${ct.uid}/entries/${entryId}?environment=${CONTENTSTACK_CONFIG.environment}`;
    const probeRes = await fetch(probeUrl, { headers: contentstackHeaders() });
    if (probeRes.ok) return ct.uid;
  }

  return null;
}

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------

app.listen(PORT, () => {
  const missing = ['apiKey', 'deliveryToken', 'environment']
    .filter(k => !CONTENTSTACK_CONFIG[k]);

  if (missing.length) {
    console.warn(`WARNING: Missing Contentstack config: ${missing.join(', ')}. Copy .env.example to .env and fill in your credentials.`);
  }

  console.log(`API server running at http://localhost:${PORT}`);
});
