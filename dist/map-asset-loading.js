// Share successful map resources; give transient failures a bounded fresh attempt.
export async function retryMapAsset(
  load,
  {
    attempts = 3,
    delayMs = 250,
    timeoutMs = 15000,
    shouldRetry = () => true,
  } = {},
) {
  for (let attempt = 0; attempt < attempts; attempt++) {
    let timer;
    try {
      return await Promise.race([
        Promise.resolve().then(() => load(attempt)),
        new Promise((_, reject) => {
          timer = setTimeout(
            () => reject(new Error("Map asset loading timed out")),
            timeoutMs,
          );
        }),
      ]);
    } catch (error) {
      if (attempt === attempts - 1 || !shouldRetry(error)) throw error;
      await new Promise((resolve) =>
        setTimeout(resolve, delayMs * (attempt + 1)),
      );
    } finally {
      clearTimeout(timer);
    }
  }
}

export function fetchMapAsset(
  url,
  decode,
  { fetchImpl = globalThis.fetch, timeoutMs = 15000, ...options } = {},
) {
  return retryMapAsset(
    async () => {
      const response = await fetchImpl(url, {
        signal: AbortSignal.timeout(timeoutMs),
        cache: "no-cache",
      });
      if (!response.ok) {
        const error = new Error(`Map asset ${url}: HTTP ${response.status}`);
        error.retryable =
          [408, 429].includes(response.status) || response.status >= 500;
        throw error;
      }
      return decode(response);
    },
    { ...options, timeoutMs, shouldRetry: (error) => error.retryable !== false },
  );
}

export function loadMapTexture(
  loader,
  url,
  { timeoutMs = 15000, ...options } = {},
) {
  return retryMapAsset(
    () =>
      new Promise((resolve, reject) => {
        let timedOut = false;
        const timer = setTimeout(() => {
          timedOut = true;
          reject(new Error(`Map texture ${url}: download timed out`));
        }, timeoutMs);
        loader.loadAsync(url).then(
          (texture) => {
            clearTimeout(timer);
            // A late image from an abandoned attempt must not leak a GPU resource.
            if (timedOut) texture.dispose();
            else resolve(texture);
          },
          (cause) => {
            clearTimeout(timer);
            reject(new Error(`Map texture ${url}: download failed`, { cause }));
          },
        );
      }),
    options,
  );
}
