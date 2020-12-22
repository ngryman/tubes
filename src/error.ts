import { Context, Cursor } from './types'

export class TubesError<Stage extends string> extends Error {
  public readonly cursor: Cursor<Stage>

  constructor(err: Error, context: Context<Stage>) {
    super(err.message)
    this.name = 'TubesError'
    this.stack = err.stack
    this.cursor = context.cursor
  }
}
