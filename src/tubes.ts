import { TubesError } from './error'
import {
  Context,
  Cursor,
  Immutable,
  Options,
  PlainObject,
  Result,
  Step,
  Task
} from './types'

function maybeFreeze<T extends PlainObject>(
  object: T,
  freeze: boolean
): Immutable<T> {
  return <Immutable<T>>(freeze ? Object.freeze(object) : object)
}

function maybeDeepFreeze<T extends PlainObject>(
  object: T,
  freeze: boolean
): Immutable<T> {
  if (!freeze) {
    return <Immutable<T>>object
  }

  const propNames = Object.getOwnPropertyNames(object)
  for (const name of propNames) {
    const value = object[name]
    if (value && typeof object[name] === 'object') {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      maybeDeepFreeze(<PlainObject>value, true)
    }
  }
  return maybeFreeze(object, true)
}

function freezeContext<Phase extends string>(
  prevContext: Context<Phase>,
  newContext: Partial<Context<Phase>>
): Immutable<Context<Phase>> {
  return <Immutable<Context<Phase>>>maybeFreeze(
    {
      ...prevContext,
      ...maybeDeepFreeze(newContext, prevContext.options.freeze)
    },
    prevContext.options.freeze
  )
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

  const hookState = maybeDeepFreeze(state, options.freeze)

  let output = input
  const hooks = options.plugins.map(plugin => plugin[step]).filter(Boolean)

  for (let i = 0; i < hooks.length; i++) {
    const hook = hooks[i]

    const cursor: Cursor<Stage> = { stage, step, iteration: i }

    const hookContext = freezeContext(context, { cursor })

    try {
      const hookOutput = await hook!(output, hookState, hookContext)
      output = hookOutput || output
    } catch (err) {
      if (err.name === 'TypeError') throw err
      context.errors.push(new TubesError(err, hookContext.cursor))
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
  stages: (Stage | Stage[])[],
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
  const validOptions = {
    freeze: false,
    ...options
  }

  const context: Context<Stage, Input> = {
    errors: [],
    input: maybeDeepFreeze(input, validOptions.freeze),
    options: maybeDeepFreeze(validOptions, validOptions.freeze),
    cursor: {
      stage: '',
      step: '',
      iteration: -1
    }
  }

  const output = await executePipeline<Stage, State, Input, Input, Output>(
    context,
    validOptions.stages,
    input,
    initialState
  )

  return { errors: context.errors, output }
}
