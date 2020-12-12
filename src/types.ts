export type AsyncOrSync<Value> = PromiseLike<Value> | Value

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Hook<Phase extends string, Input = any, Output = any> = (
  input: Input,
  context: Context<Phase>
) => AsyncOrSync<Output | undefined>

export type Task<T = unknown> = (input: T) => Promise<T>

export type HookName<T extends string> =
  | `${T}Start`
  | `${T}Before`
  | T
  | `${T}After`
  | `${T}End`

export type Plugin<Phase extends string> = {
  [key in HookName<Phase>]?: Hook<Phase>
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Result<Output = any> = {
  errors: Error[]
  output: Output
}
