import { describe, expect, it } from 'vitest'
import { toolParametersToJsonSchema, validateArgsAgainstSchema } from '../base.js'
import { FileEditTool } from '../file-edit.js'
import { FileReadTool } from '../file-read.js'

describe('toolParametersToJsonSchema', () => {
  it('maps parameters into properties and required lists', () => {
    const schema = toolParametersToJsonSchema([
      { name: 'path', type: 'string', description: 'File path', required: true },
      { name: 'max_results', type: 'number', description: 'Limit', required: false, default: 100 },
    ])

    expect(schema.type).toBe('object')
    expect(schema.required).toEqual(['path'])
    expect(schema.properties.path).toMatchObject({ type: 'string', description: 'File path' })
    expect(schema.properties.max_results).toMatchObject({ type: 'number', default: 100 })
  })
})

describe('validateArgsAgainstSchema', () => {
  const schema = toolParametersToJsonSchema([
    { name: 'path', type: 'string', description: 'Path', required: true },
    { name: 'lines', type: 'number', description: 'Lines', required: false },
    { name: 'force', type: 'boolean', description: 'Force', required: false },
    { name: 'items', type: 'array', description: 'Items', required: false },
  ])

  it('returns null for valid arguments', () => {
    expect(validateArgsAgainstSchema({ path: '/x', lines: 5, force: true, items: ['a'] }, schema)).toBeNull()
  })

  it('rejects missing required parameters', () => {
    expect(validateArgsAgainstSchema({}, schema)).toBe('Missing required parameter: path')
    expect(validateArgsAgainstSchema({ path: null }, schema)).toBe('Missing required parameter: path')
  })

  it('rejects wrong types', () => {
    expect(validateArgsAgainstSchema({ path: 42 }, schema)).toContain('"path" must be a string')
    expect(validateArgsAgainstSchema({ path: 'x', lines: '5' }, schema)).toContain('"lines" must be a number')
    expect(validateArgsAgainstSchema({ path: 'x', force: 'yes' }, schema)).toContain('"force" must be a boolean')
    expect(validateArgsAgainstSchema({ path: 'x', items: 'not-array' }, schema)).toContain('"items" must be an array')
  })

  it('ignores extra keys not present in the schema', () => {
    expect(validateArgsAgainstSchema({ path: 'x', __cwd: '/tmp' }, schema)).toBeNull()
  })
})

describe('tool schemas (real tools)', () => {
  it('FileEditTool exposes required path/target/replacement', () => {
    const schema = new FileEditTool().getJsonSchema()
    expect(schema.required).toEqual(['path', 'target', 'replacement'])
    expect(schema.properties.path.type).toBe('string')
  })

  it('FileReadTool marks start_line/end_line as optional numbers', () => {
    const schema = new FileReadTool().getJsonSchema()
    expect(schema.required).toEqual(['path'])
    expect(schema.properties.start_line).toMatchObject({ type: 'number' })
    expect(schema.required).not.toContain('start_line')
  })
})
