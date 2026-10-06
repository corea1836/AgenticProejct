import Papa from 'papaparse'

export type Message = {
  date: string // "YYYY-MM-DD HH:MM:SS"
  user: string
  text: string
}

// 카카오톡 내보내기에서 내용 없이 자리만 차지하는 메시지
const NOISE = /^(사진( \d+장)?|동영상|이모티콘|메시지가 삭제되었습니다\.)$/

// 카카오톡 PC 버전 "대화 내보내기" CSV (Date,User,Message)
export function parseKakaoCsv(text: string): Message[] {
  const { data, meta } = Papa.parse<Record<string, string>>(text, {
    header: true,
    skipEmptyLines: true,
  })

  const fields = meta.fields ?? []
  if (!['Date', 'User', 'Message'].every((f) => fields.includes(f))) {
    throw new Error('카카오톡 대화 CSV 형식이 아닙니다. (Date, User, Message 컬럼 필요)')
  }

  return data
    .map((row) => ({ date: row.Date, user: row.User, text: (row.Message ?? '').trim() }))
    .filter((m) => m.date && m.user && m.text && !NOISE.test(m.text))
}

// 마지막 메시지 시점부터 거슬러 올라가 최근 N일치만 남긴다. (days가 null이면 전체)
export function filterRecentDays(messages: Message[], days: number | null): Message[] {
  if (days === null || messages.length === 0) return messages
  const last = toDate(messages[messages.length - 1].date)
  const from = last.getTime() - days * 24 * 60 * 60 * 1000
  return messages.filter((m) => toDate(m.date).getTime() >= from)
}

export function getParticipants(messages: Message[]): string[] {
  return [...new Set(messages.map((m) => m.user))]
}

// 토큰을 아끼기 위해 한 줄에 한 메시지씩 간결하게 만든다.
export function toTranscript(messages: Message[]): string {
  return messages
    .map((m) => `[${m.date.slice(0, 16)}] ${m.user}: ${m.text.replace(/\s*\n\s*/g, ' ')}`)
    .join('\n')
}

function toDate(date: string) {
  return new Date(date.replace(' ', 'T'))
}
