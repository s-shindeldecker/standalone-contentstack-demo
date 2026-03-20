# LaunchDarkly + Contentstack: Content Flag Demo

A minimal, self-contained example showing how to use **LaunchDarkly JSON feature flags** to dynamically serve **Contentstack** content. Change a flag in LaunchDarkly and watch the page update in real time — no deploy, no code change.

## How it works

```
┌──────────────┐  streams flag   ┌───────────────┐  POST /api/content  ┌───────────────┐
│ LaunchDarkly │ ──────────────> │  React App    │ ──────────────────> │ Express API   │
│  (cloud)     │   (SSE)        │  (browser)    │                     │ (localhost)   │
└──────────────┘                └───────────────┘                     └───────┬───────┘
                                       ▲                                      │
                                       │  normalized content                  │ GET /v3/...
                                       │  { title, imageUrl, html, ... }      ▼
                                       │                              ┌───────────────┐
                                       └──────────────────────────────│ Contentstack  │
                                                                      │  CDN API      │
                                                                      └───────────────┘
```

1. The React app wraps itself in the LaunchDarkly React SDK (`LDProvider`).
2. The SDK opens a streaming connection and delivers the current value of a JSON flag called `content-config`.
3. The flag value is a **CMSReference** — a small JSON object that points to a Contentstack entry or asset.
4. The app sends that reference to a local Express API server.
5. The API server authenticates with Contentstack using credentials from environment variables, fetches the content, and returns a normalized object the frontend can render.
6. When you change the flag in LaunchDarkly (different variation, different targeting rule, etc.), the SDK streams the update and the page re-renders automatically.

## Prerequisites

- **Node.js 18+**
- A **LaunchDarkly** account (free trial works)
- A **Contentstack** account with at least one published entry or asset

## Setup

```bash
# 1. Install dependencies
npm install

# 2. Create your environment file
cp .env.example .env

# 3. Fill in your credentials (see below)
#    Then start both the API server and the React dev server:
npm run dev
```

The app opens at **http://localhost:5173**. The Express API runs on port 3001; Vite proxies `/api` requests to it automatically.

### Environment variables

| Variable | Where to find it |
|---|---|
| `CONTENTSTACK_API_KEY` | Contentstack → Settings → Stack → API Credentials |
| `CONTENTSTACK_DELIVERY_TOKEN` | Contentstack → Settings → Tokens → Delivery Tokens |
| `CONTENTSTACK_ENVIRONMENT` | The Contentstack environment name (e.g. `preview`, `production`) |
| `VITE_LAUNCHDARKLY_CLIENT_ID` | LaunchDarkly → Account settings → Projects → your project → Environment → Client-side ID |

## LaunchDarkly flag setup

1. In your LaunchDarkly project, click **Create flag**.
2. Set the flag key to **`content-config`**.
3. Choose **JSON** as the flag type.
4. Add one or more **variations**, each containing a CMSReference object (see schema below).
5. Turn the flag **On** and set a default rule to serve one of your variations.

### CMSReference schema

Each flag variation value should be a JSON object with these fields:

```json
{
  "cmsType": "contentstack",
  "entryId": "blt...",
  "environment": "preview",
  "contentType": "page"
}
```

| Field | Required | Description |
|---|---|---|
| `cmsType` | Yes | Must be `"contentstack"`. |
| `entryId` | Yes | The Contentstack entry UID (starts with `blt`). For assets, use the asset UID. |
| `environment` | Yes | The Contentstack environment to fetch from (e.g. `preview`, `production`). |
| `contentType` | No | The content type UID (e.g. `page`, `blog_post`). Set to `"asset"` for assets. If omitted for entries, the API auto-discovers it. |

### Example variations

**A content entry:**
```json
{
  "cmsType": "contentstack",
  "entryId": "blt0f6ddaddb7222b8d",
  "environment": "preview",
  "contentType": "page"
}
```

**An image asset:**
```json
{
  "cmsType": "contentstack",
  "entryId": "bltbba25137ffbcb167",
  "environment": "preview",
  "contentType": "asset"
}
```

## API reference

The Express server exposes a single endpoint.

### `POST /api/content`

**Request body** — a CMSReference object:

```json
{
  "cmsType": "contentstack",
  "entryId": "blt0f6ddaddb7222b8d",
  "environment": "preview",
  "contentType": "page"
}
```

**Success response** (200):

```json
{
  "title": "Welcome to Our Site",
  "summary": "An introductory page...",
  "imageUrl": "https://images.contentstack.io/v3/assets/.../image.jpg",
  "html": "<h1>Welcome</h1><p>...</p>",
  "structuredData": { "...full Contentstack entry..." }
}
```

**Error response** (4xx / 5xx):

```json
{
  "error": "Contentstack entry fetch failed: HTTP 404"
}
```

## Project structure

```
standalone-demo/
├── server.js            Express API — fetches content from Contentstack
├── src/
│   ├── main.tsx         React entry point — wraps app in LDProvider
│   ├── App.tsx          Reads the LD flag, calls the API, renders content
│   └── index.css        Tailwind CSS directives
├── index.html           HTML shell
├── vite.config.ts       Vite config with /api proxy to Express
├── .env.example         Template for required credentials
├── package.json         Dependencies and scripts
└── tailwind.config.js   Tailwind configuration
```

## Adapting for your own use

- **Different flag key**: Change `flags['contentConfig']` in `src/App.tsx` to match your flag. Remember the SDK camelCases keys (`my-flag` becomes `myFlag`).
- **Different CMS**: Replace the Contentstack fetch logic in `server.js` with calls to your CMS API. Keep the same normalized response shape so the frontend works without changes.
- **User targeting**: Update the `context` object in `src/main.tsx` with real user attributes so LaunchDarkly can target different content to different users.
- **Production deployment**: In production you would typically deploy the API as a serverless function (Vercel, AWS Lambda, etc.) and build the React app with `npm run build`.
