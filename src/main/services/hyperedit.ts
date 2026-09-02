import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { Agent } from '../core/agent.js'

export interface HyperEditEvent {
  type: 'start' | 'agent_start' | 'agent_done' | 'complete' | 'error'
  agentId?: string
  message: string
}

interface WorkerResult {
  id: string
  files: string[]
  output: string
  error?: string
}

export interface HyperEditPlan {
  agents: Array<{ files: string[]; prompt: string }>
}

function parseRequest(request: string): { task: string; agentCount: number; files: string[] } {
  let agentCount = 1
  const agentMatch = request.match(/(?:--agents?|--swarm)\s+(\d+)/i)
  if (agentMatch) agentCount = Math.max(1, Math.min(5, Number(agentMatch[1])))

  const files: string[] = []
  const filesMatch = request.match(/--files?\s+(.+?)(?=\s+--\w+|$)/i)
  if (filesMatch) {
    files.push(...filesMatch[1].split(/[;,\s]+/).map(file => file.trim()).filter(Boolean))
  }

  const task = request
    .replace(/--agents?\s+\d+/i, '')
    .replace(/--swarm\s+\d+/i, '')
    .replace(/--files?\s+(.+?)(?=\s+--\w+|$)/i, '')
    .trim()

  return { task, agentCount, files: [...new Set(files)] }
}

function isInside(root: string, candidate: string): boolean {
  const relative = path.relative(root, candidate)
  return relative === '' || (relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative))
}

async function resolveAllowedFiles(cwd: string, requestFiles: string[]): Promise<string[]> {
  const resolved: string[] = []
  for (const file of requestFiles) {
    const absolute = path.resolve(cwd, file.replace(/^@\[|\]$/g, ''))
    if (!isInside(cwd, absolute)) throw new Error(`Arquivo fora do workspace: ${file}`)
    const stats = await fs.stat(absolute).catch(() => null)
    if (!stats?.isFile()) throw new Error(`Arquivo não encontrado: ${file}`)
    resolved.push(absolute)
  }
  return [...new Set(resolved)]
}

async function discoverCandidateFiles(cwd: string): Promise<string[]> {
  const { globby } = await import('globby')
  const files = await globby(['**/*'], {
    cwd,
    absolute: false,
    onlyFiles: true,
    dot: false,
    ignore: ['node_modules/**', '.git/**', 'dist/**', 'dist-electron/**', 'release-build/**', '*.lock', '**/*.min.*'],
  })
  return files.filter(file => /\.(ts|tsx|js|jsx|mjs|cjs|json|css|scss|html|py|go|rs|java|kt|swift|vue|svelte)$/i.test(file)).slice(0, 300)
}

function splitIntoGroups<T>(items: T[], count: number): T[][] {
  const groups = Array.from({ length: Math.min(count, items.length) }, () => [] as T[])
  items.forEach((item, index) => groups[index % groups.length].push(item))
  return groups
}

async function copyFiles(files: string[], cwd: string, tempRoot: string): Promise<void> {
  await Promise.all(files.map(async file => {
    const destination = path.join(tempRoot, path.relative(cwd, file))
    await fs.mkdir(path.dirname(destination), { recursive: true })
    await fs.copyFile(file, destination)
  }))
}

export async function runHyperEdit(
  request: string,
  cwd: string,
  onEvent: (event: HyperEditEvent) => void,
  coordinator?: (task: string, candidates: string[], requestedAgents: number) => Promise<HyperEditPlan>
): Promise<string> {
  const parsed = parseRequest(request)
  if (!parsed.task) throw new Error('Use: /hyperedit <tarefa> --files arquivo1 arquivo2 [--agents 1-5]')

  const mentionedFiles = [...parsed.task.matchAll(/(?:@\[([^\]]+)\]|([\w./\\-]+\.[\w]+))/g)].map(match => match[1] || match[2])
  const explicitFiles = [...new Set([...parsed.files, ...mentionedFiles])]
  const candidates = explicitFiles.length > 0 ? explicitFiles : await discoverCandidateFiles(cwd)
  const plan = coordinator
    ? await coordinator(parsed.task, candidates, parsed.agentCount)
    : { agents: [{ files: candidates, prompt: parsed.task }] }

  const plannedFiles = plan.agents.flatMap(agent => agent.files)
  const files = await resolveAllowedFiles(cwd, [...new Set(plannedFiles)])
  if (files.length === 0) {
    throw new Error('O coordenador não selecionou arquivos editáveis para esta tarefa.')
  }

  const fileSet = new Set(files.map(file => path.normalize(file)))
  const groups = plan.agents.map(agent => ({
    files: [...new Set(agent.files.map(file => path.resolve(cwd, file)).filter(file => fileSet.has(path.normalize(file))))],
    prompt: agent.prompt || parsed.task,
  })).filter(group => group.files.length > 0).slice(0, 5)
  if (groups.length === 0) throw new Error('O coordenador criou um plano sem arquivos válidos.')
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'koda-hyperedit-'))
  onEvent({ type: 'start', message: `HyperEdit iniciou com ${groups.length} agente(s) e ${files.length} arquivo(s).` })

  try {
    const results = await Promise.all(groups.map(async (group, index): Promise<WorkerResult> => {
      const id = `hyperedit-${index + 1}`
      const workerRoot = path.join(tempRoot, id)
      await fs.mkdir(workerRoot, { recursive: true })
      await copyFiles(group.files, cwd, workerRoot)
      const relativeFiles = group.files.map(file => path.relative(cwd, file).replace(/\\/g, '/'))
      onEvent({ type: 'agent_start', agentId: id, message: `${id} editando: ${relativeFiles.join(', ')}` })

      const worker = new Agent()
      worker.setCwd(workerRoot)
      await worker.initialize()
      const output: string[] = []
      let error: string | undefined
      await worker.processMessage(
        `${group.prompt}\n\nHYPEREDIT SCOPE (obrigatório): edite somente estes arquivos: ${relativeFiles.join(', ')}. Não crie, remova ou modifique qualquer outro arquivo. Trabalhe diretamente nos arquivos autorizados e conclua a edição.`,
        text => output.push(text),
        () => undefined,
        () => undefined,
        () => undefined,
        message => { error = message }
      )
      onEvent({ type: 'agent_done', agentId: id, message: error ? `${id} falhou: ${error}` : `${id} concluiu.` })
      return { id, files: relativeFiles, output: output.join(''), error }
    }))

    const failures = results.filter(result => result.error)
    if (failures.length > 0) throw new Error(`HyperEdit falhou em ${failures.map(result => result.id).join(', ')}.`)

    let changed = 0
    for (const result of results) {
      const workerRoot = path.join(tempRoot, result.id)
      for (const relativeFile of result.files) {
        const source = path.join(workerRoot, relativeFile)
        const destination = path.join(cwd, relativeFile)
        const next = await fs.readFile(source, 'utf8')
        const previous = await fs.readFile(destination, 'utf8')
        if (next !== previous) {
          await fs.writeFile(destination, next, 'utf8')
          changed++
        }
      }
    }

    const summary = `HyperEdit concluído: ${changed} arquivo(s) alterado(s) por ${results.length} agente(s).`
    onEvent({ type: 'complete', message: summary })
    return summary
  } finally {
    await fs.rm(tempRoot, { recursive: true, force: true }).catch(() => undefined)
  }
}
