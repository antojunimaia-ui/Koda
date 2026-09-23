#!/usr/bin/env node
/**
 * Koda DevTools — Commiter
 *
 * Analyzes the current git diff and generates a Conventional Commits message
 * using Mistral AI (codestral-latest).
 *
 * Usage:
 *   node DevTools/commiter.mjs           — normal mode
 *   node DevTools/commiter.mjs --debug   — prints full prompt sent to the model
 */

import { execSync }         from 'node:child_process'
import * as readline        from 'node:readline/promises'
import { stdin as input, stdout as output } from 'node:process'
import https                from 'node:https'
import { readFileSync }     from 'node:fs'
import { fileURLToPath }    from 'node:url'
import path                 from 'node:path'

const __dirname     = path.dirname(fileURLToPath(import.meta.url))
const REPO_ROOT     = path.resolve(__dirname, '..')
const MISTRAL_MODEL = 'codestral-latest'
const DEBUG         = process.argv.includes('--debug')

// ── ANSI helpers ──────────────────────────────────────────────────────────────

const c = {
  reset:    '\x1b[0m',
  bold:     '\x1b[1m',
  dim:      '\x1b[2m',
  cyan:     '\x1b[36m',
  cyanB:    '\x1b[1;36m',
  green:    '\x1b[32m',
  greenB:   '\x1b[1;32m',
  yellow:   '\x1b[33m',
  red:      '\x1b[31m',
  white:    '\x1b[97m',
  whiteB:   '\x1b[1;97m',
  magenta:  '\x1b[35m',
  gray:     '\x1b[90m',
}

const paint = (color, text) => `${color}${text}${c.reset}`

// ── Spinner ───────────────────────────────────────────────────────────────────

function createSpinner(label) {
  const frames = ['⠋','⠙','⠹','⠸','⠼','⠴','⠦','⠧','⠇','⠏']
  let i = 0
  const interval = setInterval(() => {
    process.stdout.write(`\r  ${paint(c.cyan, frames[i++ % frames.length])}  ${paint(c.dim, label)}`)
  }, 80)
  return {
    succeed(msg) {
      clearInterval(interval)
      process.stdout.write(`\r  ${paint(c.greenB, '✔')}  ${paint(c.white, msg)}\n`)
    },
    fail(msg) {
      clearInterval(interval)
      process.stdout.write(`\r  ${paint(c.red, '✘')}  ${paint(c.red, msg)}\n`)
    },
  }
}

// ── Layout ────────────────────────────────────────────────────────────────────

const W = 62

function line(char = '─') {
  return paint(c.gray, char.repeat(W))
}

