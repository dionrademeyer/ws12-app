// MD5 (RFC 1321), needed only because PayFast signs ITN posts with MD5. WebCrypto has no MD5,
// so this small implementation keeps the PayFast check portable between Deno and Node tests.

const shifts = [
  7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14,
  20, 5, 9, 14, 20, 4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23, 6, 10, 15, 21, 6,
  10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21,
]

const constants = Array.from({ length: 64 }, (_, index) =>
  Math.floor(Math.abs(Math.sin(index + 1)) * 2 ** 32),
)

export function md5Hex(text: string): string {
  const message = new TextEncoder().encode(text)
  const paddedLength = (((message.length + 8) >>> 6) + 1) * 64
  const padded = new Uint8Array(paddedLength)
  padded.set(message)
  padded[message.length] = 0x80
  const view = new DataView(padded.buffer)
  const bitLength = message.length * 8
  view.setUint32(paddedLength - 8, bitLength >>> 0, true)
  view.setUint32(paddedLength - 4, Math.floor(bitLength / 2 ** 32), true)

  let a0 = 0x67452301
  let b0 = 0xefcdab89
  let c0 = 0x98badcfe
  let d0 = 0x10325476

  for (let offset = 0; offset < paddedLength; offset += 64) {
    const words = Array.from({ length: 16 }, (_, index) => view.getUint32(offset + index * 4, true))
    let a = a0
    let b = b0
    let c = c0
    let d = d0

    for (let step = 0; step < 64; step += 1) {
      let mixed: number
      let wordIndex: number
      if (step < 16) {
        mixed = (b & c) | (~b & d)
        wordIndex = step
      } else if (step < 32) {
        mixed = (d & b) | (~d & c)
        wordIndex = (5 * step + 1) % 16
      } else if (step < 48) {
        mixed = b ^ c ^ d
        wordIndex = (3 * step + 5) % 16
      } else {
        mixed = c ^ (b | ~d)
        wordIndex = (7 * step) % 16
      }
      const sum = (a + mixed + constants[step]! + words[wordIndex]!) >>> 0
      const shift = shifts[step]!
      a = d
      d = c
      c = b
      b = (b + ((sum << shift) | (sum >>> (32 - shift)))) >>> 0
    }

    a0 = (a0 + a) >>> 0
    b0 = (b0 + b) >>> 0
    c0 = (c0 + c) >>> 0
    d0 = (d0 + d) >>> 0
  }

  const digest = new Uint8Array(16)
  const digestView = new DataView(digest.buffer)
  const state = [a0, b0, c0, d0]
  state.forEach((word, index) => digestView.setUint32(index * 4, word, true))
  return Array.from(digest, (byte) => byte.toString(16).padStart(2, '0')).join('')
}
