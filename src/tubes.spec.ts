import 'jest-extended'
import { mocked } from 'ts-jest/utils'
import { checkMockArgument, getMockArgument } from '../test/utils'
import { Plugin } from './types'
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

      checkMockArgument(plugins[1].do, 0, 0, 0)
      checkMockArgument(plugins[1].do, 1, 0, 1)
      checkMockArgument(plugins[1].do, 2, 0, 2)
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

      checkMockArgument(plugins[1].do, 0, 0, 'foo')
    })
  })

  describe('hook signature', () => {
    const API_FUNCTIONS = ['addPlugin', 'pushError', 'setState']

    test('pass the artifact, state, and context to the before hook', async () => {
      type Stage = 'do'
      const plugin: Plugin<Stage> = {
        doBefore: jest.fn()
      }

      await tubes(
        'foo',
        {
          stages: ['do'],
          plugins: [plugin]
        },
        { foo: 'foo' }
      )

      checkMockArgument(plugin.doBefore, 0, 0, 'foo')
      checkMockArgument(plugin.doBefore, 0, 1, { foo: 'foo' })
      checkMockArgument(plugin.doBefore, 0, 2, {
        stage: 'do',
        step: 'doBefore',
        index: 0,
        errors: [],
        input: 'foo'
      })
      expect(getMockArgument(plugin.doBefore, 0, 3)).toContainAllKeys(
        API_FUNCTIONS
      )
    })

    test('pass the artifact, state, and context to the phase hook', async () => {
      type Stage = 'do'
      const plugin: Plugin<Stage> = {
        do: jest.fn()
      }

      await tubes(
        'foo',
        {
          stages: ['do'],
          plugins: [plugin]
        },
        { foo: 'foo' }
      )

      checkMockArgument(plugin.do, 0, 0, 'foo')
      checkMockArgument(plugin.do, 0, 1, { foo: 'foo' })
      checkMockArgument(plugin.do, 0, 2, {
        stage: 'do',
        step: 'do',
        index: 0,
        errors: [],
        input: 'foo'
      })
      expect(getMockArgument(plugin.do, 0, 3)).toContainAllKeys(API_FUNCTIONS)
    })

    test('pass the output, state, and context to the after hook', async () => {
      type Stage = 'do'
      const plugin: Plugin<Stage> = {
        do: () => 'bar',
        doAfter: jest.fn()
      }

      await tubes(
        'foo',
        {
          stages: ['do'],
          plugins: [plugin]
        },
        { foo: 'foo' }
      )

      checkMockArgument(plugin.doAfter, 0, 0, 'bar')
      checkMockArgument(plugin.doAfter, 0, 1, { foo: 'foo' })
      checkMockArgument(plugin.doAfter, 0, 2, {
        stage: 'do',
        step: 'doAfter',
        index: 0,
        errors: [],
        input: 'foo'
      })
      expect(getMockArgument(plugin.doAfter, 0, 3)).toContainAllKeys(
        API_FUNCTIONS
      )
    })
  })

  describe('hook parameters immutability', () => {
    test('throw an error if mutating the state directly', async () => {
      type Stage = 'do'
      const plugin: Plugin<Stage> = {
        do(input, state) {
          // eslint-disable-next-line @typescript-eslint/ban-ts-comment
          // @ts-ignore
          state.foo = 'bar'
        },
        doAfter: jest.fn()
      }

      await expect(
        tubes(
          'foo',
          {
            stages: ['do'],
            plugins: [plugin]
          },
          { foo: 'foo' }
        )
      ).rejects.toThrowErrorMatchingInlineSnapshot(
        `"Cannot assign to read only property 'foo' of object '#<Object>'"`
      )
    })

    test('throw an error if mutating the context directly', async () => {
      type Stage = 'do'
      const plugin: Plugin<Stage> = {
        do(input, state, context) {
          // eslint-disable-next-line @typescript-eslint/ban-ts-comment
          // @ts-ignore
          context.errors.push('foo')
        },
        doAfter: jest.fn()
      }

      await expect(
        tubes(
          'foo',
          {
            stages: ['do'],
            plugins: [plugin]
          },
          { foo: 'foo' }
        )
      ).rejects.toThrowErrorMatchingInlineSnapshot(
        `"Cannot add property 0, object is not extensible"`
      )
    })

    test('throw an error if mutating the api directly', async () => {
      type Stage = 'do'
      const plugin: Plugin<Stage> = {
        do(input, state, context, api) {
          // eslint-disable-next-line @typescript-eslint/ban-ts-comment
          // @ts-ignore
          api.pushError = undefined
        },
        doAfter: jest.fn()
      }

      await expect(
        tubes(
          'foo',
          {
            stages: ['do'],
            plugins: [plugin]
          },
          { foo: 'foo' }
        )
      ).rejects.toThrowErrorMatchingInlineSnapshot(
        `"Cannot assign to read only property 'pushError' of object '#<Object>'"`
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

      checkMockArgument(plugins[1].doBefore, 0, 0, 'bar')
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

      checkMockArgument(plugins[1].doBefore, 0, 0, 'foo')
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

      checkMockArgument(plugins[1].doAfter, 0, 0, 'bar')
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

      checkMockArgument(plugins[1].doAfter, 0, 0, 'foo')
    })
  })

  describe('transformation', () => {
    test('transform the input with the before hook', async () => {
      type Stage = 'do'
      const plugin: Plugin<Stage> = {
        doBefore: () => 'bar',
        do: jest.fn()
      }

      await tubes('foo', {
        stages: ['do'],
        plugins: [plugin]
      })

      checkMockArgument(plugin.do, 0, 0, 'bar')
    })

    test('transform the input with the phase hook', async () => {
      type Stage = 'do'
      const plugin: Plugin<Stage> = {
        do: () => 'bar'
      }

      const result = await tubes('foo', {
        stages: ['do'],
        plugins: [plugin]
      })

      expect(result.output).toBe('bar')
    })

    test('transform the output with the after hook', async () => {
      type Stage = 'do'
      const plugin: Plugin<Stage> = {
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

  describe('api', () => {
    test('setState mutates the state', async () => {
      type Stage = 'do'
      const plugin: Plugin<Stage> = {
        do(input, state, context, { setState }) {
          setState({ foo: 'bar' })
        },
        doAfter: jest.fn()
      }

      await tubes(
        'foo',
        {
          stages: ['do'],
          plugins: [plugin]
        },
        { foo: 'foo' }
      )

      checkMockArgument(plugin.doAfter, 0, 1, { foo: 'bar' })
    })
  })
})
