// ─── Schemas Zod compartilhados ────────────────────────────────────────────────
// Fonte única de validação para payloads que cruzam fronteiras (IPC, KoClaw,
// configuração). Use `z.infer` para derivar tipos — sem duplicação manual.

import { z } from 'zod'

// ── Configuração do agente (IPC: agent:setup) ──────────────────────────────
export const SetupConfigSchema = z.object({
  provider: z.string().optional(),
  model: z.string().optional(),
  advisorModel: z.string().optional(),
  apiKey: z.string().optional(),
  kodaCloudBaseUrl: z.string().optional(),
})
export type SetupConfig = z.infer<typeof SetupConfigSchema>

// ── Listas de comandos aprovados (IPC: agent:update_approved_commands) ─────
export const ApprovedCommandsSchema = z.object({
  base: z.array(z.string()).optional(),
  full: z.array(z.string()).optional(),
})
export type ApprovedCommands = z.infer<typeof ApprovedCommandsSchema>

// ── Payload do KoClaw (POST /message) ───────────────────────────────────────
export const KoClawMessageSchema = z.object({
  message: z.string().trim().min(1),
})
export type KoClawMessage = z.infer<typeof KoClawMessageSchema>

// ── Configuração de início do KoClaw (IPC: koclaw:start) ───────────────────
export const KoClawStartConfigSchema = z.object({
  port: z.number().int().positive(),
  token: z.string().min(1),
  allowRemoteAccess: z.boolean().optional(),
  streaming: z.boolean().optional(),
})
export type KoClawStartConfig = z.infer<typeof KoClawStartConfigSchema>

// ── Variáveis de ambiente relevantes (config/settings.ts) ───────────────────
// Deriva da fonte única do registry de providers para nunca divergir.
import { LLM_PROVIDER_IDS } from './configDefaults.js'
export const LLM_PROVIDERS = LLM_PROVIDER_IDS

export const EnvironmentSettingsSchema = z.object({
  LLM_PROVIDER: z.enum(LLM_PROVIDERS).optional(),
  MAX_TOKENS: z.coerce.number().int().nonnegative().optional(),
  TEMPERATURE: z.coerce.number().min(0).max(2).optional(),
  WEBHOOK_ENABLED: z.enum(['true', 'false']).optional(),
  WEBHOOK_PORT: z.coerce.number().int().positive().optional(),
  WEBHOOK_TOKEN: z.string().optional(),
  KODA_CLOUD_BASE_URL: z.string().optional(),
})
export type EnvironmentSettings = z.infer<typeof EnvironmentSettingsSchema>

/**
 * Valida um objeto de ambiente (process.env) e retorna apenas as chaves
 * relevantes conhecidas. Não lança — inválidos são ignorados.
 */
export function sanitizeEnvironment(env: NodeJS.ProcessEnv): EnvironmentSettings {
  const result = EnvironmentSettingsSchema.safeParse(env)
  return result.success ? result.data : {}
}
