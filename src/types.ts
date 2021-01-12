/**
 * Utils
 */

export type AsyncOrSync<Value> = PromiseLike<Value> | Value

export type PlainObject = Record<string, unknown>

/**
 * Internal
 */

export interface CursorContext<Stage extends string> {
  stage: Stage | ''
  step: Step<Stage> | ''
  index: number
}

export type TubesContext<
  Stage extends string,
  Input,
  State
> = CursorContext<Stage> & {
  errors: Error[]
  input: Input
  options: Options<Stage, Input, State>
  state: State
}

export type Task = (input: unknown) => Promise<unknown>

/**
 * Public
 */

export type Context<Stage extends string, Input = unknown> = Readonly<
  CursorContext<Stage> & {
    errors: ReadonlyArray<Error>
    input: Input
  }
>

export type Api<
  Stage extends string,
  Input = unknown,
  State = unknown
> = Readonly<{
  addPlugin(plugin: Plugin<Stage, Input, State>): void
  setState(state: State): void
  pushError(error: Error): void
}>

export type Hook<
  Stage extends string,
  InputArtifact = unknown,
  OutputArtifact = InputArtifact,
  State = unknown,
  Input = unknown
> = (
  artifact: InputArtifact,
  state: State,
  context: Context<Stage, Input>,
  api: Readonly<Api<Stage, Input, State>>
) => AsyncOrSync<OutputArtifact | undefined>

export type Step<T extends string> = T | `${T}Before` | `${T}After`

export type Plugin<Stage extends string, Input = unknown, State = unknown> = {
  [key in Step<Stage>]?: Hook<Stage, any, any, State, Input>
}

export type Options<Stage extends string, Input = unknown, State = unknown> = {
  stages: (Stage | Stage[])[]
  plugins: Plugin<Stage, Input, State>[]
}

export type Result<Output = unknown> = {
  errors: Error[]
  output: Output
}
