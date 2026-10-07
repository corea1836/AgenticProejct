// 드롭한 파일은 input의 accept 필터를 거치지 않으므로 CSV인지 직접 확인한다.
// Windows는 .csv의 MIME 타입을 application/vnd.ms-excel로 주기도 해서 확장자를 먼저 본다.
export function findCsvFile(files: ArrayLike<File>): File | undefined {
  return Array.from(files).find((f) => /\.csv$/i.test(f.name) || f.type === 'text/csv')
}
