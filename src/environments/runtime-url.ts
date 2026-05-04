function trimTrailingSlash(value: string): string {
  return value.length > 1 ? value.replace(/\/+$/, '') : value;
}

function isLoopbackHost(hostname: string): boolean {
  return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]';
}

export function resolveRuntimeUrl(configuredValue: string, fallbackValue: string): string {
  const fallback = trimTrailingSlash(fallbackValue);
  const configured = trimTrailingSlash((configuredValue || '').trim());

  if (!configured || configured.includes('__')) {
    return fallback;
  }

  if (typeof window === 'undefined') {
    return configured;
  }

  try {
    const resolved = new URL(configured, window.location.origin);

    if (!resolved.hostname) {
      return configured;
    }

    if (!isLoopbackHost(window.location.hostname) && isLoopbackHost(resolved.hostname)) {
      return fallback;
    }
  } catch {
    return configured;
  }

  return configured;
}
