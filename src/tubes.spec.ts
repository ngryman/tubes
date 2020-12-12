import 'jest-extended'
import { mocked } from 'ts-jest/utils'
import { Plugin } from './types'
import { tubes } from './tubes'

describe('tubes', () => {
  describe('phase execution', () => {
    test('invoke phases sequentially', async () => {
      type Phase = 'just' | 'do' | 'it'
      const plugins: Plugin<Phase>[] = [
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

      await tubes<Phase>('foo', {
        phases: ['just', 'do', 'it'],
        plugins
      })

      expect(plugins[0].just).toHaveBeenCalledBefore(mocked(plugins[1].do!))
      expect(plugins[1].do).toHaveBeenCalledBefore(mocked(plugins[2].it!))
    })

    test('invoke hooks within the same phase sequentially', async () => {
      type Phase = 'do'
      const plugin: Plugin<Phase> = {
        doStart: jest.fn(),
        doBefore: jest.fn(),
        do: jest.fn(),
        doAfter: jest.fn(),
        doEnd: jest.fn()
      }

      await tubes<Phase>('foo', {
        phases: ['do'],
        plugins: [plugin]
      })

      const HookName = <(keyof typeof plugin)[]>Object.keys(plugin)
      for (let i = 1; i < HookName.length; i++) {
        expect(plugin[HookName[i - 1]]).toHaveBeenCalledBefore(
          mocked(plugin[HookName[i]]!)
        )
      }
    })

    test('invoke sub-phases in parallel', async () => {
      type Phase = 'just' | 'do'
      const plugins: Plugin<Phase>[] = [
        {
          just: () => [0, 1, 2]
        },
        {
          do: jest.fn()
        }
      ]
      const expectedContext = {
        errors: [],
        plugins
      }

      await tubes<Phase>('foo', {
        phases: ['just', ['do']],
        plugins
      })

      expect(mocked(plugins[1].do!).mock.calls).toEqual([
        [0, expectedContext],
        [1, expectedContext],
        [2, expectedContext]
      ])
    })

    test('convert the input as an array for a sub-phase', async () => {
      type Phase = 'just' | 'do'
      const plugins: Plugin<Phase>[] = [
        {
          just: () => 'foo'
        },
        {
          do: jest.fn()
        }
      ]
      const expectedContext = {
        errors: [],
        plugins
      }

      await tubes<Phase>('foo', {
        phases: ['just', ['do']],
        plugins
      })

      expect(plugins[1].do).toHaveBeenCalledWith('foo', expectedContext)
    })
  })

  describe('hook signatures', () => {
    test('pass the input and context to the start hook', async () => {
      const plugin = {
        doStart: jest.fn()
      }
      const expectedContext = {
        errors: [],
        plugins: [plugin]
      }

      await tubes('foo', {
        phases: ['do'],
        plugins: [plugin]
      })

      expect(plugin.doStart).toHaveBeenCalledWith('foo', expectedContext)
    })

    test('pass the input and context to the before hook', async () => {
      const plugin = {
        doBefore: jest.fn()
      }
      const expectedContext = {
        errors: [],
        plugins: [plugin]
      }

      await tubes('foo', {
        phases: ['do'],
        plugins: [plugin]
      })

      expect(plugin.doBefore).toHaveBeenCalledWith('foo', expectedContext)
    })

    test('pass the input and context to the producer hook', async () => {
      const plugin = {
        do: jest.fn()
      }
      const expectedContext = {
        errors: [],
        plugins: [plugin]
      }

      await tubes('foo', {
        phases: ['do'],
        plugins: [plugin]
      })

      expect(plugin.do).toHaveBeenCalledWith('foo', expectedContext)
    })

    test('pass the output and context to the after hook', async () => {
      const plugin = {
        do: () => 'bar',
        doAfter: jest.fn()
      }
      const expectedContext = {
        errors: [],
        plugins: [plugin]
      }

      await tubes('foo', {
        phases: ['do'],
        plugins: [plugin]
      })

      expect(plugin.doAfter).toHaveBeenCalledWith('bar', expectedContext)
    })

    test('pass the output and context to the end hook', async () => {
      const plugin = {
        do: () => 'bar',
        doEnd: jest.fn()
      }
      const expectedContext = {
        errors: [],
        plugins: [plugin]
      }

      await tubes('foo', {
        phases: ['do'],
        plugins: [plugin]
      })

      expect(plugin.doEnd).toHaveBeenCalledWith('bar', expectedContext)
    })
  })

  describe('hook execution', () => {
    test('ignore the result of a start hook', async () => {
      type Phase = 'do'
      const plugins: Plugin<Phase>[] = [
        {
          doStart: () => 'bar'
        },
        {
          doStart: jest.fn()
        }
      ]
      const expectedContext = {
        errors: [],
        plugins
      }

      await tubes<Phase>('foo', {
        phases: ['do'],
        plugins
      })

      expect(plugins[1].doStart).toHaveBeenCalledWith('foo', expectedContext)
    })

    test('pass the result of the previous before hook to the next before hook', async () => {
      type Phase = 'do'
      const plugins: Plugin<Phase>[] = [
        {
          doBefore: () => 'bar'
        },
        {
          doBefore: jest.fn()
        }
      ]
      const expectedContext = {
        errors: [],
        plugins
      }

      await tubes<Phase>('foo', {
        phases: ['do'],
        plugins
      })

      expect(plugins[1].doBefore).toHaveBeenCalledWith('bar', expectedContext)
    })

    test('stop on the first return of a producer hook', async () => {
      type Phase = 'do'
      const plugins: Plugin<Phase>[] = [
        {
          do: () => 'bar'
        },
        {
          do: jest.fn()
        }
      ]

      await tubes<Phase>('foo', {
        phases: ['do'],
        plugins
      })

      expect(plugins[1].do).not.toHaveBeenCalled()
    })

    test('pass the result of the previous after hook to the next after hook', async () => {
      type Phase = 'do'
      const plugins: Plugin<Phase>[] = [
        {
          doAfter: () => 'bar'
        },
        {
          doAfter: jest.fn()
        }
      ]
      const expectedContext = {
        errors: [],
        plugins
      }

      await tubes<Phase>('foo', {
        phases: ['do'],
        plugins
      })

      expect(plugins[1].doAfter).toHaveBeenCalledWith('bar', expectedContext)
    })

    test('ignore the result of an end hook', async () => {
      type Phase = 'do'
      const plugins: Plugin<Phase>[] = [
        {
          doStart: () => 'bar'
        },
        {
          doStart: jest.fn()
        }
      ]
      const expectedContext = {
        errors: [],
        plugins
      }

      await tubes<Phase>('foo', {
        phases: ['do'],
        plugins
      })

      expect(plugins[1].doStart).toHaveBeenCalledWith('foo', expectedContext)
    })
  })

  describe('transformation', () => {
    test('transform the input with the before hook', async () => {
      const plugin = {
        doBefore: () => 'bar',
        do: jest.fn()
      }

      await tubes('foo', {
        phases: ['do'],
        plugins: [plugin]
      })

      expect(plugin.do.mock.calls[0][0]).toBe('bar')
    })

    test('transform the input with the producer hook', async () => {
      const plugin = {
        do: () => 'bar'
      }

      const result = await tubes('foo', {
        phases: ['do'],
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
        phases: ['do'],
        plugins: [plugin]
      })

      expect(result.output).toBe('baz')
    })

    test('passthrough the input if no producer hook is defined', async () => {
      const result = await tubes('foo', {
        phases: ['do'],
        plugins: []
      })

      expect(result.output).toBe('foo')
    })
  })
})
