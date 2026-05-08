type FetchFn = (path: string, init?: RequestInit) => Promise<Response>

export async function fetchJsonOrThrow<T>(
  fetchFn: FetchFn,
  path: string,
  init: RequestInit | undefined,
  fallbackMessage: string
): Promise<T> {
  const res = await fetchFn(path, init)
  const data = (await res.json().catch(() => null)) as any
  if (!res.ok || !data?.ok) {
    throw new Error(data?.error || fallbackMessage)
  }
  return data as T
}

