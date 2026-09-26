import { spawn } from 'node:child_process'

const rounds = Number(process.env.BENCH_ROUNDS ?? 3)
const caseFilter = process.env.BENCH_CASE ?? ''
const frameworks = ['mizu', 'hono']

function median(values) {
  const sorted = [...values].sort((a, b) => a - b)
  return sorted[Math.floor(sorted.length / 2)]
}

function runOne(framework) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ['--import', 'tsx', 'benchmarks/fetch/bench.mts'], {
      env: { ...process.env, BENCH_FRAMEWORK: framework, BENCH_LABEL: framework, BENCH_JSON: '1', BENCH_CASE: caseFilter },
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    let stdout = ''
    let stderr = ''
    child.stdout.on('data', (chunk) => { stdout += chunk })
    child.stderr.on('data', (chunk) => { stderr += chunk })
    child.on('error', reject)
    child.on('close', (code) => {
      if (code !== 0) return reject(new Error(`${framework} fetch benchmark failed (${code})\n${stderr}`))
      try { resolve(JSON.parse(stdout)) } catch (error) { reject(new Error(`invalid ${framework} JSON output: ${error}\n${stdout}`)) }
    })
  })
}

const raw = []
for (let round = 0; round < rounds; round += 1) {
  const order = round % 2 === 0 ? frameworks : [...frameworks].reverse()
  const values = {}
  for (const framework of order) values[framework] = await runOne(framework)
  raw.push(values)
}

const names = Object.keys(raw[0].mizu.cases)
const summary = {}
for (const name of names) {
  const mizu = raw.map((round) => round.mizu.cases[name].p50)
  const hono = raw.map((round) => round.hono.cases[name].p50)
  summary[name] = {
    mizuP50: median(mizu),
    honoP50: median(hono),
    ratio: median(mizu) / median(hono),
    mizuRaw: mizu,
    honoRaw: hono,
  }
}
console.log(JSON.stringify({ rounds, summary, raw }, null, 2))
