type RouteContext = { params: Promise<{ path: string[] }> };

const loopbackHosts = new Set(['localhost', '127.0.0.1', '[::1]']);

async function proxy(request: Request, context: RouteContext): Promise<Response> {
  const backendUrl = process.env.DEV_API_PROXY_URL;

  if (process.env.NODE_ENV !== 'development' || !backendUrl) {
    return new Response(null, { status: 404 });
  }

  const localUrl = new URL(request.url);
  const origin = request.headers.get('origin');
  const referer = request.headers.get('referer');

  // This proxy carries real session cookies, so only accept local, same-origin requests.
  if (
    !loopbackHosts.has(localUrl.hostname) ||
    (origin && origin !== localUrl.origin) ||
    (referer && !referer.startsWith(`${localUrl.origin}/`)) ||
    request.headers.get('sec-fetch-site') === 'cross-site'
  ) {
    return Response.json({ message: 'Local same-origin requests only.' }, { status: 403 });
  }

  const { path } = await context.params;
  const pathname = path.join('/');

  if (
    path.some((part) => !part || part === '.' || part === '..' || /[/\\]/.test(part)) ||
    !(pathname.startsWith('api/') || ['login', 'logout', 'sanctum/csrf-cookie'].includes(pathname))
  ) {
    return new Response(null, { status: 404 });
  }

  let target: URL;

  try {
    target = new URL(backendUrl);
    if (!['http:', 'https:'].includes(target.protocol) || target.username || target.password) {
      throw new Error('Invalid backend URL');
    }
    target.pathname = `${target.pathname.replace(/\/$/, '')}/${path.map(encodeURIComponent).join('/')}`;
    target.search = localUrl.search;
    target.hash = '';
  } catch {
    return Response.json({ message: 'DEV_API_PROXY_URL must be an HTTP(S) URL.' }, { status: 500 });
  }

  const headers = new Headers({ Accept: 'application/json' });
  for (const name of ['content-type', 'cookie', 'x-xsrf-token', 'origin', 'referer']) {
    const value = request.headers.get(name);
    if (value) headers.set(name, value);
  }

  // Preserve the frontend origin so Laravel still applies its Sanctum stateful-domain list.
  headers.set('referer', referer || `${localUrl.origin}/`);

  try {
    const upstream = await fetch(target, {
      method: request.method,
      headers,
      body: ['GET', 'HEAD'].includes(request.method) ? undefined : await request.arrayBuffer(),
      cache: 'no-store',
      redirect: 'manual',
      signal: AbortSignal.timeout(30_000),
    });

    // Never follow redirects with credentials or send the browser back to the remote origin.
    if (upstream.status >= 300 && upstream.status < 400) {
      return Response.json(
        { message: 'The backend unexpectedly redirected the request.' },
        { status: 502 }
      );
    }

    const responseHeaders = new Headers({ 'Cache-Control': 'no-store' });
    for (const name of ['content-type', 'retry-after']) {
      const value = upstream.headers.get(name);
      if (value) responseHeaders.set(name, value);
    }

    for (const cookie of upstream.headers.getSetCookie()) {
      // Cookies belong to localhost here. Keep HttpOnly and expiry, and expose XSRF at / for Axios.
      let localCookie = cookie.replace(/;\s*Domain=[^;]*/gi, '').replace(/;\s*Path=[^;]*/gi, '');
      if (localUrl.protocol === 'http:') {
        localCookie = localCookie
          .replace(/;\s*Secure(?=;|$)/gi, '')
          .replace(/;\s*SameSite=[^;]*/gi, '');
        localCookie += '; SameSite=Lax';
      }
      responseHeaders.append('Set-Cookie', `${localCookie}; Path=/`);
    }

    return new Response(upstream.body, { status: upstream.status, headers: responseHeaders });
  } catch {
    return Response.json(
      { message: 'Unable to reach the configured backend API.' },
      { status: 502 }
    );
  }
}

export {
  proxy as GET,
  proxy as PUT,
  proxy as POST,
  proxy as HEAD,
  proxy as PATCH,
  proxy as DELETE,
};
