import { describe, expect, it } from 'vitest'
import sampleCsv from '../public/sample-chat.csv?raw'
import { filterRecentDays, getParticipants, parseKakaoCsv, toTranscript, type Message } from './chat'

const csv = (...rows: string[]) => ['Date,User,Message', ...rows].join('\n')
const msg = (date: string, user = '김민수', text = '안녕하세요'): Message => ({ date, user, text })

describe('parseKakaoCsv', () => {
  it('샘플 CSV에서 내용 없는 메시지를 빼고 읽는다', () => {
    const messages = parseKakaoCsv(sampleCsv)

    expect(messages).toHaveLength(13)
    expect(messages[0]).toEqual({
      date: '2026-10-06 09:02:11',
      user: '김민수',
      text: '좋은 아침입니다! 오늘 신규 온보딩 화면 배포 일정 얘기해볼까요?',
    })
    expect(messages.map((m) => m.text)).not.toContain('사진')
    expect(messages.map((m) => m.text)).not.toContain('이모티콘')
  })

  it('따옴표 이스케이프와 여러 줄 메시지를 그대로 유지한다', () => {
    const messages = parseKakaoCsv(sampleCsv)

    expect(messages.find((m) => m.date === '2026-10-06 09:05:03')?.text).toContain('"다음"이랑 "계속"')
    expect(messages.find((m) => m.date === '2026-10-06 09:11:20')?.text).toBe(
      '프론트 작업은 목요일까지 가능합니다.\n다만 API 응답 스펙이 아직 확정이 안 됐어요.',
    )
  })

  it('BOM이나 CRLF 줄바꿈이 있어도 읽는다', () => {
    expect(parseKakaoCsv('﻿' + sampleCsv)).toHaveLength(13)
    expect(parseKakaoCsv(sampleCsv.replace(/\n/g, '\r\n'))).toHaveLength(13)
  })

  it.each([
    ['헤더가 다른 CSV', 'a,b,c\n1,2,3'],
    ['컬럼이 하나 빠진 CSV', 'Date,User\n2026-10-06 09:00:00,김민수'],
    ['빈 문자열', ''],
  ])('%s이면 에러를 던진다', (_, text) => {
    expect(() => parseKakaoCsv(text)).toThrow('Date, User, Message 컬럼 필요')
  })

  it.each(['사진', '사진 3장', '동영상', '이모티콘', '메시지가 삭제되었습니다.', '  이모티콘  '])(
    '내용 없는 메시지 "%s"는 뺀다',
    (text) => {
      expect(parseKakaoCsv(csv(`2026-10-06 09:00:00,김민수,${text}`))).toEqual([])
    },
  )

  it.each(['사진 보내드릴게요', '이모티콘 귀엽네요', '동영상 링크 공유합니다'])(
    '노이즈 단어로 시작하는 일반 메시지 "%s"는 남긴다',
    (text) => {
      expect(parseKakaoCsv(csv(`2026-10-06 09:00:00,김민수,${text}`))).toEqual([
        msg('2026-10-06 09:00:00', '김민수', text),
      ])
    },
  )

  it('메시지 앞뒤 공백을 지운다', () => {
    expect(parseKakaoCsv(csv('2026-10-06 09:00:00,김민수,"  안녕하세요  "'))[0].text).toBe('안녕하세요')
  })

  it('날짜, 이름, 메시지 중 하나라도 비어 있는 행은 뺀다', () => {
    const messages = parseKakaoCsv(
      csv(
        ',김민수,날짜 없음',
        '2026-10-06 09:00:01,,이름 없음',
        '2026-10-06 09:00:02,김민수,',
        '2026-10-06 09:00:03,김민수,"   "',
        '2026-10-06 09:00:04,김민수',
        '2026-10-06 09:00:05,김민수,정상',
      ),
    )

    expect(messages).toEqual([msg('2026-10-06 09:00:05', '김민수', '정상')])
  })
})

describe('filterRecentDays', () => {
  it('days가 null이면 원본 배열을 그대로 돌려준다', () => {
    const messages = [msg('2020-01-01 09:00:00')]
    expect(filterRecentDays(messages, null)).toBe(messages)
  })

  it('빈 배열이면 빈 배열을 돌려준다', () => {
    expect(filterRecentDays([], 7)).toEqual([])
  })

  it('오늘이 아니라 마지막 메시지 시점을 기준으로 거른다', () => {
    const messages = [msg('2020-01-01 09:00:00'), msg('2020-01-05 09:00:00'), msg('2020-01-10 09:00:00')]

    expect(filterRecentDays(messages, 7).map((m) => m.date)).toEqual(['2020-01-05 09:00:00', '2020-01-10 09:00:00'])
  })

  it('정확히 N일 전 메시지는 포함하고 그보다 1초 이른 메시지는 뺀다', () => {
    const messages = [msg('2020-01-03 11:59:59'), msg('2020-01-03 12:00:00'), msg('2020-01-10 12:00:00')]

    expect(filterRecentDays(messages, 7).map((m) => m.date)).toEqual(['2020-01-03 12:00:00', '2020-01-10 12:00:00'])
  })
})

describe('getParticipants', () => {
  it('처음 등장한 순서대로 중복 없이 돌려준다', () => {
    const messages = ['이지은', '김민수', '이지은', '박준호', '김민수'].map((user) => msg('2026-10-06 09:00:00', user))

    expect(getParticipants(messages)).toEqual(['이지은', '김민수', '박준호'])
  })
})

describe('toTranscript', () => {
  it('한 줄에 "[YYYY-MM-DD HH:MM] 이름: 메시지" 형식으로 만든다', () => {
    const messages = [msg('2026-10-06 09:02:11', '김민수', '좋은 아침입니다'), msg('2026-10-06 09:04:32', '이지은', '네')]

    expect(toTranscript(messages)).toBe('[2026-10-06 09:02] 김민수: 좋은 아침입니다\n[2026-10-06 09:04] 이지은: 네')
  })

  it('메시지 안의 줄바꿈은 주변 공백과 함께 공백 하나로 바꾼다', () => {
    const messages = [msg('2026-10-06 09:11:20', '박준호', '첫 줄  \r\n  둘째 줄\n\n셋째 줄')]

    expect(toTranscript(messages)).toBe('[2026-10-06 09:11] 박준호: 첫 줄 둘째 줄 셋째 줄')
  })

  it('빈 배열이면 빈 문자열을 돌려준다', () => {
    expect(toTranscript([])).toBe('')
  })
})
