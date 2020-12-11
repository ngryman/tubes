import { Context, HookNames, Options, PhaseOption, Result, Task } from './types'

async function pipe<T>(tasks: Task<T>[], value: T): Promise<T> {
  return await tasks.reduce(async (prevPromise, fn) => {
    value = (await prevPromise) || value
    return fn(value)
  }, Promise.resolve(value))
}

async function invokeHook<Phase extends string>(
  context: Context<Phase>,
  hookName: HookNames<Phase>,
  input: unknown,
  mutable = false,
  stopOnFirst = false
): Promise<unknown> {
  const hooks = context.plugins.map(plugin => plugin[hookName]).filter(Boolean)

  let output = input
  for (const hook of hooks) {
    const hookOutput = await hook!(output, context)
    output = mutable ? hookOutput || output : output
    if (stopOnFirst && output) return output
  }
  return output
}

async function executePhase<Phase extends string>(
  context: Context<Phase>,
  phase: Phase,
  input: unknown
): Promise<unknown> {
  const tasks: Task[] = [
    input => invokeHook(context, <HookNames<Phase>>`${phase}Start`, input),
    input =>
      invokeHook(context, <HookNames<Phase>>`${phase}Before`, input, true),
    input => invokeHook(context, phase, input, true, true),
    input =>
      invokeHook(context, <HookNames<Phase>>`${phase}After`, input, true),
    input => invokeHook(context, <HookNames<Phase>>`${phase}End`, input)
  ]

  return await pipe(tasks, input)
}

async function executePipeline<Phase extends string>(
  context: Context<Phase>,
  phases: PhaseOption<Phase>[],
  input: unknown
): Promise<unknown> {
  const tasks: Task[] = phases.map(phase => async (input: unknown) => {
    if (Array.isArray(phase)) {
      const inputArr = Array.isArray(input) ? input : [input]
      return await Promise.all(
        inputArr.map(
          async input => await executePipeline(context, phase, input)
        )
      )
    }
    return await executePhase(context, phase, input)
  })

  return await pipe(tasks, input)
}

export async function tubes<Phase extends string>(
  input: unknown,
  options: Options<Phase>
): Promise<Result> {
  const context: Context<Phase> = {
    errors: [],
    plugins: options.plugins
  }

  const output = await executePipeline(context, options.phases, input)
  return { errors: context.errors, output }
}
