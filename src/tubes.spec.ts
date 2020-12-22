import 'jest-extended'
import { mocked } from 'ts-jest/utils'
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

  describe('hook signatures', () => {
    test('pass the input and context to the before hook', async () => {
      const plugin = {
        doBefore: jest.fn()
      }
      const expectedContext = {
        errors: [],
        stage: 'do',
        step: 'doBefore',
        plugins: [plugin]
      }

      await tubes('foo', {
        stages: ['do'],
        plugins: [plugin]
      })

      expect(plugin.doBefore).toHaveBeenCalledWith('foo', {}, expectedContext)
    })

    test('pass the input and context to the producer hook', async () => {
      const plugin = {
        do: jest.fn()
      }
      const expectedContext = {
        errors: [],
        stage: 'do',
        step: 'do',
        plugins: [plugin]
      }

      await tubes('foo', {
        stages: ['do'],
        plugins: [plugin]
      })

      expect(plugin.do).toHaveBeenCalledWith('foo', {}, expectedContext)
    })

    test('pass the output and context to the after hook', async () => {
      const plugin = {
        do: () => 'bar',
        doAfter: jest.fn()
      }
      const expectedContext = {
        errors: [],
        stage: 'do',
        step: 'doAfter',
        plugins: [plugin]
      }

      await tubes('foo', {
        stages: ['do'],
        plugins: [plugin]
      })

      expect(plugin.doAfter).toHaveBeenCalledWith('bar', {}, expectedContext)
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

    test('stop on the first return of a producer hook', async () => {
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
        stage: 'do',
        step: 'do'
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

    test('transform the input with the producer hook', async () => {
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

    test('passthrough the input if no producer hook is defined', async () => {
      const result = await tubes('foo', {
        stages: ['do'],
        plugins: []
      })

      expect(result.output).toBe('foo')
    })
  })
})
