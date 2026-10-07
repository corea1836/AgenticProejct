import { afterEach, describe, expect, it, vi } from 'vitest'
import { analyzeChat, mockAnalyzeChat, type ActionItem, type Analysis } from './analyze'

type JsonSchema = {
  type?: string | string[]
  enum?: string[]
  properties?: Record<string, JsonSchema>
  required?: string[]
  additionalProperties?: boolean
  items?: JsonSchema
}

const OPTIONS = { apiKey: 'sk-test', model: 'test-model', me: '' }
const TRANSCRIPT = '[2026-10-06 09:13] 최서연: API 스펙은 제가 내일까지 문서로 정리해서 공유드릴게요.'

const RESULT: Analysis = {
  summary: '금요일 배포 일정을 확정했다.',
  key_points: ['배포는 금요일'],
  action_items: [{ task: 'API 스펙 문서 공유', owner: '최서연', due: '2026-10-07', priority: 'high' }],
}

// satisfies로 타입의 키와 컴파일 타임에 맞춰 두고, 런타임에는 스키마와 비교한다.
const ANALYSIS_KEYS = Object.keys({ summary: 0, key_points: 0, action_items: 0 } satisfies Record<keyof Analysis, 0>)
const ACTION_ITEM_KEYS = Object.keys({ task: 0, owner: 0, due: 0, priority: 0 } satisfies Record<keyof ActionItem, 0>)
const PRIORITIES = Object.keys({ high: 0, medium: 0, low: 0 } satisfies Record<ActionItem['priority'], 0>)

