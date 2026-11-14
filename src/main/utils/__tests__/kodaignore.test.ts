import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { checkKodaIgnore, filterKodaIgnore, invalidateKodaIgnoreCache } from '../kodaignore.js'

let tmp: string

beforeEach(() => {
  invalidateKodaIgnoreCache()
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'koda-ignore-'))
})

afterEach(() => {
  fs.rmSync(tmp, { recursive: true, force: true })
  invalidateKodaIgnoreCache()
})

function writeIgnore(content: string) {
  fs.writeFileSync(path.join(tmp, '.kodaignore'), content)
}

describe('checkKodaIgnore', () => {
  it('returns null when there is no .kodaignore', () => {
    expect(checkKodaIgnore(path.join(tmp, 'a.txt'), tmp)).toBeNull()
  })

  it('blocks a file matching a pattern', () => {
    writeIgnore('.env\n*.key')
    expect(checkKodaIgnore(path.join(tmp, '.env'), tmp)).not.toBeNull()
    expect(checkKodaIgnore(path.join(tmp, 'credentials.key'), tmp)).not.toBeNull()
  })

  it('blocks nested paths matching a glob pattern', () => {
    writeIgnore('private/**')
    expect(checkKodaIgnore(path.join(tmp, 'private', 'x.json'), tmp)).not.toBeNull()
  })

  it('allows paths that do not match', () => {
    writeIgnore('.env\n*.key')
    expect(checkKodaIgnore(path.join(tmp, 'src', 'app.ts'), tmp)).toBeNull()
    expect(checkKodaIgnore(path.join(tmp, 'package.json'), tmp)).toBeNull()
  })

  it('ignores comment lines and empty lines', () => {
    writeIgnore('# secrets\n\n*.key')
    expect(checkKodaIgnore(path.join(tmp, '.env'), tmp)).toBeNull()
    expect(checkKodaIgnore(path.join(tmp, 'a.key'), tmp)).not.toBeNull()
  })
})

describe('filterKodaIgnore', () => {
  it('returns everything allowed when no patterns exist', () => {
    const paths = ['a.ts', 'b.ts']
    const result = filterKodaIgnore(paths, tmp)
    expect(result.allowed).toEqual(paths)
    expect(result.blocked).toEqual([])
  })

  it('splits paths into allowed and blocked', () => {
    writeIgnore('*.key\n.env')
    const paths = ['a.ts', 'b.key', 'c/.env', 'd.ts']
    const result = filterKodaIgnore(paths, tmp)
    expect(result.allowed).toEqual(['a.ts', 'd.ts'])
    expect(result.blocked).toEqual(['b.key', 'c/.env'])
  })
})
