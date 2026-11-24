'use strict';

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; }
  return t;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (const byte of buf) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, body) {
  const len = Buffer.alloc(4); len.writeUInt32BE(body.length);
  const tb = Buffer.from(type, 'ascii');
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(Buffer.concat([tb, body])));
  return Buffer.concat([len, tb, body, crc]);
}

function decodePNG(data) {
  if (data.readUInt32BE(0) !== 0x89504e47) throw new Error('Not a PNG');
  let pos = 8;
  let width = 0, height = 0, colorType = 0, bitDepth = 0;
  const idat = [];
  while (pos < data.length) {
    const len = data.readUInt32BE(pos);
    const type = data.toString('ascii', pos + 4, pos + 8);
    const body = data.slice(pos + 8, pos + 8 + len);
    if (type === 'IHDR') {
      width = body.readUInt32BE(0);
      height = body.readUInt32BE(4);
      bitDepth = body[8];
      colorType = body[9];
    } else if (type === 'IDAT') {
      idat.push(body);
    } else if (type === 'IEND') {
      break;
    }
    pos += 12 + len;
  }
  if (bitDepth !== 8 || (colorType !== 6 && colorType !== 2)) {
    throw new Error(`Unsupported PNG: bitDepth=${bitDepth} colorType=${colorType}`);
  }
  const channels = colorType === 6 ? 4 : 3;
  const raw = zlib.inflateSync(Buffer.concat(idat));
  const stride = width * channels;
  const out = Buffer.alloc(width * height * 4);
  let prev = Buffer.alloc(stride);
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)];
    const line = raw.slice(y * (stride + 1) + 1, (y + 1) * (stride + 1));
    for (let x = 0; x < stride; x++) {
      const a = x >= channels ? line[x - channels] : 0;
      const b = prev[x];
      const c = x >= channels ? prev[x - channels] : 0;
      let v = line[x];
      if (filter === 1) v = (v + a) & 0xff;
      else if (filter === 2) v = (v + b) & 0xff;
      else if (filter === 3) v = (v + ((a + b) >> 1)) & 0xff;
      else if (filter === 4) {
        const p = a + b - c;
        const pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
        v = (v + (pa <= pb && pa <= pc ? a : pb <= pc ? b : c)) & 0xff;
      }
      line[x] = v;
    }
    for (let x = 0; x < width; x++) {
      const o = (y * width + x) * 4;
      out[o] = line[x * channels];
      out[o + 1] = line[x * channels + 1];
      out[o + 2] = line[x * channels + 2];
      out[o + 3] = channels === 4 ? line[x * channels + 3] : 255;
    }
    prev = line;
  }
  return { width, height, pixels: out };
}

function readPNG(file) {
  return decodePNG(fs.readFileSync(file));
}

function scaleImage(img, size) {
  const out = Buffer.alloc(size * size * 4);
  const ratio = img.width / size;
  for (let y = 0; y < size; y++) {
    const y0 = Math.floor(y * ratio), y1 = Math.min(img.height, Math.ceil((y + 1) * ratio));
    for (let x = 0; x < size; x++) {
      const x0 = Math.floor(x * ratio), x1 = Math.min(img.width, Math.ceil((x + 1) * ratio));
      let r = 0, g = 0, b = 0, a = 0, count = 0;
      for (let sy = y0; sy < Math.max(y1, y0 + 1); sy++) {
        for (let sx = x0; sx < Math.max(x1, x0 + 1); sx++) {
          const o = (sy * img.width + sx) * 4;
          const alpha = img.pixels[o + 3] / 255;
          r += img.pixels[o] * alpha; g += img.pixels[o + 1] * alpha; b += img.pixels[o + 2] * alpha;
          a += img.pixels[o + 3]; count++;
        }
      }
      const o = (y * size + x) * 4;
      out[o] = Math.round(r / count); out[o + 1] = Math.round(g / count); out[o + 2] = Math.round(b / count);
      out[o + 3] = Math.round(a / count);
    }
  }
  return { width: size, height: size, pixels: out };
}

function encodeImagePNG(im) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(im.width, 0);
  ihdr.writeUInt32BE(im.height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  const raw = Buffer.alloc((im.width * 4 + 1) * im.height);
  for (let y = 0; y < im.height; y++) {
    raw[y * (im.width * 4 + 1)] = 0;
    im.pixels.copy(raw, y * (im.width * 4 + 1) + 1, y * im.width * 4, (y + 1) * im.width * 4);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

module.exports = { decodePNG, readPNG, scaleImage, encodeImagePNG };

if (require.main === module) {
  const src = process.argv[2];
  if (!src) { console.error('usage: node scripts/make-icons-from-png.js <source.png>'); process.exit(1); }
  const img = readPNG(src);
  const root = path.join(__dirname, '..');
  const icon512 = encodeImagePNG(scaleImage(img, 512));
  const icon192 = encodeImagePNG(scaleImage(img, 192));
  const icon180 = encodeImagePNG(scaleImage(img, 180));
  const tray16 = encodeImagePNG(scaleImage(img, 16));
  fs.mkdirSync(path.join(root, 'mobile', 'icons'), { recursive: true });
  fs.writeFileSync(path.join(root, 'assets', 'icon.png'), icon512);
  fs.writeFileSync(path.join(root, 'assets', 'tray.png'), tray16);
  fs.writeFileSync(path.join(root, 'mobile', 'icons', 'icon-180.png'), icon180);
  fs.writeFileSync(path.join(root, 'mobile', 'icons', 'icon-192.png'), icon192);
  fs.writeFileSync(path.join(root, 'mobile', 'icons', 'icon-512.png'), icon512);
  fs.writeFileSync(path.join(root, 'assets', 'icons.js'), `'use strict';\n\nconst ICON_PNG_BASE64 = '${icon512.toString('base64')}';\nconst TRAY_PNG_BASE64 = '${tray16.toString('base64')}';\n\nmodule.exports = { ICON_PNG_BASE64, TRAY_PNG_BASE64 };\n`);
  console.log('Icon pipeline done: assets/icon.png (512), assets/tray.png (16), mobile icons, assets/icons.js refreshed');
}
