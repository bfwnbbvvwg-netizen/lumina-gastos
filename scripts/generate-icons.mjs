import { deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const outDir = join(process.cwd(), 'public', 'icons');
mkdirSync(outDir, { recursive: true });

const colors = {
  paper: [247, 245, 239, 255],
  ink: [34, 49, 63, 255],
  sage: [125, 157, 140, 255],
};

function crc32(buffer) {
  let crc = -1;
  for (const byte of buffer) {
    crc ^= byte;
    for (let index = 0; index < 8; index += 1) {
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
  }
  return (crc ^ -1) >>> 0;
}

function chunk(type, data) {
  const typeBuffer = Buffer.from(type);
  const length = Buffer.alloc(4);
  const checksum = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  checksum.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])), 0);
  return Buffer.concat([length, typeBuffer, data, checksum]);
}

function insideRoundedRect(x, y, left, top, right, bottom, radius) {
  const cx = Math.max(left + radius, Math.min(x, right - radius));
  const cy = Math.max(top + radius, Math.min(y, bottom - radius));
  return (x - cx) ** 2 + (y - cy) ** 2 <= radius ** 2;
}

function drawPixel(data, width, x, y, rgba) {
  const index = (y * width + x) * 4;
  data[index] = rgba[0];
  data[index + 1] = rgba[1];
  data[index + 2] = rgba[2];
  data[index + 3] = rgba[3];
}

function drawIcon(size, filename) {
  const data = Buffer.alloc(size * size * 4);
  const center = size / 2;

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      drawPixel(data, size, x, y, colors.paper);

      const body = insideRoundedRect(
        x,
        y,
        size * 0.24,
        size * 0.25,
        size * 0.76,
        size * 0.76,
        size * 0.18,
      );
      if (body) drawPixel(data, size, x, y, colors.sage);

      const leftEye = (x - size * 0.41) ** 2 + (y - size * 0.45) ** 2 < (size * 0.035) ** 2;
      const rightEye = (x - size * 0.59) ** 2 + (y - size * 0.45) ** 2 < (size * 0.035) ** 2;
      if (leftEye || rightEye) drawPixel(data, size, x, y, colors.ink);

      const smileDistance = Math.abs(Math.hypot(x - center, y - size * 0.48) - size * 0.22);
      const smileArc = y > size * 0.53 && y < size * 0.68 && x > size * 0.31 && x < size * 0.69;
      if (smileArc && smileDistance < size * 0.025) drawPixel(data, size, x, y, colors.ink);
    }
  }

  const rows = [];
  for (let y = 0; y < size; y += 1) {
    rows.push(Buffer.from([0]));
    rows.push(data.subarray(y * size * 4, (y + 1) * size * 4));
  }

  const header = Buffer.from([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
  ]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const png = Buffer.concat([
    header,
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(Buffer.concat(rows))),
    chunk('IEND', Buffer.alloc(0)),
  ]);

  writeFileSync(join(outDir, filename), png);
}

drawIcon(180, 'apple-touch-icon.png');
drawIcon(192, 'icon-192.png');
drawIcon(512, 'icon-512.png');
drawIcon(512, 'maskable-512.png');
