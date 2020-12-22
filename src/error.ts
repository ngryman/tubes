import { Context, Step } from './types'

export class TubesError<Stage extends string> extends Error {
  public readonly stage: Stage | ''
  public readonly step: Step<Stage> | ''

  constructor(err: Error, context: Context<Stage>) {
    super(err.message)
    this.name = 'TubesError'
    this.stack = err.stack
    this.stage = context.stage
    this.step = context.step
  }
}
