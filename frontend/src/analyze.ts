export type ActionItem = {
  task: string
  owner: string | null
  due: string | null
  priority: 'high' | 'medium' | 'low'
}

export type Analysis = {
  summary: string
  key_points: string[]
  action_items: ActionItem[]
}

type AnalyzeOptions = {
  apiKey: string
  model: string
  me: string // 비어 있으면 참여자 전체 기준
}

// Structured Outputs(strict)로 항상 이 형태의 JSON을 받는다.
const ANALYSIS_SCHEMA = {
  type: 'object',
  properties: {
    summary: { type: 'string', description: '대화 전체 요약 (3~5문장)' },
    key_points: {
      type: 'array',
      items: { type: 'string' },
      description: '주요 논의 사항과 결정된 내용',
    },
    action_items: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          task: { type: 'string', description: '해야 할 일 (구체적인 한 문장)' },
          owner: { type: ['string', 'null'], description: '담당자. 불분명하면 null' },
          due: { type: ['string', 'null'], description: '기한. 언급이 없으면 null' },
          priority: { type: 'string', enum: ['high', 'medium', 'low'] },
        },
        required: ['task', 'owner', 'due', 'priority'],
        additionalProperties: false,
      },
    },
  },
  required: ['summary', 'key_points', 'action_items'],
  additionalProperties: false,
}

function buildPrompt(transcript: string, me: string) {
  const lines = [
    '아래는 카카오톡 그룹 채팅 대화 기록입니다. 각 줄은 "[날짜 시간] 보낸 사람: 메시지" 형식입니다.',
    '대화를 분석해서 전체 요약, 주요 논의/결정 사항, 그리고 후속으로 해야 할 액션 아이템을 한국어로 정리해 주세요.',
    '액션 아이템은 대화에서 실제로 언급되거나 합의된 내용에 근거해야 하며, 해당하는 것이 없으면 빈 배열로 두세요.',
    '담당자와 기한은 대화에 나온 경우에만 채우고, "내일"처럼 상대적인 기한은 메시지 날짜 기준으로 실제 날짜를 계산해 주세요.',
  ]
  if (me) {
    lines.push(`사용자는 대화 참여자 중 "${me}"입니다. 액션 아이템은 "${me}"가 직접 하거나 챙겨야 할 일 위주로 뽑아 주세요.`)
  }
  return `${lines.join('\n')}\n\n<chat_log>\n${transcript}\n</chat_log>`
}

export async function analyzeChat(transcript: string, { apiKey, model, me }: AnalyzeOptions): Promise<Analysis> {
  // 백엔드 없이 브라우저에서 바로 호출한다 (프로토타입 전용)
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [{ role: 'user', content: buildPrompt(transcript, me) }],
      response_format: {
        type: 'json_schema',
        json_schema: { name: 'chat_analysis', strict: true, schema: ANALYSIS_SCHEMA },
      },
    }),
  })

  if (!res.ok) {
    const body = await res.json().catch(() => null)
    throw new Error(body?.error?.message ?? `API 요청 실패 (${res.status})`)
  }

  const data = await res.json()
  const message = data.choices?.[0]?.message
  if (!message?.content) throw new Error(message?.refusal ?? '분석 결과를 받지 못했습니다.')
  return JSON.parse(message.content) as Analysis
}

// API 없이 화면을 확인하기 위한 예시 결과 (npm run dev:mock). 담당자·기한이 있는 항목과 없는 항목을 모두 만든다.
export async function mockAnalyzeChat(transcript: string, { me }: Pick<AnalyzeOptions, 'me'>): Promise<Analysis> {
  const lines = transcript
    .split('\n')
    .map((line) => line.match(/^\[(\d{4}-\d{2}-\d{2}) [^\]]*\] ([^:]+): /))
    .filter((m) => m !== null)
  const users = [...new Set(lines.map((m) => m[2]))]
  const first = lines.at(0)?.[1] ?? null
  const last = lines.at(-1)?.[1] ?? null
  const period = first && last ? `${first} ~ ${last}` : '기간 없음'

  return {
    summary: `(mock) ${period} · 메시지 ${lines.length}개 · 실제 API는 호출하지 않았습니다.`,
    key_points: [`참여자: ${users.join(', ') || '없음'}`, `기간: ${period}`, 'mock 모드에서 만든 예시 결과입니다.'],
    action_items: [
      { task: '(mock) 담당자와 기한이 있는 할 일', owner: me || users[0] || null, due: last, priority: 'high' },
      { task: '(mock) 담당자와 기한이 없는 할 일', owner: null, due: null, priority: 'medium' },
      { task: '(mock) 우선순위가 낮은 할 일', owner: users[1] ?? null, due: null, priority: 'low' },
    ],
  }
}
