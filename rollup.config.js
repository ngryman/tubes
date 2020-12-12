/**
 * Note: Not using `@rollup/plugin-typescript` as it doesn't support emitting
 * declaration files yet.
 *
 * Watch for: https://github.com/rollup/plugins/issues/394
 */

import typescript from 'rollup-plugin-typescript2'
import pkg from './package.json'

export default {
  input: 'src/index.ts',
  output: [
    {
      file: pkg.main,
      format: 'cjs'
    },
    {
      file: pkg.module,
      format: 'es'
    }
  ],
  external: [
    ...Object.keys(pkg.dependencies || {}),
    ...Object.keys(pkg.peerDependencies || {})
  ],
  plugins: [
    typescript({
      typescript: require('typescript')
    })
  ]
}
