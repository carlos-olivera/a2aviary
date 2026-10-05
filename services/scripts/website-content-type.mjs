const mime = { '.html': 'text/html; charset=utf-8', '.js': 'application/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/vnd.microsoft.icon', '.woff': 'font/woff', '.woff2': 'font/woff2', '.json': 'application/json', '.txt': 'text/plain; charset=utf-8', '.xml': 'application/xml; charset=utf-8' };

export function websiteContentType(key) {
  // The private S3 REST origin serves these exact objects without a rewrite.
  if (['costs', 'terms', 'privacy', 'refunds', 'pricing'].includes(key)) return mime['.html'];
  return mime[key.slice(key.lastIndexOf('.'))] ?? 'application/octet-stream';
}
