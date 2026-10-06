import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'

// https://vite.dev/config/
export default defineConfig(({ command, mode }) => {
  // 루트 .env의 OPENAI_* 값을 읽는다. 키는 개발 서버에서만 주입한다. (빌드 결과물에는 키가 들어가지 않음)
  const env = loadEnv(mode, '..', 'OPENAI_')
  const apiKey = command === 'serve' ? (env.OPENAI_API_KEY ?? '') : ''

  return {
    plugins: [react()],
    define: {
      'import.meta.env.OPENAI_API_KEY': JSON.stringify(apiKey),
      'import.meta.env.OPENAI_MODEL': JSON.stringify(env.OPENAI_MODEL || 'gpt-5.5'),
    },
  }
})
