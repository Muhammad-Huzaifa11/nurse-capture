/**
 * FIFO IndexedDB outbox for capture POSTs when offline (iOS-safe; no Workbox Background Sync).
 * Store name per spec: `events-queue`.
 */

const DB_NAME = 'nurse-capture-outbox'
const DB_VERSION = 1
const STORE = 'events-queue'

export type QueuedCaptureBody = {
  signalType: 'interruption' | 'compensation'
  occurredAt: string
  note?: string
}

type QueuedRow = {
  id: number
  seatId: string
  body: string
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onerror = () => reject(req.error ?? new Error('IndexedDB open failed'))
    req.onsuccess = () => resolve(req.result)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(STORE)) {
        const os = db.createObjectStore(STORE, { keyPath: 'id', autoIncrement: true })
        os.createIndex('bySeat', 'seatId', { unique: false })
      }
    }
  })
}

function promisifyRequest<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error ?? new Error('IndexedDB request failed'))
  })
}

export async function enqueueCapture(seatId: string, body: QueuedCaptureBody): Promise<void> {
  const db = await openDb()
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite')
    tx.objectStore(STORE).add({ seatId, body: JSON.stringify(body) } as Omit<QueuedRow, 'id'>)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error ?? new Error('IndexedDB transaction failed'))
    tx.onabort = () => reject(tx.error ?? new Error('IndexedDB transaction aborted'))
  })
  db.close()
}

export async function getOutboxCountForSeat(seatId: string): Promise<number> {
  const db = await openDb()
  const tx = db.transaction(STORE, 'readonly')
  const index = tx.objectStore(STORE).index('bySeat')
  const n = await promisifyRequest(index.count(IDBKeyRange.only(seatId)))
  db.close()
  return n
}

async function getFirstForSeat(seatId: string): Promise<QueuedRow | null> {
  const db = await openDb()
  const tx = db.transaction(STORE, 'readonly')
  const index = tx.objectStore(STORE).index('bySeat')
  const req = index.openCursor(IDBKeyRange.only(seatId))
  const row = await new Promise<QueuedRow | null>((resolve, reject) => {
    req.onerror = () => reject(req.error ?? new Error('cursor failed'))
    req.onsuccess = () => {
      const cursor = req.result
      resolve(cursor ? (cursor.value as QueuedRow) : null)
    }
  })
  db.close()
  return row
}

export async function removeQueuedById(id: number): Promise<void> {
  const db = await openDb()
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite')
    tx.objectStore(STORE).delete(id)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error ?? new Error('IndexedDB delete failed'))
    tx.onabort = () => reject(tx.error ?? new Error('IndexedDB delete aborted'))
  })
  db.close()
}

export async function removeAllForSeat(seatId: string): Promise<void> {
  const db = await openDb()
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite')
    const index = tx.objectStore(STORE).index('bySeat')
    const req = index.openCursor(IDBKeyRange.only(seatId))
    req.onerror = () => reject(req.error ?? new Error('cursor delete failed'))
    req.onsuccess = () => {
      const cursor = req.result
      if (!cursor) return
      cursor.delete()
      cursor.continue()
    }
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error ?? new Error('IndexedDB batch delete failed'))
    tx.onabort = () => reject(tx.error ?? new Error('IndexedDB batch delete aborted'))
  })
  db.close()
}

const FLUSH_GAP_MS = 9 * 1000

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

export type FlushDeps = {
  seatId: string
  postEvent: (body: string) => Promise<Response>
  on401: () => void
  onQueueChange: (count: number) => void
  shouldAbort: () => boolean
}

/**
 * Sequential replay per spec §11. Coalescing: if the queue is non-empty after a full drain pass,
 * runs another pass in the same mutex hold.
 */
export async function runCaptureOutboxFlush(
  deps: FlushDeps,
  isFlushingRef: { current: boolean }
): Promise<void> {
  if (isFlushingRef.current) return
  if (typeof navigator !== 'undefined' && !navigator.onLine) return

  isFlushingRef.current = true
  let stoppedFor401 = false
  let stoppedForNetwork = false

  const refreshCount = async () => {
    const c = await getOutboxCountForSeat(deps.seatId)
    deps.onQueueChange(c)
    return c
  }

  try {
    await refreshCount()

    let drainAgain = true
    while (drainAgain) {
      drainAgain = false

      while (!deps.shouldAbort()) {
        if (typeof navigator !== 'undefined' && !navigator.onLine) {
          stoppedForNetwork = true
          break
        }

        const row = await getFirstForSeat(deps.seatId)
        if (!row) break

        let response: Response
        try {
          response = await deps.postEvent(row.body)
        } catch {
          stoppedForNetwork = true
          break
        }

        if (response.status === 401) {
          deps.on401()
          stoppedFor401 = true
          break
        }

        if (response.status === 429) {
          let retrySec = 8
          try {
            const data = await response.json()
            if (typeof data?.retryAfterSeconds === 'number' && Number.isFinite(data.retryAfterSeconds)) {
              retrySec = Math.max(1, Math.ceil(data.retryAfterSeconds))
            }
          } catch {
            /* use default */
          }
          await sleep(retrySec * 1000)
          continue
        }

        if (response.status === 201) {
          await removeQueuedById(row.id)
          await refreshCount()
          const next = await getFirstForSeat(deps.seatId)
          if (!next) break
          await sleep(FLUSH_GAP_MS)
          continue
        }

        const status = response.status
        if (status >= 400 && status < 500) {
          await removeQueuedById(row.id)
          await refreshCount()
          await sleep(FLUSH_GAP_MS)
          continue
        }

        if (status >= 500) {
          await removeQueuedById(row.id)
          await refreshCount()
          await sleep(FLUSH_GAP_MS)
          continue
        }

        await removeQueuedById(row.id)
        await refreshCount()
        await sleep(FLUSH_GAP_MS)
      }

      await refreshCount()

      if (stoppedFor401 || stoppedForNetwork || deps.shouldAbort()) break

      if (typeof navigator !== 'undefined' && navigator.onLine) {
        const c = await getOutboxCountForSeat(deps.seatId)
        deps.onQueueChange(c)
        if (c > 0) drainAgain = true
      }
    }
  } finally {
    isFlushingRef.current = false
    await refreshCount()
  }
}
