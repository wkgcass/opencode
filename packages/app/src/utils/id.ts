const prefixes = {
  event: "evt",
  session: "ses",
  message: "msg",
  permission: "per",
  user: "usr",
  part: "prt",
  pty: "pty",
} as const

const RANDOM_LENGTH = 14
let lastTimestamp = 0
let counter = 0

type Prefix = keyof typeof prefixes
export namespace Identifier {
  export function ascending(prefix: Prefix, given?: string, extended = false) {
    return generateID(prefix, false, given, extended)
  }

  export function ascendingAt(prefix: Prefix, timestamp: number, extended = false) {
    return create(prefix, false, timestamp, extended)
  }

  export function descending(prefix: Prefix, given?: string, extended = false) {
    return generateID(prefix, true, given, extended)
  }

  /** Detect whether an ID uses the extended (hyphenated, 44-bit timestamp) format. */
  export function isExtended(id: string): boolean {
    const underscore = id.indexOf("_")
    return underscore !== -1 && id[underscore + 1] === "-"
  }

  export function timestamp(id: string): number | undefined {
    const underscore = id.indexOf("_")
    if (underscore === -1) return undefined
    const extended = isExtended(id)
    const hexStart = underscore + (extended ? 2 : 1)
    const encodedWidth = extended ? 14 : 12
    const encoded = id.slice(hexStart, hexStart + encodedWidth)
    if (encoded.length !== encodedWidth || !/^[0-9a-fA-F]+$/.test(encoded)) return undefined
    return Number(BigInt(`0x${encoded.slice(0, extended ? 11 : 9)}`))
  }
}

function generateID(prefix: Prefix, descending: boolean, given?: string, extended = false): string {
  if (!given) {
    return create(prefix, descending, undefined, extended)
  }

  if (!given.startsWith(prefixes[prefix])) {
    throw new Error(`ID ${given} does not start with ${prefixes[prefix]}`)
  }

  return given
}

// Both formats append a 12-bit counter to the timestamp before the random
// suffix. Legacy IDs use 36 timestamp bits (12 total hex digits); extended IDs
// use 44 timestamp bits (14 total hex digits).
function create(prefix: Prefix, descending: boolean, timestamp?: number, extended = false): string {
  const currentTimestamp = timestamp ?? Date.now()

  if (currentTimestamp !== lastTimestamp) {
    lastTimestamp = currentTimestamp
    counter = 0
  }

  counter += 1

  const width = extended ? 14 : 12
  const value = BigInt(currentTimestamp) * 0x1000n + BigInt(counter)
  const now = descending ? ~value : value
  const time = (now & ((1n << BigInt(width * 4)) - 1n)).toString(16).padStart(width, "0")

  return (extended ? prefixes[prefix] + "_-" : prefixes[prefix] + "_") + time + randomBase62(RANDOM_LENGTH)
}

function randomBase62(length: number): string {
  const chars = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz"
  const bytes = getRandomBytes(length)
  let result = ""
  for (let i = 0; i < length; i += 1) {
    result += chars[bytes[i] % 62]
  }
  return result
}

function getRandomBytes(length: number): Uint8Array {
  const bytes = new Uint8Array(length)
  const cryptoObj = typeof globalThis !== "undefined" ? globalThis.crypto : undefined

  if (cryptoObj && typeof cryptoObj.getRandomValues === "function") {
    cryptoObj.getRandomValues(bytes)
    return bytes
  }

  for (let i = 0; i < length; i += 1) {
    bytes[i] = Math.floor(Math.random() * 256)
  }

  return bytes
}
