export interface ToolParameter {
  name: string
  type: 'string' | 'number' | 'boolean' | 'array'
  description: string
  required: boolean
  default?: unknown
}

export interface ToolJsonSchema {
  type: 'object'
  properties: Record<string, { type: string; description: string; default?: unknown }>
  required: string[]
  [key: string]: unknown
}

export interface ToolDefinition {
  name: string
  description: string
  parameters: ToolParameter[]
  jsonSchema: ToolJsonSchema
}

export interface ToolResult {
  success: boolean
  output: string
  error?: string
}

/** Gera o JSON Schema canônico de uma tool a partir dos seus `ToolParameter`. */
export function toolParametersToJsonSchema(parameters: ToolParameter[]): ToolJsonSchema {
  return {
    type: 'object',
    properties: Object.fromEntries(
      parameters.map((p) => [
        p.name,
        { type: p.type, description: p.description, ...(p.default !== undefined ? { default: p.default } : {}) },
      ]),
    ),
    required: parameters.filter((p) => p.required).map((p) => p.name),
  }
}

/** Valida argumentos contra um JSON Schema de tool. Retorna erro legível ou null. */
export function validateArgsAgainstSchema(args: Record<string, unknown>, schema: ToolJsonSchema): string | null {
  for (const req of schema.required) {
    const value = args[req]
    if (value === undefined || value === null) {
      return `Missing required parameter: ${req}`
    }
  }

  for (const [key, prop] of Object.entries(schema.properties)) {
    const value = args[key]
    if (value === undefined || value === null) continue
    switch (prop.type) {
      case 'string':
        if (typeof value !== 'string') return `Parameter "${key}" must be a string`
        break
      case 'number':
        if (typeof value !== 'number') return `Parameter "${key}" must be a number`
        break
      case 'boolean':
        if (typeof value !== 'boolean') return `Parameter "${key}" must be a boolean`
        break
      case 'array':
        if (!Array.isArray(value)) return `Parameter "${key}" must be an array`
        break
    }
  }

  return null
}

export abstract class BaseTool {
  abstract name: string
  abstract description: string
  abstract parameters: ToolParameter[]

  /** Injected by ToolRegistry before execute() — tools call this right before performing I/O */
  onProgress?: (event: string, data?: Record<string, unknown>) => void

  getJsonSchema(): ToolJsonSchema {
    return toolParametersToJsonSchema(this.parameters)
  }

  getDefinition(): ToolDefinition {
    return {
      name: this.name,
      description: this.description,
      parameters: this.parameters,
      jsonSchema: this.getJsonSchema(),
    }
  }

  abstract execute(args: Record<string, unknown>): Promise<ToolResult>

  protected validateArgs(args: Record<string, unknown>): string | null {
    for (const param of this.parameters) {
      if (param.required && !(param.name in args)) {
        return `Missing required parameter: ${param.name}`
      }
    }
    return null
  }

  protected success(output: string): ToolResult {
    return { success: true, output }
  }

  protected failure(error: string): ToolResult {
    return { success: false, output: '', error }
  }
}
