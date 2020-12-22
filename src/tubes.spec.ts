import 'jest-extended'
import { mocked } from 'ts-jest/utils'
import { Context, Plugin } from './types'
import { tubes } from './tubes'

describe('tubes', () => {
  describe('stage execution', () => {
    test('invoke stages sequentially', async () => {
      type Stage = 'just' | 'do' | 'it'
      const plugins: Plugin<Stage>[] = [
        {
          just: jest.fn()
        },
        {
          do: jest.fn()
        },
        {
          it: jest.fn()
        }
      ]

      await tubes<Stage>('foo', {
        stages: ['just', 'do', 'it'],
        plugins
      })

      expect(plugins[0].just).toHaveBeenCalledBefore(mocked(plugins[1].do!))
      expect(plugins[1].do).toHaveBeenCalledBefore(mocked(plugins[2].it!))
    })

    test('invoke hooks within the same stage sequentially', async () => {
      type Stage = 'do'
      const plugin: Plugin<Stage> = {
        doBefore: jest.fn(),
        do: jest.fn(),
        doAfter: jest.fn()
      }

      await tubes<Stage>('foo', {
        stages: ['do'],
        plugins: [plugin]
      })

      const steps = <(keyof typeof plugin)[]>Object.keys(plugin)
      for (let i = 1; i < steps.length; i++) {
        expect(plugin[steps[i - 1]]).toHaveBeenCalledBefore(
          mocked(plugin[steps[i]]!)
        )
      }
    })

    test('invoke sub-stages in parallel', async () => {
      type Stage = 'just' | 'do'
      const plugins: Plugin<Stage>[] = [
        {
          just: () => [0, 1, 2]
        },
        {
          do: jest.fn()
        }
      ]

      await tubes<Stage>('foo', {
        stages: ['just', ['do']],
        plugins
      })

      expect(mocked(plugins[1].do!).mock.calls[0][0]).toBe(0)
      expect(mocked(plugins[1].do!).mock.calls[1][0]).toBe(1)
      expect(mocked(plugins[1].do!).mock.calls[2][0]).toBe(2)
    })

    test('convert the input as an array for a sub-stage', async () => {
      type Stage = 'just' | 'do'
      const plugins: Plugin<Stage>[] = [
        {
          just: () => 'foo'
        },
        {
          do: jest.fn()
        }
      ]

      await tubes<Stage>('foo', {
        stages: ['just', ['do']],
        plugins
      })

      expect(mocked(plugins[1].do!).mock.calls[0][0]).toBe('foo')
    })
  })

  describe('hook API', () => {
    test('pass the artifact, state, and context to the before hook', async () => {
      type Stage = 'do'
      const plugin: Plugin<Stage> = {
        doBefore: jest.fn()
      }
      const expectedContext: Context<Stage> = {
        errors: [],
        input: 'foo',
        options: {
          stages: ['do'],
          plugins: [plugin]
        },
        cursor: {
          stage: 'do',
          step: 'doBefore',
          iteration: 0
        }
      }

      await tubes('foo', {
        stages: ['do'],
        plugins: [plugin]
      })

      expect(plugin.doBefore).toHaveBeenCalledWith('foo', {}, expectedContext)
    })

    test('pass the artifact, state, and context to the phase hook', async () => {
      type Stage = 'do'
      const plugin: Plugin<Stage> = {
        do: jest.fn()
      }
      const expectedContext: Context<Stage> = {
        errors: [],
        input: 'foo',
        options: {
          stages: ['do'],
          plugins: [plugin]
        },
        cursor: {
          stage: 'do',
          step: 'do',
          iteration: 0
        }
      }

      await tubes('foo', {
        stages: ['do'],
        plugins: [plugin]
      })

      expect(plugin.do).toHaveBeenCalledWith('foo', {}, expectedContext)
    })

    test('pass the output, state, and context to the after hook', async () => {
      type Stage = 'do'
      const plugin: Plugin<Stage> = {
        do: () => 'bar',
        doAfter: jest.fn()
      }
      const expectedContext: Context<Stage> = {
        errors: [],
        input: 'foo',
        options: {
          stages: ['do'],
          plugins: [plugin]
        },
        cursor: {
          stage: 'do',
          step: 'doAfter',
          iteration: 0
        }
      }

      await tubes('foo', {
        stages: ['do'],
        plugins: [plugin]
      })

      expect(plugin.doAfter).toHaveBeenCalledWith('bar', {}, expectedContext)
    })

    test('freeze the state if specified', async () => {
      type Stage = 'do'
      const plugin: Plugin<Stage> = {
        do: (input, state) => {
          state.foo = 'foo'
        }
      }

      await expect(
        tubes(
          'foo',
          {
            stages: ['do'],
            plugins: [plugin],
            freeze: true
          },
          { foo: 'foo' }
        )
      ).rejects.toThrowErrorMatchingInlineSnapshot(
        `"Cannot assign to read only property 'foo' of object '#<Object>'"`
      )
    })

    test('freeze the context if specified', async () => {
      type Stage = 'do'
      const plugin: Plugin<Stage> = {
        do: (input, state, context) => {
          context.input = 'foo'
        }
      }

      await expect(
        tubes(
          'foo',
          {
            stages: ['do'],
            plugins: [plugin],
            freeze: true
          },
          { foo: 'foo' }
        )
      ).rejects.toThrowErrorMatchingInlineSnapshot(
        `"Cannot assign to read only property 'input' of object '#<Object>'"`
      )
    })
  })

  describe('hook execution', () => {
    test('pass the result of the previous before hook to the next before hook', async () => {
      type Stage = 'do'
      const plugins: Plugin<Stage>[] = [
        {
          doBefore: () => 'bar'
        },
        {
          doBefore: jest.fn()
        }
      ]

      await tubes<Stage>('foo', {
        stages: ['do'],
        plugins
      })

      expect(mocked(plugins[1].doBefore!).mock.calls[0][0]).toBe('bar')
    })

    test('bypass the result of a before hook if it is undefined', async () => {
      type Stage = 'do'
      const plugins: Plugin<Stage>[] = [
        {
          doBefore: () => undefined
        },
        {
          doBefore: jest.fn()
        }
      ]

      await tubes<Stage>('foo', {
        stages: ['do'],
        plugins
      })

      expect(mocked(plugins[1].doBefore!).mock.calls[0][0]).toBe('foo')
    })

    test('stop on the first return of a phase hook', async () => {
      type Stage = 'do'
      const plugins: Plugin<Stage>[] = [
        {
          do: () => 'bar'
        },
        {
          do: jest.fn()
        }
      ]

      await tubes<Stage>('foo', {
        stages: ['do'],
        plugins
      })

      expect(plugins[1].do).not.toHaveBeenCalled()
    })

    test('pass the result of the previous after hook to the next after hook', async () => {
      type Stage = 'do'
      const plugins: Plugin<Stage>[] = [
        {
          doAfter: () => 'bar'
        },
        {
          doAfter: jest.fn()
        }
      ]

      await tubes<Stage>('foo', {
        stages: ['do'],
        plugins
      })

      expect(mocked(plugins[1].doAfter!).mock.calls[0][0]).toBe('bar')
    })

    test('bypass the result of an after hook if it is undefined', async () => {
      type Stage = 'do'
      const plugins: Plugin<Stage>[] = [
        {
          doAfter: () => undefined
        },
        {
          doAfter: jest.fn()
        }
      ]

      await tubes<Stage>('foo', {
        stages: ['do'],
        plugins
      })

      expect(mocked(plugins[1].doAfter!).mock.calls[0][0]).toBe('foo')
    })

    test('abort the execution on error', async () => {
      type Stage = 'do'
      const plugins: Plugin<Stage>[] = [
        {
          do: () => {
            throw new Error()
          }
        },
        {
          doBefore: jest.fn()
        }
      ]

      const { errors } = await tubes<Stage>('foo', {
        stages: ['do'],
        plugins
      })

      expect(errors[0]).toMatchObject({
        cursor: {
          stage: 'do',
          step: 'do',
          iteration: 0
        }
      })
    })
  })

  describe('transformation', () => {
    test('transform the input with the before hook', async () => {
      const plugin = {
        doBefore: () => 'bar',
        do: jest.fn()
      }

      await tubes('foo', {
        stages: ['do'],
        plugins: [plugin]
      })

      expect(plugin.do.mock.calls[0][0]).toBe('bar')
    })

    test('transform the input with the phase hook', async () => {
      const plugin = {
        do: () => 'bar'
      }

      const result = await tubes('foo', {
        stages: ['do'],
        plugins: [plugin]
      })

      expect(result.output).toBe('bar')
    })

    test('transform the output with the after hook', async () => {
      const plugin = {
        do: () => 'bar',
        doAfter: () => 'baz'
      }

      const result = await tubes('foo', {
        stages: ['do'],
        plugins: [plugin]
      })

      expect(result.output).toBe('baz')
    })

    test('passthrough the input if no phase hook is defined', async () => {
      const result = await tubes('foo', {
        stages: ['do'],
        plugins: []
      })

      expect(result.output).toBe('foo')
    })
  })
})
