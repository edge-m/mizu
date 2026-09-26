import os from 'node:os'
import { execFileSync } from 'node:child_process'
import { readFile } from 'node:fs/promises'

const packageJson = JSON.parse(await readFile(new URL('../package.json', import.meta.url)))
const git = (args) => execFileSync('git', args, { encoding: 'utf8' }).trim()
console.log(JSON.stringify({
  date: new Date().toISOString(),
  runtime: process.version,
  platform: `${process.platform}-${process.arch}`,
  os: `${os.type()} ${os.release()}`,
  cpu: os.cpus()[0]?.model,
  logicalCpuCount: os.cpus().length,
  mizuVersion: packageJson.version,
  honoVersion: packageJson.devDependencies.hono,
  mizuCommit: git(['rev-parse', 'HEAD']),
  bombardier: process.env.BOMBARDIER ?? 'PATH lookup at runtime',
}, null, 2))
