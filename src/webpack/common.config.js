const path = require('path');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
// const { WebPlugin } = require('web-webpack-plugin');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const ManifestPlugin = require('webpack-manifest-plugin');
const SriPlugin = require('webpack-subresource-integrity');
const WebpackBar = require('webpackbar');
const fs = require('fs-extra');

const ReportStatusPlugin = require('./plugins/report-status-plugin');

const { DEV, PROD, SSR } = require('../const');

const { resolve } = require;
const { env } = process;

const PAGES_DIR = './src/pages';

function configureCssLoader({ projectDir, sourceMap, publicPath, type }) {
  const loaders = [
    {
      loader: resolve('css-loader'),
      options: {
        importLoaders: 2,
        sourceMap,
      },
    },
    {
      loader: resolve('postcss-loader'),
      options: {
        sourceMap,
        plugins: () => [
          require('postcss-import')({
            path: path.resolve(projectDir, 'src'),
          }),
          require('postcss-advanced-variables'),
          // require('postcss-extend'),
          // require('postcss-simple-vars'),
          // require('postcss-nested-ancestors'),
          require('postcss-nested'),
          require('postcss-hexrgba'),
          require('autoprefixer'),
          require('postcss-flexbugs-fixes'),
          require('postcss-preset-env')({
            autoprefixer: {
              flexbox: 'no-2009',
            },
            stage: 3,
          }),
        ],
      },
    },
    resolve('sass-loader'),
  ];
  if (type === DEV) {
    loaders.unshift({
      loader: resolve('style-loader'),
      options: {
        // https://github.com/webpack-contrib/style-loader/issues/107
        singleton: true,
        sourceMap,
      },
    });
  } else {
    loaders.unshift({
      loader: MiniCssExtractPlugin.loader,
      options: {
        publicPath,
        sourceMap,
      },
    });
  }
  return {
    test: /\.(scss|css)$/,
    use: type === SSR ? resolve('ignore-loader') : loaders,
  };
}
// Configure Manifest
const configureManifest = (fileName, { distDir }) => {
  return {
    fileName,
    basePath: distDir,
    map: file => {
      file.name = file.name.replace(/(\.[a-f0-9]{32})(\..*)$/, '$2');
      return file;
    },
  };
};
const getPages = options => {
  const { projectDir, ignorePages = [] } = options;
  const pagesDir = path.join(projectDir, PAGES_DIR);
  return fs.readdirSync(pagesDir).filter(item => {
    if (ignorePages.includes(item)) {
      return false;
    }
    let filepath = path.join(pagesDir, item, 'index.js');

    if (!fs.existsSync(filepath)) {
      filepath = `${filepath}x`; // jsx
    }
    if (!fs.existsSync(filepath)) {
      return false;
    }
    return true;
  });
};
const configureEntries = options => {
  const { mode = [], type } = options;
  const entry = {};

  if (type === SSR) {
    return entry;
  }
  if (mode === 'single') {
    entry.index = './src/index';
  } else {
    getPages(options).forEach(file => {
      const name = path.basename(file);
      entry[name] = `${PAGES_DIR}/${file}/index`;
    });
  }
  return entry;
};
const configureBabelLoader = options => {
  const { projectDir } = options;

  return {
    test: /\.jsx?$/,
    use: [
      {
        loader: resolve('babel-loader'),
        options: {
          babelrc: false,
          // cacheDirectory 缓存babel编译结果加快重新编译速度
          cacheDirectory: path.resolve(options.cacheDir, 'babel-loader'),
          presets: [require('babel-preset-imt')],
        },
      },
    ],
    // 只命中 src 目录里的jsx?文件，加快webpack搜索速度
    include: [path.resolve(projectDir, 'src'), path.resolve(projectDir, 'node_modules/@tencent')],
  };
};
const configureHtmlLoader = ({ mini, projectDir, type }) => {
  return {
    test: /\.(html|njk|nunjucks)$/,
    use: [
      {
        loader: resolve('html-loader'),
        options: {
          removeComments: false,
          minimize: mini && type === PROD,
        },
      },
      // 自动处理html中的相对路径引用 css/js文件
      {
        loader: resolve('html-inline-assets-loader'),
        options: {
          minimize: mini && type === PROD,
        },
      },
      {
        loader: resolve('imt-nunjucks-loader'),
        options: {
          // Other super important. This will be the base
          // directory in which webpack is going to find
          // the layout and any other file index.njk is calling.
          searchPaths: ['./src', './src/pages', './src/assets'].map(i => path.join(projectDir, i)),
        },
      },
    ],
  };
};

