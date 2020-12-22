import { TubesError } from './error'
import { Context, Options, StageOption, Result, Step, Task } from './types'

async function pipe<Input, Output>(
  tasks: Task<Input, Output>[],
  value: Input
): Promise<Output> {
  return await tasks.reduce<Promise<Output>>(async (prevPromise, task) => {
    value = <Input>(<unknown>await prevPromise) || value
    return task(value)
  }, Promise.resolve(<Output>(<unknown>value)))
}

async function invokeHook<Stage extends string, State, Output, Input>(
  context: Context<Stage>,
  step: Step<Stage>,
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
    try {
      const hookOutput = await hook!(output, state, hookContext)
      output = hookOutput || output
    } catch (err) {
      context.errors.push(new TubesError(err, hookContext))
    }
    if (stopOnFirst && output) return <Output>(<unknown>output)
  }

  return <Output>(<unknown>output)
}

async function executeStage<Stage extends string, State, Output, Input>(
  context: Context<Stage>,
  stage: Stage,
  input: Input,
  state: State
): Promise<Output> {
  const stageContext = {
    ...context,
    stage
  }

  const tasks: Task<Input, Output>[] = [
    input =>
      invokeHook(stageContext, <Step<Stage>>`${stage}Before`, input, state),
    input => invokeHook(stageContext, stage, input, state, true),
    input =>
      invokeHook(stageContext, <Step<Stage>>`${stage}After`, input, state)
  ]

  return await pipe<Input, Output>(tasks, input)
}

async function executePipeline<Stage extends string, State, Input, Output>(
  context: Context<Stage>,
  stages: StageOption<Stage>[],
  input: Input,
  state: State
): Promise<Output> {
  const tasks: Task<Input, Output>[] = stages.map(stage => {
    const task: Task<Input, Output> = async input => {
      if (Array.isArray(stage)) {
        const inputArr = <Input[]>(Array.isArray(input) ? input : [input])
        const outputArr = await Promise.all(
          inputArr.map<Promise<Output>>(
            async input =>
              await executePipeline(context, stage, input, {
                ...state
              })
          )
        )
        return <Output>(<unknown>outputArr)
      }
      return await executeStage(context, stage, input, state)
    }
    return task
  })

  return await pipe<Input, Output>(tasks, input)
}

export async function tubes<
  Stage extends string,
  State = any,
  Input = any,
  Output = any
>(
  input: Input,
  options: Options<Stage>,
  initialState: State = <State>{}
): Promise<Result<Output>> {
  const context: Context<Stage> = {
    errors: [],
    stage: '',
    step: '',
    plugins: options.plugins
  }

  const output = await executePipeline<Stage, State, Input, Output>(
    context,
    options.stages,
    input,
    initialState
  )

  return { errors: context.errors, output }
}