function header() {
  const title  = ' KODA  COMMITER '
  const sub    = ' conventional commit generator '
  const pad    = (str, w) => {
    const p = Math.max(0, w - str.replace(/\x1b\[[0-9;]*m/g, '').length)
    return str + ' '.repeat(p)
  }

  console.log()
  console.log(line('━'))
  console.log(
    paint(c.cyanB, '  ◆') +
    paint(c.whiteB, title) +
    paint(c.gray, '·') +
    paint(c.dim, sub)
  )
  console.log(line('━'))
  console.log()
}

function section(icon, label, value) {
  console.log(`  ${paint(c.cyan, icon)}  ${paint(c.dim, label + ':')}  ${paint(c.white, value)}`)
}

function result(message) {
  console.log()
  console.log(line())
  console.log()
  // Indent each line of the commit message
  message.split('\n').forEach((ln, i) => {
    if (i === 0) {
      console.log('  ' + paint(c.cyanB, ln))
    } else if (ln.trimStart().startsWith('-')) {
      console.log('  ' + paint(c.dim, ln))
    } else {
      console.log('  ' + paint(c.gray, ln))
    }
  })
  console.log()
  console.log(line())
  console.log()
  console.log(`  ${paint(c.greenB, '✔')}  ${paint(c.dim, 'Copy the message above and use it in your commit.')}`)
  console.log()
}

// ── Project conventions ───────────────────────────────────────────────────────

function loadConventions() {
  try {
    return readFileSync(path.join(REPO_ROOT, 'Agents Instructions', 'COMMIT_CONVENTIONS.md'), 'utf8')
  } catch {
    return ''
  }
}

// ── Git helpers ───────────────────────────────────────────────────────────────

function getDiff() {
  try {
    return execSync('git diff HEAD', { encoding: 'utf8', maxBuffer: 1024 * 1024 * 10 })
  } catch {
    console.error(paint(c.red, '\n  ✘  Failed to run git diff. Are you inside a git repository?\n'))
    process.exit(1)
  }
}

function getStagedDiff() {
  try {
    return execSync('git diff --cached', { encoding: 'utf8', maxBuffer: 1024 * 1024 * 10 })
  } catch {
    return ''
  }
}

function truncate(text, maxChars = 28000) {
  if (text.length <= maxChars) return text
  return text.slice(0, maxChars) + '\n\n... [diff truncated for token limit]'
}

// ── Mistral ───────────────────────────────────────────────────────────────────

async function askMistral(apiKey, diff) {
  const conventions = loadConventions()

  const systemPrompt = `You are an expert software engineer writing commit messages for the Koda project.

${conventions ? `The project follows these commit conventions:\n\n${conventions}\n\n` : ''}Additional rules specific to Koda:
- Scopes to use: agent, ui, ipc, tools, providers, services, renderer, preload, config, devtools, docs
- Summary: imperative mood, English, lowercase, no period, max 72 chars
- Body: write ONE bullet per CONCERN, not per file. A concern is a logical reason for a change.
- WRONG (file-per-bullet):
    - update useInputHandlers to fetch commands dynamically
    - update useMessageActions to fetch commands dynamically
    - update README.md to document new file
    - update README.md to document new command
- RIGHT (concern-per-bullet):
    - remove hardcoded command arrays from UI; both hooks now fetch via IPC on mount
    - update README architecture and native commands table to reflect changes
- Each bullet answers "what changed AND why", not "which file was touched"
- Maximum 5 bullets — merge minor or related changes into one
- Omit pure documentation bullets unless docs is the main point of the commit
- NEVER add closing paragraphs, summaries, or prose after the bullets
- Output ONLY the raw commit message — no markdown fences, no preamble, no postamble`

  const userPrompt = `Analyze this git diff and write a Conventional Commits message for it:\n\n${diff}`

  if (DEBUG) {
    console.log(line('━'))
    console.log(paint(c.yellow, '  DEBUG — system prompt:\n'))
    console.log(paint(c.dim, systemPrompt))
    console.log('\n' + line('━'))
    console.log(paint(c.yellow, '  DEBUG — user prompt (first 2000 chars):\n'))
    console.log(paint(c.dim, userPrompt.slice(0, 2000)))
    console.log('\n' + line('━') + '\n')
  }

  const body = JSON.stringify({
    model: MISTRAL_MODEL,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user',   content: userPrompt   },
    ],
    temperature: 0.2,
    max_tokens: 512,
  })

  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.mistral.ai',
      path: '/v1/chat/completions',
      method: 'POST',
      rejectUnauthorized: false,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'Content-Length': Buffer.byteLength(body),
      },
    }

    const req = https.request(options, (res) => {
      let data = ''
      res.on('data', chunk => { data += chunk })
      res.on('end', () => {
        if (res.statusCode !== 200) {
          reject(new Error(`Mistral API error ${res.statusCode}: ${data}`))
          return
        }
        try {
          const parsed = JSON.parse(data)
          const raw = parsed.choices?.[0]?.message?.content?.trim() ?? ''
          // Strip markdown fences the model sometimes adds despite instructions
          const clean = raw.replace(/^```[\w]*\n?/gm, '').replace(/^```$/gm, '').trim()
          resolve(clean)
        } catch {
          reject(new Error(`Failed to parse response: ${data}`))
        }
      })
    })

    req.on('error', (err) => reject(new Error(`Request failed: ${err.message}`)))
    req.write(body)
    req.end()
  })
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  header()

  // 1. Get API key
  const rl = readline.createInterface({ input, output })
  process.stdout.write(`  ${paint(c.cyan, '🔑')}  ${paint(c.dim, 'Mistral API key:')}  `)
  const apiKey = await rl.question('')
  rl.close()

  if (!apiKey.trim()) {
    console.error(`\n  ${paint(c.red, '✘')}  ${paint(c.red, 'No API key provided.')}\n`)
    process.exit(1)
  }

  // 2. Get diff
  console.log()
  const diffSpinner = createSpinner('Reading git diff...')
  let diff = getStagedDiff()
  if (!diff.trim()) diff = getDiff()

  if (!diff.trim()) {
    diffSpinner.succeed('No changes detected — nothing to commit.')
    console.log()
    process.exit(0)
  }

  const truncated  = truncate(diff)
  const lineCount  = truncated.split('\n').length
  const fileCount  = [...new Set(truncated.match(/^diff --git .+/gm) || [])].length
  diffSpinner.succeed(`${fileCount} file(s) · ${lineCount} lines of diff`)

  // 3. Call Mistral
  console.log()
  const mistralSpinner = createSpinner(`Asking ${MISTRAL_MODEL}...`)
  let message
  try {
    message = await askMistral(apiKey.trim(), truncated)
    mistralSpinner.succeed('Message generated')
  } catch (err) {
    mistralSpinner.fail(err.message)
    process.exit(1)
  }

  // 4. Print result
  result(message)
}

main()
