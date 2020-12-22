import { Context, Options, PhaseOption, Result, Step, Task } from './types'

async function pipe<Input, Output>(
  tasks: Task<Input, Output>[],
  value: Input
): Promise<Output> {
  return await tasks.reduce<Promise<Output>>(async (prevPromise, task) => {
    value = <Input>(<unknown>await prevPromise) || value
    return task(value)
  }, Promise.resolve(<Output>(<unknown>value)))
}

async function invokeHook<Phase extends string, State, Output, Input>(
  context: Context<Phase>,
  step: Step<Phase>,
  input: Input,
  state: State,
  stopOnFirst = false
): Promise<Output> {
  const hookContext = {
    ...context,
    step
  }

  const hooks = context.plugins.map(plugin => plugin[step]).filter(Boolean)

  let output = input
  for (const hook of hooks) {
    const hookOutput = await hook!(output, state, hookContext)
    output = hookOutput || output
    if (stopOnFirst && output) return <Output>(<unknown>output)
  }

  return <Output>(<unknown>output)
}

async function executePhase<Phase extends string, State, Output, Input>(
  context: Context<Phase>,
  phase: Phase,
  input: Input,
  state: State
): Promise<Output> {
  const phaseContext = {
    ...context,
    phase
  }

  const tasks: Task<Input, Output>[] = [
    input =>
      invokeHook(phaseContext, <Step<Phase>>`${phase}Before`, input, state),
    input => invokeHook(phaseContext, phase, input, state, true),
    input =>
      invokeHook(phaseContext, <Step<Phase>>`${phase}After`, input, state)
  ]

  return await pipe<Input, Output>(tasks, input)
}

async function executePipeline<Phase extends string, State, Input, Output>(
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
            async input =>
              await executePipeline(context, phase, input, { ...state })
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
  State = any,
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
