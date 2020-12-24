export type AsyncOrSync<Value> = PromiseLike<Value> | Value

export type PlainObject = Record<string, any>

export type CursorContext<Stage extends string> = {
  stage: Stage | ''
  step: Step<Stage> | ''
  index: number
}

// @internal
export type TubesContext<
  Stage extends string,
  State,
  InitialInput
> = CursorContext<Stage> & {
  errors: Error[]
  input: InitialInput
  options: Options<Stage, State>
  state: State
}

// @internal
export type Task = (input: any) => Promise<any>

export type Context<Stage extends string> = Readonly<
  CursorContext<Stage> & {
    errors: ReadonlyArray<Error>
    input: any
  }
>

export type Api<Stage extends string, State = any> = Readonly<{
  addPlugin(plugin: Plugin<Stage, State>): void
  setState(state: State): void
  pushError(error: Error): void
}>

export type Hook<
  Stage extends string,
  State = any,
  Input = any,
  Output = any
> = (
  input: Input,
  state: State,
  context: Context<Stage>,
  api: Readonly<Api<Stage, State>>
) => AsyncOrSync<Output | undefined>

export type Step<T extends string> = T | `${T}Before` | `${T}After`

export type Plugin<Stage extends string, State = any> = {
  [key in Step<Stage>]?: Hook<Stage, State>
}

export type Options<Stage extends string, State = any> = {
  stages: (Stage | Stage[])[]
  plugins: Plugin<Stage, State>[]
}

export type Result<Output = any> = {
  errors: Error[]
  output: Output
}
