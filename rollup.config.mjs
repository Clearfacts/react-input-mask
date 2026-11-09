import { babel } from '@rollup/plugin-babel';
import terser from '@rollup/plugin-terser';
import { nodeResolve } from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import replace from '@rollup/plugin-replace';
import protoToAssign from './rollup.proto-to-assign.plugin.mjs';

const input = './src/index.js';

// Treat as externals all not relative and not absolute paths
// e.g. 'react' to prevent duplications in user bundle.
const isExternal = id => !id.startsWith('\0') && !id.startsWith('.') && !id.startsWith('/');

const external = ['react', 'react-dom'];
const plugins = [
  babel({ babelHelpers: 'bundled' }),
  nodeResolve({
    mainFields: ['jsnext:main', 'module', 'main']
  }),
  commonjs(),
  protoToAssign()
];
const minifiedPlugins = [
  ...plugins,
  replace({
    preventAssignment: true,
    'process.env.NODE_ENV': '"production"'
  }),
  babel({
    babelrc: false,
    babelHelpers: 'bundled',
    plugins: [
      'babel-plugin-minify-dead-code-elimination'
    ]
  }),
  terser()
];

export default [
  {
    input,
    output: {
      file: 'dist/react-input-mask.js',
      format: 'umd',
      name: 'ReactInputMask',
      globals: { 'react': 'React', 'react-dom': 'ReactDOM' }
    },
    external,
    plugins: [
      ...plugins,
      replace({
        preventAssignment: true,
        'process.env.NODE_ENV': '"development"'
      })
    ]
  },

  {
    input,
    output: {
      file: 'dist/react-input-mask.min.js',
      format: 'umd',
      name: 'ReactInputMask',
      globals: { 'react': 'React', 'react-dom': 'ReactDOM' }
    },
    external,
    plugins: minifiedPlugins
  },

  {
    input,
    output: { file: 'lib/react-input-mask.development.js', format: 'cjs', exports: 'auto' },
    external: isExternal,
    plugins
  },

  {
    input,
    output: { file: 'lib/react-input-mask.production.min.js', format: 'cjs', exports: 'auto' },
    external,
    plugins: minifiedPlugins
  }
];
