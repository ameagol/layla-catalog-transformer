import { mkdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { deflateSync } from 'node:zlib'

const SIZE = 256
const pixels = Buffer.alloc(SIZE * SIZE * 4)

interface RgbaColor {
  red: number
  green: number
  blue: number
  alpha: number
}

const COLORS = {
  rail: { red: 16, green: 24, blue: 21, alpha: 255 },
  accent: { red: 217, green: 255, blue: 87, alpha: 255 },
  aqua: { red: 89, green: 200, blue: 193, alpha: 255 },
  signal: { red: 241, green: 107, blue: 58, alpha: 255 }
} satisfies Record<string, RgbaColor>

function setPixel(horizontal: number, vertical: number, color: RgbaColor): void {
  if (horizontal < 0 || horizontal >= SIZE || vertical < 0 || vertical >= SIZE) return
  const offset = (vertical * SIZE + horizontal) * 4
  pixels[offset] = color.red
  pixels[offset + 1] = color.green
  pixels[offset + 2] = color.blue
  pixels[offset + 3] = color.alpha
}

function fillRectangle(left: number, top: number, width: number, height: number, color: RgbaColor): void {
  for (let vertical = top; vertical < top + height; vertical += 1) {
    for (let horizontal = left; horizontal < left + width; horizontal += 1) {
      setPixel(horizontal, vertical, color)
    }
  }
}

function insideRoundedSquare(horizontal: number, vertical: number, radius: number): boolean {
  const nearestHorizontal = Math.max(radius, Math.min(SIZE - radius - 1, horizontal))
  const nearestVertical = Math.max(radius, Math.min(SIZE - radius - 1, vertical))
  const horizontalDistance = horizontal - nearestHorizontal
  const verticalDistance = vertical - nearestVertical
  return horizontalDistance * horizontalDistance + verticalDistance * verticalDistance <= radius * radius
}

for (let vertical = 0; vertical < SIZE; vertical += 1) {
  for (let horizontal = 0; horizontal < SIZE; horizontal += 1) {
    if (insideRoundedSquare(horizontal, vertical, 54)) setPixel(horizontal, vertical, COLORS.rail)
  }
}

for (let vertical = 0; vertical < 64; vertical += 1) {
  for (let horizontal = 0; horizontal < SIZE; horizontal += 1) {
    if (insideRoundedSquare(horizontal, vertical, 54)) setPixel(horizontal, vertical, COLORS.accent)
  }
}

fillRectangle(48, 88, 72, 18, COLORS.accent)
fillRectangle(48, 88, 18, 94, COLORS.accent)
fillRectangle(48, 164, 72, 18, COLORS.accent)
fillRectangle(136, 92, 76, 18, COLORS.aqua)
fillRectangle(165, 92, 18, 90, COLORS.aqua)
fillRectangle(43, 204, 170, 12, COLORS.signal)

function crc32(buffer: Buffer): number {
  let checksum = 0xffffffff
  for (const byte of buffer) {
    checksum ^= byte
    for (let bit = 0; bit < 8; bit += 1) {
      checksum = (checksum >>> 1) ^ (checksum & 1 ? 0xedb88320 : 0)
    }
  }
  return (checksum ^ 0xffffffff) >>> 0
}

function pngChunk(type: string, data: Buffer): Buffer {
  const typeBuffer = Buffer.from(type, 'ascii')
  const output = Buffer.alloc(12 + data.length)
  output.writeUInt32BE(data.length, 0)
  typeBuffer.copy(output, 4)
  data.copy(output, 8)
  output.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])), 8 + data.length)
  return output
}

function createPng(): Buffer {
  const header = Buffer.alloc(13)
  header.writeUInt32BE(SIZE, 0)
  header.writeUInt32BE(SIZE, 4)
  header[8] = 8
  header[9] = 6

  const rowLength = SIZE * 4 + 1
  const raw = Buffer.alloc(rowLength * SIZE)
  for (let row = 0; row < SIZE; row += 1) {
    raw[row * rowLength] = 0
    pixels.copy(raw, row * rowLength + 1, row * SIZE * 4, (row + 1) * SIZE * 4)
  }

  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    pngChunk('IHDR', header),
    pngChunk('IDAT', deflateSync(raw, { level: 9 })),
    pngChunk('IEND', Buffer.alloc(0))
  ])
}

function createIco(png: Buffer): Buffer {
  const header = Buffer.alloc(6)
  header.writeUInt16LE(0, 0)
  header.writeUInt16LE(1, 2)
  header.writeUInt16LE(1, 4)
  const entry = Buffer.alloc(16)
  entry[0] = 0
  entry[1] = 0
  entry.writeUInt16LE(1, 4)
  entry.writeUInt16LE(32, 6)
  entry.writeUInt32LE(png.length, 8)
  entry.writeUInt32LE(22, 12)
  return Buffer.concat([header, entry, png])
}

const buildDirectory = resolve(import.meta.dirname, '../build')
await mkdir(buildDirectory, { recursive: true })
const png = createPng()
await Promise.all([
  writeFile(resolve(buildDirectory, 'icon.png'), png),
  writeFile(resolve(buildDirectory, 'icon.ico'), createIco(png))
])

console.log(`Generated application icons in ${buildDirectory}`)

