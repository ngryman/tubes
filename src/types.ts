export type AsyncOrSync<Value> = PromiseLike<Value> | Value

export type Hook<Phase extends string, T = unknown> = (
  input: T,
  context: Context<Phase>
) => AsyncOrSync<T>

export type Task<T = unknown> = (input: T) => Promise<T>

export type HookNames<T extends string> =
  | `${T}Start`
  | `${T}Before`
  | T
  | `${T}After`
  | `${T}End`

export type Plugin<Phase extends string> = {
  [key in HookNames<Phase>]?: Hook<Phase>
}

export type PhaseOption<Phase extends string> = Phase | Phase[]

export type Options<Phase extends string> = {
  phases: PhaseOption<Phase>[]
  plugins: Plugin<Phase>[]
}

export type Context<Phase extends string> = {
  errors: Error[]
  plugins: Plugin<Phase>[]
}

export type Unit = {
  input: unknown
  output: unknown
}

export type Result = {
  errors: Error[]
  output: unknown
}
