import { Cursor, Immutable } from './types'

export class TubesError<Stage extends string> extends Error {
  public readonly cursor: Immutable<Cursor<Stage>>

  constructor(err: Error, cursor: Immutable<Cursor<Stage>>) {
    super(err.message)
    this.name = 'TubesError'
    this.stack = err.stack
    this.cursor = cursor
  }
}
