import {
  Context,
  HookName,
  Options,
  PhaseOption,
  PlainObject,
  Result,
  Task
} from './types'

async function pipe<Input, Output>(
  tasks: Task<Input, Output>[],
  value: Input
): Promise<Output> {
  return await tasks.reduce<Promise<Output>>(async (prevPromise, task) => {
    value = <Input>(<unknown>await prevPromise) || value
    return task(value)
  }, Promise.resolve(<Output>(<unknown>value)))
}

async function invokeHook<
  Phase extends string,
  Output,
  Input,
  State extends PlainObject
>(
  context: Context<Phase>,
  hookName: HookName<Phase>,
  input: Input,
  state: State,
  mutable = false,
  stopOnFirst = false
): Promise<Output> {
  const hooks = context.plugins.map(plugin => plugin[hookName]).filter(Boolean)

  let output = input
  for (const hook of hooks) {
    const hookOutput = await hook!(output, state, context)
    output = mutable ? hookOutput || output : output
    if (stopOnFirst && output) return <Output>(<unknown>output)
  }
  return <Output>(<unknown>output)
}

async function executePhase<
  Phase extends string,
  Output,
  Input,
  State extends PlainObject
>(
  context: Context<Phase>,
  phase: Phase,
  input: Input,
  state: State
): Promise<Output> {
  const tasks: Task<Input, Output>[] = [
    input =>
      invokeHook(context, <HookName<Phase>>`${phase}Start`, input, state),
    input =>
      invokeHook(
        context,
        <HookName<Phase>>`${phase}Before`,
        input,
        state,
        true
      ),
    input => invokeHook(context, phase, input, state, true, true),
    input =>
      invokeHook(context, <HookName<Phase>>`${phase}After`, input, state, true),
    input => invokeHook(context, <HookName<Phase>>`${phase}End`, input, state)
  ]

  return await pipe<Input, Output>(tasks, input)
}

async function executePipeline<
  Phase extends string,
  State extends PlainObject,
  Input,
  Output
>(
  context: Context<Phase>,
  phases: PhaseOption<Phase>[],
  input: Input,
  state: State
): Promise<Output> {
  const tasks: Task<Input, Output>[] = phases.map(phase => {
    const task: Task<Input, Output> = async input => {
      if (Array.isArray(phase)) {
        const inputArr = <Input[]>(Array.isArray(input) ? input : [input])
        const outputArr = await Promise.all(
          inputArr.map<Promise<Output>>(
            async input => await executePipeline(context, phase, input, state)
          )
        )
        return <Output>(<unknown>outputArr)
      }
      return await executePhase(context, phase, input, state)
    }
    return task
  })

  return await pipe<Input, Output>(tasks, input)
}

export async function tubes<
  Phase extends string,
  State extends PlainObject = PlainObject,
  Input = any,
  Output = any
>(
  input: Input,
  options: Options<Phase>,
  initialState: State = <State>{}
): Promise<Result<Output>> {
  const context: Context<Phase> = {
    errors: [],
    plugins: options.plugins
  }

  const output = await executePipeline<Phase, State, Input, Output>(
    context,
    options.phases,
    input,
    initialState
  )
  return { errors: context.errors, output }
}
