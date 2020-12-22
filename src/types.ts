export type AsyncOrSync<Value> = PromiseLike<Value> | Value

export type PlainObject = Record<string, any>

export type Hook<
  Stage extends string,
  InitialInput = any,
  State extends PlainObject = PlainObject,
  Input = any,
  Output = any | undefined
> = (
  input: Input,
  state: State,
  context: Context<Stage, InitialInput>
) => AsyncOrSync<Output>

export type Task<Input = any, Output = any> = (input: Input) => Promise<Output>

export type Step<T extends string> = T | `${T}Before` | `${T}After`

export type Plugin<Stage extends string> = {
  [key in Step<Stage>]?: Hook<Stage>
}

export type StageOption<Stage extends string> = Stage | Stage[]

export type Options<Stage extends string> = {
  freeze?: boolean
  stages: StageOption<Stage>[]
  plugins: Plugin<Stage>[]
}

export type Context<Stage extends string, Input = any> = {
  errors: Error[]
  input: Input
  options: Options<Stage>
  stage: Stage | ''
  step: Step<Stage> | ''
}

export type Result<Output = any> = {
  errors: Error[]
  output: Output
}
