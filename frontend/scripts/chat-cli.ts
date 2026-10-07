// 카카오톡 대화 CSV를 앱과 같은 함수로 읽어 통계, 프롬프트, 실제 분석 결과를 보여준다.
// 사용법: npm run chat -- <csv 경로> [--days 30|all] [--me 이름] [--prompt] [--live]
import { existsSync, readFileSync } from 'node:fs'
import { basename, resolve } from 'node:path'
import { parseArgs } from 'node:util'
import Papa from 'papaparse'
import { analyzeChat, buildPrompt } from '../src/analyze.ts'
import { filterRecentDays, getParticipants, parseKakaoCsv, toTranscript, type Message } from '../src/chat.ts'

const USAGE = '사용법: npm run chat -- <csv 경로> [--days 30|all] [--me 이름] [--prompt] [--live]'
const PERIODS = [7, 30, 90, null]
const DEFAULT_MODEL = 'gpt-5.5' // vite.config.ts의 기본값과 같게 둔다.
const ROOT_ENV = new URL('../../.env', import.meta.url)

function fail(message: string): never {
  console.error(message)
  process.exit(1)
}

function periodLabel(days: number | null) {
  return days === null ? '전체' : `최근 ${days}일`
}

function countBy<T>(items: T[], key: (item: T) => string | null) {
  const counts = new Map<string, number>()
  for (const item of items) {
    const k = key(item)
    if (k !== null) counts.set(k, (counts.get(k) ?? 0) + 1)
  }
  return [...counts].sort((a, b) => b[1] - a[1])
}

// "파일: a.pdf"처럼 "단어: "로 시작하면 접두어로, 짧은 메시지는 숫자를 N으로 바꿔 묶는다.
function noiseKey({ text }: Message) {
  const prefix = text.match(/^(\S{1,6}): /)
  if (prefix) return `${prefix[1]}: …`
  return text.length <= 20 ? text.replace(/\d+/g, 'N') : null
}

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    days: { type: 'string', default: '30' },
    me: { type: 'string', default: '' },
    prompt: { type: 'boolean', default: false },
    live: { type: 'boolean', default: false },
    help: { type: 'boolean', short: 'h', default: false },
  },
})

const [file] = positionals
if (values.help || !file) fail(USAGE)
const days = values.days === 'all' ? null : Number(values.days)
if (days !== null && !(Number.isInteger(days) && days > 0)) fail(`--days는 양의 정수나 all이어야 합니다: ${values.days}`)
const me = values.me

try {
  // npm run은 frontend/에서 실행되므로 상대 경로는 명령을 친 위치 기준으로 푼다.
  const text = readFileSync(resolve(process.env.INIT_CWD ?? '.', file), 'utf8')
  const messages = parseKakaoCsv(text)
  const rows = Papa.parse(text, { header: true, skipEmptyLines: true }).data.length
  const participants = getParticipants(messages)

  console.log(`파일: ${basename(file)}`)
  console.log(`행 ${rows}개 → 메시지 ${messages.length}개 (내용 없는 메시지 등 ${rows - messages.length}개 제외)`)
  if (messages.length === 0) fail('메시지가 없습니다.')
  console.log(`기간: ${messages[0].date.slice(0, 16)} ~ ${messages.at(-1)?.date.slice(0, 16)}`)

  const byUser = countBy(messages, (m) => m.user)
  console.log(`\n참여자 ${participants.length}명: ${byUser.map(([user, n]) => `${user} ${n}`).join(', ')}`)

  const noise = countBy(messages, noiseKey).filter(([, n]) => n >= 2).slice(0, 10)
  console.log('\n노이즈 후보 (NOISE로 걸러지지 않은 짧거나 반복되는 메시지):')
  if (noise.length === 0) console.log('  없음')
  for (const [key, n] of noise) console.log(`  ${String(n).padStart(5)}회  ${JSON.stringify(key)}`)

  console.log('\n기간별 (마지막 메시지 기준):')
  for (const period of PERIODS) {
    const selected = filterRecentDays(messages, period)
    const chars = toTranscript(selected).length
    console.log(`  ${periodLabel(period).padEnd(7)} 메시지 ${String(selected.length).padStart(6)}개  ${chars.toLocaleString('ko-KR').padStart(9)}자`)
  }

  if (me && !participants.includes(me)) console.warn(`\n경고: "${me}"는 참여자가 아닙니다. (${participants.join(', ')})`)

  const selected = filterRecentDays(messages, days)
  const transcript = toTranscript(selected)
  console.log(`\n선택: ${periodLabel(days)}${me ? ` · 내 이름 ${me}` : ''} → 메시지 ${selected.length}개`)
  if ((values.prompt || values.live) && selected.length === 0) fail('선택한 기간에 메시지가 없습니다.')

  if (values.prompt) console.log(`\n--- 프롬프트 ---\n${buildPrompt(transcript, me)}`)

  if (values.live) {
    if (existsSync(ROOT_ENV)) process.loadEnvFile(ROOT_ENV)
    const apiKey = process.env.OPENAI_API_KEY ?? ''
    if (!apiKey) fail('OPENAI_API_KEY가 없습니다. 루트 .env에 넣어 주세요.')
    const model = process.env.OPENAI_MODEL || DEFAULT_MODEL
    console.log(`\n--- 분석 결과 (${model}) ---`)
    const started = performance.now()
    const result = await analyzeChat(transcript, { apiKey, model, me })
    console.log(JSON.stringify(result, null, 2))
    console.log(`(${((performance.now() - started) / 1000).toFixed(1)}초)`)
  }
} catch (err) {
  // API 에러 메시지에 키 일부가 섞여 나올 수 있어 가린다.
  fail(`오류: ${(err instanceof Error ? err.message : String(err)).replace(/sk-[\w*-]+/g, 'sk-…')}`)
}
