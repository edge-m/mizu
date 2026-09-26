import { spawn } from 'node:child_process'
import { writeFile } from 'node:fs/promises'

const arg = (name: string, fallback: string) =>
  process.argv.find((value) => value.startsWith(`--${name}=`))?.split('=')[1] ?? fallback
const runs = Number(arg('runs', '3'))
const duration = Number(arg('duration', '10'))
const concurrency = Number(arg('concurrency', '500'))
const bombardier = process.env.BOMBARDIER ?? 'bombardier'
const bodyFile = '/tmp/mizu-hono-benchmark-body.json'
await writeFile(bodyFile, '{"hello":"world"}\n')

const endpoints = [
  { name: 'ping', method: 'GET', url: '/' },
  { name: 'json', method: 'GET', url: '/user' },
  { name: 'path-query', method: 'GET', url: '/id/1?name=bench' },
  { name: 'multi-route', method: 'GET', url: '/items/42/action-3' },
  { name: 'middleware', method: 'GET', url: '/mw/hello' },
  { name: 'body', method: 'POST', url: '/json', body: true },
]

function runCommand(command: string, args: string[], options: { cwd?: string } = {}) {
  return new Promise<{ stdout: string; stderr: string }>((resolve, reject) => {
    const child = spawn(command, args, { ...options, stdio: ['ignore', 'pipe', 'pipe'] })
    let stdout = ''
    let stderr = ''
    child.stdout.on('data', (chunk) => { stdout += chunk })
    child.stderr.on('data', (chunk) => { stderr += chunk })
    child.on('error', reject)
    child.on('close', (code) => code === 0
      ? resolve({ stdout, stderr })
      : reject(new Error(`${command} failed with ${code}\n${stdout}\n${stderr}`)))
  })
}

async function startServer(framework: string, port: number) {
  const child = spawn(process.execPath, ['--import', 'tsx', 'benchmarks/http-server/server.mts', `--framework=${framework}`, `--port=${port}`], {
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  let output = ''
  let errors = ''
  child.stdout.on('data', (chunk) => { output += chunk })
  child.stderr.on('data', (chunk) => { errors += chunk })
  await new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error(`server readiness timeout\n${output}\n${errors}`)), 10_000)
    child.stdout.on('data', (chunk) => {
      if (String(chunk).includes('READY')) {
        clearTimeout(timeout)
        resolve()
      }
    })
    child.once('error', reject)
    child.once('exit', (code) => reject(new Error(`server exited before readiness: ${code}\n${output}\n${errors}`)))
  })
  return child
}

async function validate(baseUrl: string) {
  const ping = await fetch(`${baseUrl}/`)
  if (ping.status !== 200 || await ping.text() !== 'Hi') throw new Error('GET / validation failed')
  const pathQuery = await fetch(`${baseUrl}/id/1?name=bench`)
  if (pathQuery.headers.get('x-powered-by') !== 'benchmark' || await pathQuery.text() !== '1 bench') throw new Error('path/query validation failed')
  const body = await fetch(`${baseUrl}/json`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: '{"hello":"world"}',
  })
  if (!body.headers.get('content-type')?.includes('application/json') || await body.text() !== '{"hello":"world"}') throw new Error('POST /json validation failed')
}

function parseResult(output: string) {
  const reqs = output.match(/Reqs\/sec\s+([\d,.]+)/i)
  const latency = output.match(/Latency\s+([\d.]+\s*\w+)/i)
  if (!reqs) throw new Error(`could not parse bombardier output\n${output}`)
  return { reqsPerSec: Number(reqs[1].replaceAll(',', '')), latency: latency?.[1] ?? null, raw: output }
}

async function measureFramework(framework: string, port: number) {
  const allRuns: Record<string, unknown>[][] = []
  for (let run = 0; run < runs; run += 1) {
    const server = await startServer(framework, port)
    const baseUrl = `http://127.0.0.1:${port}`
    try {
      await validate(baseUrl)
      const result: Record<string, unknown>[] = []
      for (const endpoint of endpoints) {
        const args = ['--fasthttp', '-c', String(concurrency), '-d', `${duration}s`]
        if (endpoint.body) args.push('-m', 'POST', '-H', 'Content-Type:application/json', '-f', bodyFile)
        result.push({ name: endpoint.name, ...parseResult((await runCommand(bombardier, [...args, `${baseUrl}${endpoint.url}`])).stdout) })
      }
      allRuns.push(result)
    } finally {
      server.kill('SIGTERM')
      await new Promise((resolve) => server.once('exit', resolve))
    }
  }
  return { framework, runs: allRuns }
}

console.log(JSON.stringify({ duration, concurrency, results: [await measureFramework('mizu', 3100), await measureFramework('hono', 3101)] }, null, 2))
