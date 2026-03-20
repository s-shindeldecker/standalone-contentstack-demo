import { useState, useEffect } from 'react';
import { useFlags } from 'launchdarkly-react-client-sdk';

/**
 * The shape returned by our local API after fetching from Contentstack.
 */
type ContentPreview = {
  title?: string;
  summary?: string;
  imageUrl?: string;
  html?: string;
  structuredData?: Record<string, unknown>;
};

export default function App() {
  const [content, setContent] = useState<ContentPreview | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Read the JSON flag value from LaunchDarkly.
  // The SDK automatically camelCases flag keys, so "content-config" → "contentConfig".
  const flags = useFlags();
  const contentConfig = flags['contentConfig'] as
    | { cmsType: string; entryId: string; environment: string; contentType?: string }
    | undefined;

  // Whenever LaunchDarkly streams a new flag value, fetch the matching content.
  useEffect(() => {
    if (!contentConfig) return;

    const fetchContent = async () => {
      setLoading(true);
      setError(null);

      try {
        const res = await fetch('/api/content', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(contentConfig),
        });

        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || `API returned ${res.status}`);
        }

        setContent(await res.json());
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    };

    fetchContent();
  }, [contentConfig]);

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  return (
    <div className="max-w-3xl mx-auto p-8 min-h-screen bg-gray-50">
      <header className="mb-8">
        <h1 className="text-3xl font-bold text-gray-800">
          LaunchDarkly + Contentstack Demo
        </h1>
        <p className="text-gray-500 mt-1">
          Content is driven by the <code className="bg-gray-200 px-1.5 py-0.5 rounded text-sm">content-config</code> feature flag.
          Change the flag in LaunchDarkly and watch this page update in real time.
        </p>
      </header>

      {/* Flag status banner */}
      {!contentConfig && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 mb-6 text-sm text-amber-800">
          <strong>No flag detected.</strong> Create a JSON flag named{' '}
          <code className="bg-amber-100 px-1 rounded">content-config</code> in
          LaunchDarkly with a CMSReference variation. See the README for details.
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-3" />
          <p className="text-gray-500">Loading content…</p>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="rounded-lg border border-red-300 bg-red-50 p-4 mb-6 text-sm text-red-800">
          <strong>Error:</strong> {error}
        </div>
      )}

      {/* Content */}
      {content && !loading && (
        <article className="bg-white rounded-lg shadow overflow-hidden">
          {content.imageUrl && (
            <img
              src={content.imageUrl}
              alt={content.title || ''}
              className="w-full h-56 object-cover"
            />
          )}

          <div className="p-6 space-y-4">
            {content.title && (
              <h2 className="text-2xl font-bold text-gray-800">{content.title}</h2>
            )}

            {content.summary && (
              <p className="text-gray-600 text-lg leading-relaxed">{content.summary}</p>
            )}

            {content.html && (
              <div
                className="prose prose-lg max-w-none"
                dangerouslySetInnerHTML={{ __html: content.html }}
              />
            )}

            {/* Modular blocks (if the Contentstack entry uses them) */}
            {Array.isArray((content.structuredData as any)?.blocks) && (
              <div className="space-y-4 mt-6">
                {((content.structuredData as any).blocks as any[]).map((block, i) => (
                  <div key={i} className="flex gap-4 border rounded-lg p-4 bg-gray-50">
                    {block.block?.image?.url && (
                      <img
                        src={block.block.image.url}
                        alt={block.block.title || ''}
                        className="w-20 h-20 rounded object-cover flex-shrink-0"
                      />
                    )}
                    <div>
                      {block.block?.title && (
                        <h3 className="font-semibold text-gray-800">{block.block.title}</h3>
                      )}
                      {block.block?.copy && (
                        <div
                          className="prose prose-sm max-w-none"
                          dangerouslySetInnerHTML={{ __html: block.block.copy }}
                        />
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </article>
      )}
    </div>
  );
}
