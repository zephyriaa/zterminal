/**
 * IEEE 802.3 CRC32 Implementation for OKX Level 2 Order Book Checksum Validation.
 * Polynomial: 0xEDB88320 (reversed 0x04C11DB7).
 */

const CRC32_TABLE = new Int32Array(256);

// Precompute CRC-32 table
for (let i = 0; i < 256; i++) {
  let c = i;
  for (let k = 0; k < 8; k++) {
    c = c & 1 ? -306674912 ^ (c >>> 1) : c >>> 1; // -306674912 is 0xEDB88320 as signed 32-bit int
  }
  CRC32_TABLE[i] = c;
}

/**
 * Computes standard IEEE 802.3 CRC32 checksum as a signed 32-bit integer.
 */
export function crc32Signed(str: string): number {
  let crc = -1;
  const len = str.length;
  for (let i = 0; i < len; i++) {
    const code = str.charCodeAt(i);
    if (code < 0x80) {
      crc = (crc >>> 8) ^ CRC32_TABLE[(crc ^ code) & 0xff];
    } else if (code < 0x800) {
      crc = (crc >>> 8) ^ CRC32_TABLE[(crc ^ (0xc0 | (code >> 6))) & 0xff];
      crc = (crc >>> 8) ^ CRC32_TABLE[(crc ^ (0x80 | (code & 0x3f))) & 0xff];
    } else if (code < 0xd800 || code >= 0xe000) {
      crc = (crc >>> 8) ^ CRC32_TABLE[(crc ^ (0xe0 | (code >> 12))) & 0xff];
      crc = (crc >>> 8) ^ CRC32_TABLE[(crc ^ (0x80 | ((code >> 6) & 0x3f))) & 0xff];
      crc = (crc >>> 8) ^ CRC32_TABLE[(crc ^ (0x80 | (code & 0x3f))) & 0xff];
    } else {
      // UTF-16 surrogate pair
      i++;
      const code2 = str.charCodeAt(i);
      const codepoint = 0x10000 + (((code & 0x3ff) << 10) | (code2 & 0x3ff));
      crc = (crc >>> 8) ^ CRC32_TABLE[(crc ^ (0xf0 | (codepoint >> 18))) & 0xff];
      crc = (crc >>> 8) ^ CRC32_TABLE[(crc ^ (0x80 | ((codepoint >> 12) & 0x3f))) & 0xff];
      crc = (crc >>> 8) ^ CRC32_TABLE[(crc ^ (0x80 | ((codepoint >> 6) & 0x3f))) & 0xff];
      crc = (crc >>> 8) ^ CRC32_TABLE[(crc ^ (0x80 | (codepoint & 0x3f))) & 0xff];
    }
  }
  return (crc ^ -1) | 0;
}

/**
 * Builds the OKX checksum string from top 25 bids and top 25 asks.
 * Format: bid_p:bid_s:ask_p:ask_s:bid_p:bid_s:ask_p:ask_s...
 */
export function buildOkxChecksumString(
  bids: Array<[price: string | number, size: string | number]>,
  asks: Array<[price: string | number, size: string | number]>
): string {
  const parts: string[] = [];
  const maxLevels = 25;
  const count = Math.max(Math.min(bids.length, maxLevels), Math.min(asks.length, maxLevels));

  for (let i = 0; i < count; i++) {
    if (i < bids.length && i < maxLevels) {
      parts.push(`${bids[i][0]}:${bids[i][1]}`);
    }
    if (i < asks.length && i < maxLevels) {
      parts.push(`${asks[i][0]}:${asks[i][1]}`);
    }
  }

  return parts.join(':');
}

/**
 * Validates the OKX order book against the exchange-reported checksum.
 */
export function validateOkxChecksum(
  bids: Array<[price: string | number, size: string | number]>,
  asks: Array<[price: string | number, size: string | number]>,
  expectedChecksum: number
): boolean {
  const checksumString = buildOkxChecksumString(bids, asks);
  const calculated = crc32Signed(checksumString);
  return calculated === expectedChecksum;
}
