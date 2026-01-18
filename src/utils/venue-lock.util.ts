// Mutex-style lock per venue to prevent race conditions
const venueLocks = new Map<string, Promise<void>>()

export async function withVenueLock<T>(venueId: string, fn: () => Promise<T>): Promise<T> {
    const prev = venueLocks.get(venueId) ?? Promise.resolve()
    let release!: () => void
    const next = new Promise<void>((r) => (release = r))
    venueLocks.set(venueId, prev.then(() => next))
    await prev
    try {
        return await fn()
    } finally {
        release()
        if (venueLocks.get(venueId) === next) venueLocks.delete(venueId)
    }
}
