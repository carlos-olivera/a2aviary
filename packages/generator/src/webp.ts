// Bounds-checked structural inspection only: no native decoding in the controller.
export function normalizedDimensions(input: Uint8Array) {
  const bytes = Buffer.from(input);
  if (
    bytes.length < 20 ||
    bytes.toString('ascii', 0, 4) !== 'RIFF' ||
    bytes.toString('ascii', 8, 12) !== 'WEBP' ||
    bytes.readUInt32LE(4) + 8 !== bytes.length
  )
    throw Error('normalized_image_invalid');
  let dimensions: { width: number; height: number } | undefined;
  for (let offset = 12; offset + 8 <= bytes.length;) {
    const size = bytes.readUInt32LE(offset + 4),
      kind = bytes.toString('ascii', offset, offset + 4),
      data = offset + 8;
    if (data + size > bytes.length) throw Error('normalized_image_invalid');
    if (['ANIM', 'ANMF', 'EXIF', 'XMP ', 'ICCP'].includes(kind))
      throw Error('normalized_image_invalid');
    if (kind === 'VP8X') {
      if (size < 10 || bytes[data] & 2) throw Error('normalized_image_invalid');
      dimensions = {
        width: bytes.readUIntLE(data + 4, 3) + 1,
        height: bytes.readUIntLE(data + 7, 3) + 1,
      };
    }
    if (kind === 'VP8L') {
      if (size < 5 || bytes[data] !== 47)
        throw Error('normalized_image_invalid');
      const bits = bytes.readUInt32LE(data + 1);
      dimensions ??= {
        width: (bits & 0x3fff) + 1,
        height: ((bits >>> 14) & 0x3fff) + 1,
      };
    }
    if (kind === 'VP8 ') {
      if (
        size < 10 ||
        bytes[data + 3] !== 157 ||
        bytes[data + 4] !== 1 ||
        bytes[data + 5] !== 42
      )
        throw Error('normalized_image_invalid');
      dimensions ??= {
        width: bytes.readUInt16LE(data + 6) & 0x3fff,
        height: bytes.readUInt16LE(data + 8) & 0x3fff,
      };
    }
    offset = data + size + (size % 2);
  }
  if (
    !dimensions ||
    dimensions.width < 1 ||
    dimensions.height < 1 ||
    dimensions.width > 2560 ||
    dimensions.height > 2560
  )
    throw Error('normalized_image_invalid');
  return dimensions;
}
