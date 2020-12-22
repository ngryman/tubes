import { TubesError } from './error'
import {
  Context,
  Options,
  StageOption,
  Result,
  Step,
  Task,
  PlainObject
} from './types'

function deepFreeze<T extends PlainObject>(object: T): T {
  const propNames = Object.getOwnPropertyNames(object)
  for (const name of propNames) {
    const value = object[name]
    if (value && typeof object[name] === 'object') {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      deepFreeze(<PlainObject>value)
    }
  }
  return Object.freeze(object)
}

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
  Stage extends string,
  InitialInput,
  State,
  Output,
  Input
>(
  context: Context<Stage, InitialInput>,
  stage: Stage,
  step: Step<Stage>,
  input: Input,
  state: State,
  stopOnFirst = false
): Promise<Output> {
  const { options } = context

  const hooks = options.plugins.map(plugin => plugin[step]).filter(Boolean)

  const newContext = {
    ...context,
    stage,
    step
  }

  const frozenContext = options.freeze ? Object.freeze(newContext) : newContext

  const frozenState = options.freeze ? deepFreeze(state) : state

  let output = input
  for (const hook of hooks) {
    try {
      const hookOutput = await hook!(output, frozenState, frozenContext)
      output = hookOutput || output
    } catch (err) {
      if (err.name === 'TypeError') throw err
      context.errors.push(new TubesError(err, frozenContext))
    }
    if (stopOnFirst && output) return <Output>(<unknown>output)
  }

  return <Output>(<unknown>output)
}

async function executeStage<
  Stage extends string,
  InitialInput,
  State,
  Output,
  Input
>(
  context: Context<Stage, InitialInput>,
  stage: Stage,
  input: Input,
  state: State
): Promise<Output> {
  const tasks: Task<Input, Output>[] = [
    input =>
      invokeHook(context, stage, <Step<Stage>>`${stage}Before`, input, state),
    input => invokeHook(context, stage, stage, input, state, true),
    input =>
      invokeHook(context, stage, <Step<Stage>>`${stage}After`, input, state)
  ]

  return await pipe<Input, Output>(tasks, input)
}

async function executePipeline<
  Stage extends string,
  State,
  InitialInput,
  Input,
  Output
>(
  context: Context<Stage, InitialInput>,
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
              await executePipeline({ ...context }, stage, input, { ...state })
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
  State extends PlainObject = PlainObject,
  Input = any,
  Output = any
>(
  input: Input,
  options: Options<Stage>,
  initialState: State = <State>{}
): Promise<Result<Output>> {
  const context: Context<Stage, Input> = {
    errors: [],
    input: options.freeze ? deepFreeze(input) : input,
    stage: '',
    step: '',
    options: options.freeze ? deepFreeze(options) : options
  }

  const state = options.freeze ? deepFreeze(initialState) : initialState

  const output = await executePipeline<Stage, State, Input, Input, Output>(
    context,
    options.stages,
    input,
    state
  )

  return { errors: context.errors, output }
}
