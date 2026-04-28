import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { deflateSync } from 'zlib'
import pngToIco from 'png-to-ico'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const SIZE = 512

const buf = Buffer.alloc(SIZE * SIZE * 4, 0)

function setPixel(x, y, r, g, b, a = 255) {
  if (x < 0 || x >= SIZE || y < 0 || y >= SIZE) return
  const i = (y * SIZE + x) * 4
  buf[i] = r; buf[i + 1] = g; buf[i + 2] = b; buf[i + 3] = a
}

function inRoundedRect(x, y, w, h, r) {
  const dx = Math.max(r - x, 0, x - (w - r))
  const dy = Math.max(r - y, 0, y - (h - r))
  return dx * dx + dy * dy <= r * r
}

function inEllipse(x, y, cx, cy, rx, ry) {
  const dx = (x - cx) / rx
  const dy = (y - cy) / ry
  return dx * dx + dy * dy <= 1
}

const scale = SIZE / 250

for (let y = 0; y < SIZE; y++) {
  for (let x = 0; x < SIZE; x++) {
    const sx = x / scale
    const sy = y / scale

    if (!inRoundedRect(sx, sy, 250, 250, 50)) {
      setPixel(x, y, 0, 0, 0, 0)
      continue
    }

    if (inEllipse(sx, sy, 86.5, 125, 16, 30) || inEllipse(sx, sy, 163.5, 125, 16, 30)) {
      setPixel(x, y, 0, 0, 0, 255)
    } else {
      setPixel(x, y, 255, 255, 255, 255)
    }
  }
}

const crc32Table = new Uint32Array(256)
for (let i = 0; i < 256; i++) {
  let c = i
  for (let j = 0; j < 8; j++) c = (c & 1) ? 0xEDB88320 ^ (c >>> 1) : c >>> 1
  crc32Table[i] = c
}
const crc32 = (b) => {
  let c = 0xFFFFFFFF
  for (let i = 0; i < b.length; i++) c = crc32Table[(c ^ b[i]) & 0xFF] ^ (c >>> 8)
  return (c ^ 0xFFFFFFFF) >>> 0
}
const chunk = (type, data) => {
  const t = Buffer.from(type)
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length)
  const crcData = Buffer.concat([t, data])
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(crcData))
  return Buffer.concat([len, t, data, crc])
}

const ihdr = Buffer.alloc(13)
ihdr.writeUInt32BE(SIZE, 0); ihdr.writeUInt32BE(SIZE, 4)
ihdr[8] = 8; ihdr[9] = 6

const raw = Buffer.alloc(SIZE * (1 + SIZE * 4))
for (let y = 0; y < SIZE; y++) {
  raw[y * (1 + SIZE * 4)] = 0
  buf.copy(raw, y * (1 + SIZE * 4) + 1, y * SIZE * 4, (y + 1) * SIZE * 4)
}

const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])
const pngBuf = Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))])

const pngPath = path.join(__dirname, '../public/icon.png')
fs.writeFileSync(pngPath, pngBuf)
console.log('✓ icon.png gerado (512x512)')

const icoBuf = await pngToIco([pngPath])
const icoPath = path.join(__dirname, '../public/icon.ico')
fs.writeFileSync(icoPath, icoBuf)
console.log('✓ icon.ico gerado')
