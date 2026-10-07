import { describe, expect, it } from 'vitest'
import { findCsvFile } from './upload'

const file = (name: string, type = '') => new File([''], name, { type })

describe('findCsvFile', () => {
  it('확장자가 .csv인 파일을 고른다', () => {
    const csv = file('chat.csv')
    expect(findCsvFile([csv])).toBe(csv)
  })

  it('확장자는 대소문자를 가리지 않는다', () => {
    const csv = file('CHAT.CSV')
    expect(findCsvFile([csv])).toBe(csv)
  })

  it('Windows처럼 MIME 타입이 엑셀이어도 확장자가 .csv면 고른다', () => {
    const csv = file('chat.csv', 'application/vnd.ms-excel')
    expect(findCsvFile([csv])).toBe(csv)
  })

  it('확장자가 없어도 MIME 타입이 text/csv면 고른다', () => {
    const csv = file('chat', 'text/csv')
    expect(findCsvFile([csv])).toBe(csv)
  })

  it('여러 개를 놓으면 첫 번째 CSV 파일을 고른다', () => {
    const first = file('a.csv')
    expect(findCsvFile([file('photo.png', 'image/png'), first, file('b.csv')])).toBe(first)
  })

  it.each([
    ['텍스트 파일', 'chat.txt', 'text/plain'],
    ['이미지', 'photo.png', 'image/png'],
    ['확장자 없는 파일', 'csv', ''],
    ['압축 파일', 'chat.csv.zip', 'application/zip'],
  ])('%s은 고르지 않는다', (_, name, type) => {
    expect(findCsvFile([file(name, type)])).toBeUndefined()
  })

  it('빈 목록이면 undefined를 돌려준다', () => {
    expect(findCsvFile([])).toBeUndefined()
  })
})
