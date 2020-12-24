import { CursorContext } from './types'

export class TubesError<Stage extends string> extends Error {
  public readonly cursor: CursorContext<Stage>

  constructor(err: Error, cursor: CursorContext<Stage>) {
    super(err.message)
    this.name = 'TubesError'
    this.stack = err.stack
    this.cursor = cursor
  }
}
