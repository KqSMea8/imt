const webpackMerge = require('webpack-merge');

const getBaseConfig = require('./common.config');
const { PROD } = require('../const');

module.exports = options => {
  const { sourceMap, publicPath, ssrConfig } = options;

  const config = webpackMerge(getBaseConfig(options), {
    mode: PROD,
    devtool: sourceMap ? 'source-map' : 'none',
    output: {
      publicPath,
      path: ssrConfig.distDir,
      filename: '[name].js',
      libraryTarget: 'commonjs2',
    },
    entry: ssrConfig.entry,
    module: {
      rules: [
        {
          test: /\.(png|gif|pdf)$/,
          loader: require.resolve('ignore-loader'),
        },
      ],
    },
    optimization: {
      minimizer: [],
    },
    plugins: [],
  });
  return config;
};
