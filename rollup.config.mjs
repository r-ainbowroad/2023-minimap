import nodeResolve from '@rollup/plugin-node-resolve';
import typescript from 'rollup-plugin-typescript2';
import metablock from 'rollup-plugin-userscript-metablock';

const plugins = [
  nodeResolve(),
  typescript(),
  metablock({
    file: './meta.json'
  })
];

export default [
  {
    input: 'src/loader.ts',
    output: {
      file: 'dist/loader.user.js',
      format: 'iife',
      sourcemap: true
    },
    plugins: plugins
  }, {
    input: 'src/main.ts',
    output: {
      file: 'dist/minimap.user.js',
      format: 'iife',
      sourcemap: true
    },
    plugins: plugins
  }
];
