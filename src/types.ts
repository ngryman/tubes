export type AsyncOrSync<Value> = PromiseLike<Value> | Value

export type PlainObject = Record<string, any>

export type Primitive =
  | null
  | undefined
  | string
  | number
  | boolean
  | symbol
  | bigint
  | ((...args: any[]) => unknown)

export type Immutable<T> = T extends Primitive
  ? T
  : T extends Array<infer I>
  ? ReadonlyArray<I>
  : T extends Map<infer K, infer V>
  ? ReadonlyMap<Immutable<K>, Immutable<V>>
  : T extends Set<infer M>
  ? ReadonlySet<Immutable<M>>
  : { readonly [K in keyof T]: Immutable<T[K]> }

export type Hook<
  Stage extends string,
  InitialInput = any,
  State extends PlainObject = PlainObject,
  Input = any,
  Output = any | undefined
> = (
  input: Input,
  state: Immutable<State>,
  context: Immutable<Context<Stage, InitialInput>>
) => AsyncOrSync<Output>

export type Task<Input = any, Output = any> = (input: Input) => Promise<Output>

export type Step<T extends string> = T | `${T}Before` | `${T}After`

export type Plugin<Stage extends string> = {
  [key in Step<Stage>]?: Hook<Stage>
}

export type Options<Stage extends string> = {
  freeze?: boolean
  stages: (Stage | Stage[])[]
  plugins: Plugin<Stage>[]
}

export type Cursor<Stage extends string> = {
  stage: Stage | ''
  step: Step<Stage> | ''
  iteration: number
}

export type Context<Stage extends string, Input = any> = {
  errors: Error[]
  input: Immutable<Input>
  options: Required<Immutable<Options<Stage>>>
  cursor: Cursor<Stage>
}

export type Result<Output = any> = {
  errors: Error[]
  output: Output
}
