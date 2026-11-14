import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { createSnapshot, listSnapshotIds, restoreSnapshot } from '../snapshot.js'

let tmp: string

beforeEach(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'koda-snapshot-'))
})

afterEach(() => {
  fs.rmSync(tmp, { recursive: true, force: true })
})

function writeFile(rel: string, content: string) {
  const abs = path.join(tmp, rel)
  fs.mkdirSync(path.dirname(abs), { recursive: true })
  fs.writeFileSync(abs, content)
}

function readFile(rel: string) {
  return fs.readFileSync(path.join(tmp, rel), 'utf-8')
}

describe('snapshot', () => {
  it('captures files and restores them to the snapshot state', async () => {
    writeFile('a.txt', 'one')
    writeFile('sub/b.txt', 'two')

    await createSnapshot(tmp, 42, 5)

    writeFile('a.txt', 'CHANGED')
    writeFile('sub/b.txt', 'CHANGED-2')

    const restored = await restoreSnapshot(42)
    expect(restored).toEqual({ conversationLength: 5 })
    expect(readFile('a.txt')).toBe('one')
    expect(readFile('sub/b.txt')).toBe('two')
  })

  it('returns null when there is no snapshot for the message id', async () => {
    expect(await restoreSnapshot(999)).toBeNull()
  })

  it('removes snapshots at and after the restored id', async () => {
    await createSnapshot(tmp, 1, 1)
    await createSnapshot(tmp, 2, 2)

    await restoreSnapshot(1)
    expect(listSnapshotIds()).toEqual([])
  })

  it('ignores node_modules in captures', async () => {
    writeFile('node_modules/pkg/index.js', 'secret')
    writeFile('keep.txt', 'visible')

    await createSnapshot(tmp, 7, 1)
    writeFile('keep.txt', 'changed')

    await restoreSnapshot(7)
    expect(readFile('keep.txt')).toBe('visible')
  })
})
