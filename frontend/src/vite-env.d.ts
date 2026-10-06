interface ImportMetaEnv {
  // vite.config.ts에서 루트 .env 값을 주입한다.
  readonly OPENAI_API_KEY: string
  readonly OPENAI_MODEL: string
}
