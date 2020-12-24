import { TubesError } from './error'
import {
  Api,
  Context,
  Options,
  Plugin,
  Result,
  Step,
  Task,
  TubesContext
} from './types'

function createTubesContext<Stage extends string, State, Input>(
  input: Input,
  options: Options<Stage, State>,
  state: State
): TubesContext<Stage, State, Input> {
  return {
    stage: '',
    step: '',
    index: -1,
    errors: [],
    input,
    options,
    state
  }
}

function createApi<Stage extends string, State, Input>(
  context: TubesContext<Stage, State, Input>
): Api<Stage, State> {
  return Object.freeze({
    addPlugin(plugin: Plugin<Stage, State>) {
      context.options.plugins.push(plugin)
    },
    setState(state: State) {
      context.state = {
        ...context.state,
        ...state
      }
    },
    pushError(error: Error | Error[]) {
      const errors = (Array.isArray(error) ? error : [error]).map(
        err => new TubesError(err, context)
      )

      context.errors.push(...errors)
    }
  })
}

async function invokeTasks(tasks: Task[], artifact: any): Promise<any> {
  return await tasks.reduce(async (prevPromise, task) => {
    artifact = (await prevPromise) || artifact
    return task(artifact)
  }, Promise.resolve(artifact))
}

async function invokeHook<Stage extends string, State, InitialInput>(
  stage: Stage,
  step: Step<Stage>,
  context: TubesContext<Stage, State, InitialInput>,
  api: Api<Stage, State>,
  artifact: any,
  stopOnFirst = false
): Promise<any> {
  const { errors, input, options, state } = context

  const hooks = options.plugins.map(plugin => plugin[step]).filter(Boolean)

  for (let i = 0; i < hooks.length; i++) {
    const hook = hooks[i]

    context.stage = stage
    context.step = step
    context.index = i

    const hookState = Object.freeze({ ...state })

    const hookContext: Context<Stage> = Object.freeze({
      errors: Object.freeze([...errors]),
      input: Object.freeze(input),
      stage,
      step,
      index: i
    })

    artifact = (await hook!(artifact, hookState, hookContext, api)) || artifact

    if (stopOnFirst && artifact) return artifact
  }

  return artifact
}

async function executeStage<Stage extends string, State, InitialInput>(
  stage: Stage,
  context: TubesContext<Stage, State, InitialInput>,
  api: Api<Stage, State>,
  artifact: any
): Promise<any> {
  const tasks: Task[] = [
    artifact =>
      invokeHook(stage, <Step<Stage>>`${stage}Before`, context, api, artifact),
    artifact => invokeHook(stage, stage, context, api, artifact, true),
    artifact =>
      invokeHook(stage, <Step<Stage>>`${stage}After`, context, api, artifact)
  ]

  return await invokeTasks(tasks, artifact)
}

async function executePipeline<Stage extends string, State, InitialInput>(
  stages: (Stage | Stage[])[],
  context: TubesContext<Stage, State, InitialInput>,
  api: Api<Stage, State>,
  artifact: any
): Promise<any> {
  const tasks: Task[] = stages.map(stage => {
    const task: Task = async artifact => {
      if (Array.isArray(stage)) {
        const artifacts = Array.isArray(artifact) ? artifact : [artifact]
        const outputs = await Promise.all(
          artifacts.map(
            async artifact =>
              await executePipeline(stage, context, api, artifact)
          )
        )
        return outputs
      }
      return await executeStage(stage, context, api, artifact)
    }
    return task
  })

  return await invokeTasks(tasks, artifact)
}

export async function tubes<
  Stage extends string,
  State = any,
  Input = any,
  Output = any
>(
  input: Input,
  options: Options<Stage, State>,
  state: State = <State>{}
): Promise<Result<Output>> {
  const context = createTubesContext(input, options, state)
  const api = createApi<Stage, State, Input>(context)

  const output = await executePipeline<Stage, State, Input>(
    options.stages,
    context,
    api,
    input
  )

  return { errors: context.errors, output }
}
