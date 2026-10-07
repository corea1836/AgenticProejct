/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'

// https://vite.dev/config/
export default defineConfig(({ command, mode }) => {
  // 루트 .env의 OPENAI_* 값을 읽는다. 키는 개발 서버에서만 주입한다. (빌드 결과물에는 키가 들어가지 않음)
  // Vitest도 command를 'serve'로 넘기므로(mode 'test') 모드까지 확인한다. mock 모드에도 넣지 않는다.
  const env = loadEnv(mode, '..', 'OPENAI_')
  const apiKey = command === 'serve' && mode === 'development' ? (env.OPENAI_API_KEY ?? '') : ''

  return {
    plugins: [react()],
    define: {
      'import.meta.env.OPENAI_API_KEY': JSON.stringify(apiKey),
      'import.meta.env.OPENAI_MODEL': JSON.stringify(env.OPENAI_MODEL || 'gpt-5.5'),
    },
    test: {
      coverage: {
        provider: 'v8',
        // 기본 text 리포터는 100%인 파일을 표에서 생략하므로 모든 파일이 보이게 한다.
        reporter: [['text', { skipFull: false }], 'html'],
        include: ['src/**/*.{ts,tsx}'],
        exclude: ['src/main.tsx', 'src/**/*.d.ts', 'src/**/*.test.{ts,tsx}'],
      },
    },
  }
})