function mockFetch(body: unknown, init: ResponseInit = {}) {
  const fetchMock = vi.fn<typeof fetch>(
    async () => new Response(typeof body === 'string' ? body : JSON.stringify(body), init),
  )
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

function mockSuccess(content: string | null = JSON.stringify(RESULT)) {
  return mockFetch({ choices: [{ message: { role: 'assistant', content, refusal: null } }] })
}

function lastRequest(fetchMock: ReturnType<typeof mockFetch>) {
  const [url, init] = fetchMock.mock.calls[0]
  return { url, init, body: JSON.parse(String(init?.body)) }
}

// strict 모드 규칙: 모든 object는 properties 키 전체가 required에 있고 additionalProperties가 false여야 한다.
function strictViolations(schema: JsonSchema, path = 'schema'): string[] {
  const violations: string[] = []
  if (schema.type === 'object') {
    const keys = Object.keys(schema.properties ?? {}).sort()
    if ((schema.required ?? []).toSorted().join() !== keys.join()) violations.push(`${path}.required`)
    if (schema.additionalProperties !== false) violations.push(`${path}.additionalProperties`)
  }
  for (const [key, child] of Object.entries(schema.properties ?? {})) {
    violations.push(...strictViolations(child, `${path}.${key}`))
  }
  if (schema.items) violations.push(...strictViolations(schema.items, `${path}[]`))
  return violations
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('analyzeChat 요청', () => {
  it('Chat Completions API를 키와 모델을 담아 POST로 호출한다', async () => {
    const fetchMock = mockSuccess()
    await analyzeChat(TRANSCRIPT, OPTIONS)

    const { url, init, body } = lastRequest(fetchMock)
    expect(url).toBe('https://api.openai.com/v1/chat/completions')
    expect(init?.method).toBe('POST')
    expect(init?.headers).toMatchObject({ 'content-type': 'application/json', authorization: 'Bearer sk-test' })
    expect(body.model).toBe('test-model')
    expect(body.response_format).toMatchObject({
      type: 'json_schema',
      json_schema: { name: 'chat_analysis', strict: true },
    })
  })

  it('응답 스키마가 strict 모드 규칙을 지킨다', async () => {
    const fetchMock = mockSuccess()
    await analyzeChat(TRANSCRIPT, OPTIONS)

    const schema: JsonSchema = lastRequest(fetchMock).body.response_format.json_schema.schema
    expect(strictViolations(schema)).toEqual([])
  })

  it('응답 스키마의 필드가 Analysis/ActionItem 타입과 일치한다', async () => {
    const fetchMock = mockSuccess()
    await analyzeChat(TRANSCRIPT, OPTIONS)

    const schema: JsonSchema = lastRequest(fetchMock).body.response_format.json_schema.schema
    const item = schema.properties?.action_items.items
    expect(Object.keys(schema.properties ?? {}).sort()).toEqual(ANALYSIS_KEYS.sort())
    expect(Object.keys(item?.properties ?? {}).sort()).toEqual(ACTION_ITEM_KEYS.sort())
    expect(item?.properties?.priority.enum?.toSorted()).toEqual(PRIORITIES.sort())
    // string | null 필드는 스키마에서도 null을 허용해야 한다.
    expect(item?.properties?.owner.type).toEqual(['string', 'null'])
    expect(item?.properties?.due.type).toEqual(['string', 'null'])
  })

  it('프롬프트에 대화 기록 형식 설명과 <chat_log>로 감싼 대화 기록을 넣는다', async () => {
    const fetchMock = mockSuccess()
    await analyzeChat(TRANSCRIPT, OPTIONS)

    const [message] = lastRequest(fetchMock).body.messages
    expect(message.role).toBe('user')
    expect(message.content.split('\n')[0]).toContain('"[날짜 시간] 보낸 사람: 메시지" 형식')
    expect(message.content).toContain(`<chat_log>\n${TRANSCRIPT}\n</chat_log>`)
    expect(message.content).not.toContain('사용자는 대화 참여자 중')
  })

  it('me가 있으면 그 사람의 액션 아이템 위주로 뽑으라고 지시한다', async () => {
    const fetchMock = mockSuccess()
    await analyzeChat(TRANSCRIPT, { ...OPTIONS, me: '최서연' })

    const [message] = lastRequest(fetchMock).body.messages
    expect(message.content).toContain('사용자는 대화 참여자 중 "최서연"입니다.')
  })
})

describe('analyzeChat 응답 처리', () => {
  it('성공하면 content를 파싱한 결과를 돌려준다', async () => {
    mockSuccess()
    await expect(analyzeChat(TRANSCRIPT, OPTIONS)).resolves.toEqual(RESULT)
  })

  it('에러 응답에 메시지가 있으면 그 메시지로 에러를 던진다', async () => {
    mockFetch({ error: { message: 'Incorrect API key provided' } }, { status: 401 })
    await expect(analyzeChat(TRANSCRIPT, OPTIONS)).rejects.toThrow('Incorrect API key provided')
  })

  it.each([
    ['JSON이 아닌 에러 응답', 'Internal Server Error', 500],
    ['error 필드가 없는 에러 응답', {}, 429],
  ])('%s이면 상태 코드를 담은 에러를 던진다', async (_, body, status) => {
    mockFetch(body, { status })
    await expect(analyzeChat(TRANSCRIPT, OPTIONS)).rejects.toThrow(`API 요청 실패 (${status})`)
  })

  it('모델이 거절하면 refusal 메시지로 에러를 던진다', async () => {
    mockFetch({ choices: [{ message: { role: 'assistant', content: null, refusal: '요청을 처리할 수 없습니다.' } }] })
    await expect(analyzeChat(TRANSCRIPT, OPTIONS)).rejects.toThrow('요청을 처리할 수 없습니다.')
  })

  it.each([
    ['choices가 비어 있으면', { choices: [] }],
    ['content가 빈 문자열이면', { choices: [{ message: { content: '', refusal: null } }] }],
  ])('%s 결과를 받지 못했다는 에러를 던진다', async (_, body) => {
    mockFetch(body)
    await expect(analyzeChat(TRANSCRIPT, OPTIONS)).rejects.toThrow('분석 결과를 받지 못했습니다.')
  })
})

describe('mockAnalyzeChat', () => {
  const MOCK_TRANSCRIPT = [
    '[2026-10-05 21:40] 김민수: 배포는 금요일로 하죠.',
    '[2026-10-06 09:11] 박준호: 프론트 작업은 목요일까지 가능합니다.',
    TRANSCRIPT,
  ].join('\n')

  it('API를 호출하지 않는다', async () => {
    const fetchMock = mockSuccess()
    await mockAnalyzeChat(MOCK_TRANSCRIPT, { me: '' })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it.each([
    ['대화 기록이 있으면', MOCK_TRANSCRIPT],
    ['대화 기록이 비어 있어도', ''],
  ])('%s Analysis 형태를 지킨다', async (_, transcript) => {
    const result = await mockAnalyzeChat(transcript, { me: '' })
    expect(Object.keys(result).sort()).toEqual(ANALYSIS_KEYS.sort())
    expect(result.action_items.length).toBeGreaterThan(0)
    for (const item of result.action_items) {
      expect(Object.keys(item).sort()).toEqual(ACTION_ITEM_KEYS.sort())
      expect(PRIORITIES).toContain(item.priority)
    }
  })

  it('담당자는 me가 있으면 me, 없으면 첫 참여자이고 기한은 마지막 메시지 날짜다', async () => {
    const [withMe] = (await mockAnalyzeChat(MOCK_TRANSCRIPT, { me: '최서연' })).action_items
    const [withoutMe] = (await mockAnalyzeChat(MOCK_TRANSCRIPT, { me: '' })).action_items
    expect(withMe).toMatchObject({ owner: '최서연', due: '2026-10-06' })
    expect(withoutMe.owner).toBe('김민수')
  })

  it('담당자와 기한이 없는 항목도 넣어 화면의 null 처리를 확인할 수 있게 한다', async () => {
    const { action_items } = await mockAnalyzeChat(MOCK_TRANSCRIPT, { me: '' })
    expect(action_items).toContainEqual(expect.objectContaining({ owner: null, due: null }))
  })
})

describe('환경 변수', () => {
  it('테스트에는 루트 .env의 API 키가 주입되지 않는다', () => {
    // Vitest도 vite.config.ts를 command 'serve'로 읽는다. 키가 들어오면 fetch mock을 빠뜨린 테스트가 실제 API를 호출한다.
    // 실패해도 키 값이 출력되지 않도록 길이만 비교한다.
    expect(import.meta.env.OPENAI_API_KEY.length).toBe(0)
  })
})
