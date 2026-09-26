import { bench, measure, run } from 'mitata'
import {
  cases,
  getCaseRequest,
  makeHonoApp,
  makeMizuApp,
  makeRequests,
  type BenchmarkCase,
} from './apps.mts'

const argValue = (name: string) => process.argv.find((arg) => arg.startsWith(`--${name}=`))?.split('=')[1]
const framework = argValue('framework') ?? process.env.BENCH_FRAMEWORK ?? 'mizu'
const label = process.env.BENCH_LABEL ?? framework
const asJson = process.env.BENCH_JSON === '1'
const caseFilter = argValue('case') ?? process.env.BENCH_CASE
const selected = (caseFilter
  ? cases.filter((name) => name.startsWith(caseFilter))
  : [...cases]) as BenchmarkCase[]

if (framework !== 'mizu' && framework !== 'hono') {
  throw new Error(`BENCH_FRAMEWORK must be mizu or hono, got ${framework}`)
}
if (selected.length === 0) throw new Error(`no cases match BENCH_CASE=${caseFilter}`)

const app = framework === 'mizu' ? makeMizuApp() : makeHonoApp()
const requests = makeRequests()
let sink: unknown

const execute = async (name: BenchmarkCase) => {
  sink = await app.fetch(getCaseRequest(name, requests))
  if (!(sink instanceof Response)) throw new Error(`${name} did not return Response`)
  await sink.arrayBuffer()
}

// Hono's official benchmark warms every case before registering benches.
for (const name of cases) await execute(name)

if (asJson) {
  const results: Record<string, { p50: number; min: number; p75: number }> = {}
  for (const name of selected) {
    const stats = await measure(() => execute(name), {
      warmup_threshold: Number.MAX_SAFE_INTEGER,
      batch_threshold: Number.MAX_SAFE_INTEGER,
    })
    results[name] = { p50: stats.p50, min: stats.min, p75: stats.p75 }
  }
  console.log(JSON.stringify({ label, framework, cases: results }))
  console.error(typeof sink)
} else {
  for (const name of selected) {
    bench(name, () => execute(name))
  }
  console.log(`benchmarking: ${label}`)
  await run()
  console.log(typeof sink)
}
