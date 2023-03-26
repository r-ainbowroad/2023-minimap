import nodeResolve from '@rollup/plugin-node-resolve';
import typescript from 'rollup-plugin-typescript2';
import metablock from 'rollup-plugin-userscript-metablock';
import terser from '@rollup/plugin-terser';

function getPlugins(CLIArgs) {
  const plugins = [
    nodeResolve(),
    typescript()
  ];

  if (CLIArgs['config-prod'])
    plugins.push(terser());
  plugins.push(metablock({
    file: './meta.json'
  }));

  return plugins;
}

export default CLIArgs => [
  {
    input: 'src/loader.ts',
    output: {
      file: 'dist/loader.user.js',
      format: 'iife',
      sourcemap: true
    },
    plugins: getPlugins(CLIArgs)
  }, {
    input: 'src/main.ts',
    output: {
      file: 'dist/minimap.user.js',
      format: 'iife',
      sourcemap: true
    },
    plugins: getPlugins(CLIArgs)
  }
];
