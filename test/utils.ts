import { mocked } from 'ts-jest/utils'

export function getMockArgument<Fn extends (...args: any[]) => any>(
  fn: Fn | undefined,
  callIndex: number,
  argIndex: number
): any {
  return mocked(fn!).mock.calls[callIndex][argIndex]
}

export function checkMockArgument<Fn extends (...args: any[]) => any>(
  fn: Fn | undefined,
  callIndex: number,
  argIndex: number,
  expected: unknown
): void {
  const arg = getMockArgument(fn!, callIndex, argIndex)

  if (typeof arg === 'object') {
    expect(arg).toMatchObject(expected as any)
  }
  expect(arg).toEqual(expected)
}
