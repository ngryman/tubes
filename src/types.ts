export type AsyncOrSync<Value> = PromiseLike<Value> | Value

export type Hook<
  Stage extends string,
  InitialInput = any,
  State = any,
  Input = any,
  Output = any | undefined
> = (
  input: Input,
  state: State,
  context: Context<Stage, InitialInput>
) => AsyncOrSync<Output>

export type Task<Input = unknown, Output = unknown> = (
  input: Input
) => Promise<Output>

export type Step<T extends string> = T | `${T}Before` | `${T}After`

export type Plugin<Stage extends string> = {
  [key in Step<Stage>]?: Hook<Stage>
}

export type StageOption<Stage extends string> = Stage | Stage[]

export type Options<Stage extends string> = {
  stages: StageOption<Stage>[]
  plugins: Plugin<Stage>[]
}

export type Context<Stage extends string, Input = any> = {
  errors: Error[]
  input: Input
  stage: Stage | ''
  step: Step<Stage> | ''
  plugins: Plugin<Stage>[]
}

export type Result<Output = any> = {
  errors: Error[]
  output: Output
}
