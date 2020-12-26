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
  Input
> = CursorContext<Stage> & {
  errors: Error[]
  input: Input
  options: Options<Stage, State>
  state: State
}

// @internal
export type Task = (input: any) => Promise<any>

export type Context<Stage extends string, Input = any> = Readonly<
  CursorContext<Stage> & {
    errors: ReadonlyArray<Error>
    input: Input
  }
>

export type Api<Stage extends string, State = any> = Readonly<{
  addPlugin(plugin: Plugin<Stage, State>): void
  setState(state: State): void
  pushError(error: Error): void
}>

export type Hook<
  Stage extends string,
  InputArtifact = any,
  OutputArtifact = InputArtifact,
  State = any,
  Input = any
> = (
  artifact: InputArtifact,
  state: State,
  context: Context<Stage, Input>,
  api: Readonly<Api<Stage, State>>
) => AsyncOrSync<OutputArtifact | undefined>

export type Step<T extends string> = T | `${T}Before` | `${T}After`

export type Plugin<
  Stage extends string,
  InputArtifact = any,
  OutputArtifact = InputArtifact,
  State = any,
  Input = any
> = {
  [key in Step<Stage>]?: Hook<
    Stage,
    InputArtifact,
    OutputArtifact,
    State,
    Input
  >
}

export type Options<
  Stage extends string,
  InputArtifact = any,
  OutputArtifact = InputArtifact,
  State = any,
  Input = any
> = {
  stages: (Stage | Stage[])[]
  plugins: Plugin<Stage, InputArtifact, OutputArtifact, State, Input>[]
}

export type Result<Output = any> = {
  errors: Error[]
  output: Output
}