module.exports = options => {
  const { projectDir, mode } = options;
  const isSSR = options.type === SSR;
  const config = {
    entry: configureEntries(options),
    output: {
      crossOriginLoading: 'anonymous',
    },
    // 出错不继续编译
    bail: true,
    resolve: {
      // 加快搜索速度
      modules: ['node_modules', path.resolve(projectDir, 'src'), path.resolve(projectDir, 'node_modules')],
      // es tree-shaking
      mainFields: ['jsnext:main', 'browser', 'main'],
      // 加快编译速度
      alias: {},
      extensions: ['.jsx', '.js'],
    },
    module: {
      // 这些库都是不依赖其它库的库 不需要解析他们可以加快编译速度
      noParse: /node_modules\/(moment|chart\.js)/,
      rules: [
        configureBabelLoader(options),
        configureCssLoader(options),
        !isSSR && configureHtmlLoader(options),
        !isSSR && {
          // svg 直接inline
          test: /\.svg$/,
          use: {
            loader: resolve('svg-inline-loader'),
            options: {
              classPrefix: true,
            },
          },
          include: [path.resolve(projectDir, 'src')],
        },
        !isSSR && {
          // 项目外svg 直接拷贝过来
          test: /.svg$/,
          use: {
            loader: resolve('file-loader'),
            options: {
              name: '[name]_[hash].[ext]',
            },
          },
          exclude: [path.resolve(projectDir, 'src')],
        },
        !isSSR && {
          // 其它文件直接拷贝
          test: /\.(gif|png|jpe?g|eot|woff|ttf|pdf)$/,
          use: {
            loader: resolve('file-loader'),
            options: { name: '[name]_[hash].[ext]' },
          },
        },
      ].filter(Boolean),
    },
    plugins: [
      new WebpackBar({
        profile: options.analyzer,
      }),
      new ReportStatusPlugin({
        mode: env.NODE_ENV,
        showFileStats: true,
        devServer: options.devServer,
      }),
      new ManifestPlugin(configureManifest('manifest-legacy.json', options)),
    ],
  };

  // 服务器渲染 js 不需要构建 html
  if (options.type !== SSR) {
    if (mode === 'single') {
      config.plugins.push(
        new HtmlWebpackPlugin({
          // https://github.com/jantimon/html-webpack-plugin/issues/870
          // html-webpack-plugin@next or chunksSortMode: 'none',
          minify: false,
          filename: 'index.html',
          template: './src/index.html',
        })
      );
    }
    if (mode === 'multi') {
      const files = getPages(options);
      // const names = files.map(i => path.basename(i));
      files.forEach(file => {
        const name = path.basename(file);
        file = `${PAGES_DIR}/${file}/index.html`;
        const chunks = ['react', 'antd', 'vender', 'common', `runtime~${name}`, name];
        config.plugins.push(
          new HtmlWebpackPlugin({
            minify: false,
            filename: `${name}.html`,
            template: file,
            chunks,
          })
        );
      });
    }
    config.plugins.push(
      // 支持js资源完整性校验
      // https://www.w3.org/TR/SRI/
      new SriPlugin({
        hashFuncNames: ['sha256', 'sha384'],
        enabled: env.NODE_ENV === PROD,
      })
    );
  }

  return config;
};
