import { TubesError } from './error'
import { Api, Options, Plugin, Result, Step, Task, TubesContext } from './types'

function createTubesContext<Stage extends string, Input, State>(
  input: Input,
  options: Options<Stage, Input, State>,
  state: State
): TubesContext<Stage, Input, State> {
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

function createApi<Stage extends string, Input, State>(
  context: TubesContext<Stage, Input, State>
): Api<Stage, Input, State> {
  return Object.freeze({
    addPlugin(plugin: Plugin<Stage, Input, State>) {
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

async function invokeTasks(tasks: Task[], artifact: unknown): Promise<unknown> {
  return await tasks.reduce(async (prevPromise, task) => {
    artifact = (await prevPromise) || artifact
    return task(artifact)
  }, Promise.resolve(artifact))
}

async function invokeHook<Stage extends string, Input, State>(
  stage: Stage,
  step: Step<Stage>,
  context: TubesContext<Stage, Input, State>,
  api: Api<Stage, Input, State>,
  artifact: unknown,
  stopOnFirst = false
): Promise<unknown> {
  const { errors, input, options, state } = context

  const hooks = options.plugins.map(plugin => plugin[step]).filter(Boolean)

  for (let i = 0; i < hooks.length; i++) {
    context.stage = stage
    context.step = step
    context.index = i

    const hookState = Object.freeze({ ...state })

    const hookContext = Object.freeze({
      errors: Object.freeze([...errors]),
      input: Object.freeze(input),
      stage,
      step,
      index: i
    })

    artifact =
      (await hooks[i]!(artifact, hookState, hookContext, api)) || artifact

    if (stopOnFirst && artifact) return artifact
  }

  return artifact
}

async function executeStage<Stage extends string, Input, State>(
  stage: Stage,
  context: TubesContext<Stage, Input, State>,
  api: Api<Stage, Input, State>,
  artifact: unknown
): Promise<unknown> {
  const tasks: Task[] = [
    _ => invokeHook(stage, <Step<Stage>>`${stage}Before`, context, api, _),
    _ => invokeHook(stage, stage, context, api, _, true),
    _ => invokeHook(stage, <Step<Stage>>`${stage}After`, context, api, _)
  ]

  return await invokeTasks(tasks, artifact)
}

async function executeParallelPipelines<Stage extends string, Input, State>(
  stages: Stage[],
  context: TubesContext<Stage, Input, State>,
  api: Api<Stage, Input, State>,
  artifacts: unknown[]
) {
  const outputs = await Promise.all(
    artifacts.map(async _ => await executePipeline(stages, context, api, _))
  )
  return outputs
}

async function executePipeline<Stage extends string, Input, State>(
  stages: (Stage | Stage[])[],
  context: TubesContext<Stage, Input, State>,
  api: Api<Stage, Input, State>,
  artifact: unknown
): Promise<unknown> {
  const tasks: Task[] = stages.map(stage => {
    const task: Task = async artifact => {
      if (Array.isArray(stage)) {
        const artifacts = Array.isArray(artifact) ? artifact : [artifact]
        return await executeParallelPipelines(stage, context, api, artifacts)
      }
      return await executeStage(stage, context, api, artifact)
    }
    return task
  })

  return await invokeTasks(tasks, artifact)
}

export async function tubes<
  Stage extends string,
  Input = unknown,
  Output = unknown,
  State = unknown
>(
  input: Input,
  options: Options<Stage, Input, State>,
  state: State = <State>{}
): Promise<Result<Output>> {
  const context = createTubesContext(input, options, state)
  const api = createApi(context)

  const output = <Output>(
    await executePipeline<Stage, Input, State>(
      options.stages,
      context,
      api,
      input
    )
  )

  return { errors: context.errors, output }
}
