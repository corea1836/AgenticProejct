import { useState, type ChangeEvent } from 'react'
import { analyzeChat, mockAnalyzeChat, type Analysis } from './analyze'
import {
  filterRecentDays,
  getParticipants,
  parseKakaoCsv,
  toTranscript,
  type Message,
} from './chat'

const API_KEY_STORAGE = 'openai-api-key'
const ENV_API_KEY = import.meta.env.OPENAI_API_KEY
const MODEL = import.meta.env.OPENAI_MODEL
// npm run dev:mock: API를 호출하지 않고 예시 결과를 보여준다.
const MOCK = import.meta.env.MODE === 'mock'
const PREVIEW_ROWS = 5

const PRIORITY_LABEL = { high: '높음', medium: '보통', low: '낮음' } as const

const PERIODS = [
  { label: '최근 7일', days: 7 },
  { label: '최근 30일', days: 30 },
  { label: '최근 90일', days: 90 },
  { label: '전체', days: null },
]

function loadApiKey() {
  try {
    return localStorage.getItem(API_KEY_STORAGE) ?? ''
  } catch {
    return ''
  }
}

function saveApiKey(key: string) {
  try {
    localStorage.setItem(API_KEY_STORAGE, key)
  } catch {
    // 저장이 안 돼도 이번 세션에서는 그대로 쓸 수 있다.
  }
}

export default function App() {
  const [apiKey, setApiKey] = useState(() => ENV_API_KEY || loadApiKey())
  const [fileName, setFileName] = useState('')
  const [messages, setMessages] = useState<Message[]>([])
  const [periodIndex, setPeriodIndex] = useState(1)
  const [me, setMe] = useState('')
  const [result, setResult] = useState<Analysis | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const selected = filterRecentDays(messages, PERIODS[periodIndex].days)
  const participants = getParticipants(messages)

  function handleApiKeyChange(e: ChangeEvent<HTMLInputElement>) {
    setApiKey(e.target.value)
    saveApiKey(e.target.value)
  }

  async function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    setFileName(file.name)
    setResult(null)
    setMe('')
    try {
      const parsed = parseKakaoCsv(await file.text())
      setMessages(parsed)
      setError(parsed.length === 0 ? 'CSV에서 메시지를 찾지 못했습니다.' : '')
    } catch (err) {
      setMessages([])
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  async function handleAnalyze() {
    if (!selected.length || !(MOCK || apiKey)) return
    setLoading(true)
    setError('')
    setResult(null)
    try {
      const transcript = toTranscript(selected)
      const analysis = MOCK
        ? await mockAnalyzeChat(transcript, { me })
        : await analyzeChat(transcript, { apiKey: apiKey.trim(), model: MODEL, me })
      setResult(analysis)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <main>
      <header>
        <h1>채팅 분석기</h1>
        <p className="muted">카카오톡 대화 CSV를 올리면 요약과 액션 아이템을 만들어 드립니다.</p>
      </header>

      <section className="card">
        {MOCK ? (
          <p className="muted">mock 모드: 실제 API를 호출하지 않고 예시 결과를 보여줍니다.</p>
        ) : ENV_API_KEY ? (
          <p className="muted">API 키: 루트 .env의 OPENAI_API_KEY 사용 중 · 모델 {MODEL}</p>
        ) : (
          <label className="field">
            <span>OpenAI API Key</span>
            <input
              type="password"
              placeholder="sk-..."
              value={apiKey}
              onChange={handleApiKeyChange}
            />
            <small className="muted">
              루트 .env에 OPENAI_API_KEY를 넣거나 여기에 입력하세요. 로컬 프로토타입 용도로만 사용하세요. (모델 {MODEL})
            </small>
          </label>
        )}

        <label className="field">
          <span>카카오톡 대화 CSV</span>
          <input type="file" accept=".csv,text/csv" onChange={handleFileChange} />
          <small className="muted">
            카카오톡 PC 버전 › 채팅방 › 대화 내보내기 (예시:{' '}
            <a href="/sample-chat.csv" download>
              sample-chat.csv
            </a>
            )
          </small>
        </label>

        {messages.length > 0 && (
          <>
            <p className="muted">
              {fileName} · {messages[0].date.slice(0, 10)} ~ {messages[messages.length - 1].date.slice(0, 10)} ·
              메시지 {messages.length}개 · 참여자 {participants.length}명
            </p>

            <div className="row">
              <label className="field">
                <span>분석 기간</span>
                <select value={periodIndex} onChange={(e) => setPeriodIndex(Number(e.target.value))}>
                  {PERIODS.map((p, i) => (
                    <option key={p.label} value={i}>
                      {p.label}
                    </option>
                  ))}
                </select>
                <small className="muted">마지막 메시지 기준 · {selected.length}개 메시지</small>
              </label>

              <label className="field">
                <span>내 이름</span>
                <select value={me} onChange={(e) => setMe(e.target.value)}>
                  <option value="">선택 안 함</option>
                  {participants.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
                <small className="muted">선택하면 내 액션 아이템 위주로 뽑습니다</small>
              </label>
            </div>

            <details className="preview">
              <summary>최근 메시지 미리보기</summary>
              <div className="table-wrap">
                <table>
                  <tbody>
                    {selected.slice(-PREVIEW_ROWS).map((m, i) => (
                      <tr key={i}>
                        <td className="nowrap muted">{m.date.slice(0, 16)}</td>
                        <td className="nowrap">{m.user}</td>
                        <td>{m.text}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </details>
          </>
        )}

        <button onClick={handleAnalyze} disabled={!selected.length || !(MOCK || apiKey) || loading}>
          {loading ? '분석 중...' : '분석하기'}
        </button>

        {error && <p className="error">{error}</p>}
      </section>

      {result && (
        <>
          <section className="card">
            <h2>요약</h2>
            <p>{result.summary}</p>
          </section>

          <section className="card">
            <h2>주요 논의 사항</h2>
            <ul>
              {result.key_points.map((point, i) => (
                <li key={i}>{point}</li>
              ))}
            </ul>
          </section>

          <section className="card">
            <h2>액션 아이템</h2>
            {result.action_items.length === 0 ? (
              <p className="muted">대화에서 액션 아이템을 찾지 못했습니다.</p>
            ) : (
              <ul className="actions">
                {result.action_items.map((item, i) => (
                  <li key={i}>
                    <span className={`badge ${item.priority}`}>{PRIORITY_LABEL[item.priority]}</span>
                    <div>
                      <div>{item.task}</div>
                      <small className="muted">
                        담당: {item.owner ?? '미정'} · 기한: {item.due ?? '미정'}
                      </small>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </main>
  )
}
