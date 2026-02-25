export function injectSecurityMeta(html, csp) {
  const enforcedCsp = csp ?? "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; connect-src 'self' https:; object-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'";

  let output = html;
  if (/<meta\b[^>]*http-equiv=[\"']Content-Security-Policy[\"'][^>]*>/i.test(output)) {
    output = output.replace(/<meta\b[^>]*http-equiv=[\"']Content-Security-Policy[\"'][^>]*>/gi, `  <meta http-equiv=\"Content-Security-Policy\" content=\"${enforcedCsp}\">`);
  } else {
    output = output.replace('</head>', `  <meta http-equiv=\"Content-Security-Policy\" content=\"${enforcedCsp}\">\n</head>`);
  }

  if (!/name=[\"']referrer[\"']/i.test(output)) {
    output = output.replace('</head>', '  <meta name="referrer" content="no-referrer">\n</head>');
  }

  return output;
}
