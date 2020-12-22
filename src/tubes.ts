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

function createContext<Stage extends string, Input>(
  input: Input,
  options: Options<Stage>
): Context<Stage, Input> {
  const context = {
    errors: [],
    input: options.freeze ? deepFreeze(input) : input,
    options: options.freeze ? deepFreeze(options) : options,
    cursor: {
      stage: '',
      step: '',
      iteration: -1
    }
  }

  return <Context<Stage, Input>>(options.freeze ? deepFreeze(context) : context)
}

function updateContext<Phase extends string>(
  prevContext: Context<Phase>,
  newContext: Partial<Context<Phase>>
): Context<Phase> {
  return Object.freeze({
    ...prevContext,
    ...(prevContext.options.freeze ? deepFreeze(newContext) : newContext)
  })
}

function prepareState<Stage extends string, State>(
  state: State,
  options: Options<Stage>
) {
  return options.freeze ? deepFreeze(state) : state
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

  const hookState = options.freeze ? deepFreeze(state) : state

  const hooks = options.plugins.map(plugin => plugin[step]).filter(Boolean)
  let output = input
  for (let i = 0; i < hooks.length; i++) {
    const hook = hooks[i]

    const hookContext = updateContext(context, {
      cursor: { stage, step, iteration: i }
    })

    try {
      const hookOutput = await hook!(output, hookState, hookContext)
      output = hookOutput || output
    } catch (err) {
      if (err.name === 'TypeError') throw err
      context.errors.push(new TubesError(err, hookContext))
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
  const context = createContext(input, options)
  const state = prepareState(initialState, options)

  const output = await executePipeline<Stage, State, Input, Input, Output>(
    context,
    options.stages,
    input,
    state
  )

  return { errors: context.errors, output }
}
