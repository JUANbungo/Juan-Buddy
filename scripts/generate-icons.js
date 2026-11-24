'use strict';

const zlib = require('zlib');

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i += 1) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const typeBuf = Buffer.from(type, 'ascii');
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])));
  return Buffer.concat([len, typeBuf, data, crc]);
}

function encodePNG(width, height, pixels) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y += 1) {
    raw[y * (width * 4 + 1)] = 0;
    pixels.copy(raw, y * (width * 4 + 1) + 1, y * width * 4, (y + 1) * width * 4);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

function drawBuddyFace(size) {
  const px = Buffer.alloc(size * size * 4);
  const s = size / 256;
  const set = (x, y, r, g, b, a) => {
    if (x < 0 || y < 0 || x >= size || y >= size) return;
    const i = (y * size + x) * 4;
    px[i] = r; px[i + 1] = g; px[i + 2] = b; px[i + 3] = a;
  };
  const insideRounded = (x, y, rad) => {
    const cx = size / 2, cy = size / 2;
    const dx = Math.abs(x - cx), dy = Math.abs(y - cy);
    const ix = Math.max(dx - (size / 2 - rad), 0);
    const iy = Math.max(dy - (size / 2 - rad), 0);
    return ix * ix + iy * iy <= rad * rad;
  };
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      if (!insideRounded(x, y, Math.round(48 * s))) continue;
      const nx = (x - size / 2) / (size / 2);
      const ny = (y - size / 2) / (size / 2);
      const d = Math.sqrt(nx * nx + ny * ny);
      if (d > 0.62) { set(x, y, 0xe8, 0x94, 0x2a, 255); }
      else if (d > 0.35) { set(x, y, 0xff, 0xb6, 0x4d, 255); }
      else { set(x, y, 0xff, 0xe3, 0xb3, 255); }
    }
  }
  const eye = (cx, cy, r, col) => {
    for (let y = -r; y <= r; y += 1) {
      for (let x = -r; x <= r; x += 1) {
        if (x * x + y * y <= r * r) set(cx + x, cy + y, col[0], col[1], col[2], 255);
      }
    }
  };
  eye(Math.round(size * 0.36), Math.round(size * 0.44), Math.round(13 * s), [0x25, 0x1d, 0x33]);
  eye(Math.round(size * 0.64), Math.round(size * 0.44), Math.round(13 * s), [0x25, 0x1d, 0x33]);
  eye(Math.round(size * 0.36) + 2, Math.round(size * 0.44) - 2, Math.round(4 * s), [255, 255, 255]);
  eye(Math.round(size * 0.64) + 2, Math.round(size * 0.44) - 2, Math.round(4 * s), [255, 255, 255]);
  const mouthR = Math.round(26 * s);
  const mcy = Math.round(size * 0.58);
  for (let x = -mouthR; x <= mouthR; x += 1) {
    const y = Math.round(Math.sqrt(Math.max(0, mouthR * mouthR - x * x)));
    const py = mcy + y;
    set(Math.round(size / 2) + x, py, 0x25, 0x1d, 0x33, 255);
    set(Math.round(size / 2) + x, py + 1, 0x25, 0x1d, 0x33, 255);
    set(Math.round(size / 2) + x, py + 2, 0x25, 0x1d, 0x33, 255);
  }
  return px;
}

const icon256 = encodePNG(256, 256, drawBuddyFace(256));
const tray = encodePNG(16, 16, drawBuddyFace(16));

module.exports = {
  ICON_PNG_BASE64: icon256.toString('base64'),
  TRAY_PNG_BASE64: tray.toString('base64'),
  encodePNG,
  drawBuddyFace,
};

if (require.main === module) {
  const fs = require('fs');
  const path = require('path');
  const assetsDir = path.join(__dirname, '..', 'assets');
  fs.mkdirSync(assetsDir, { recursive: true });
  fs.writeFileSync(path.join(assetsDir, 'icon.png'), icon256);
  fs.writeFileSync(path.join(assetsDir, 'tray.png'), tray);
  console.log('Wrote assets/icon.png and assets/tray.png');
}
