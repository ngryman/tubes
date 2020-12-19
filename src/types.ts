export type AsyncOrSync<Value> = PromiseLike<Value> | Value

export type PlainObject = Record<string, unknown>

export type Hook<
  Phase extends string,
  State extends PlainObject = PlainObject,
  Input = any,
  Output = any
> = (
  input: Input,
  state: State,
  context: Context<Phase>
) => AsyncOrSync<Output | undefined>

export type Task<Input = unknown, Output = unknown> = (
  input: Input
) => Promise<Output>

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

export type Result<Output = any> = {
  errors: Error[]
  output: Output
}
