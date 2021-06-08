const isProduction = process.env.NODE_ENV === 'production';
const path = require('path');
const read = require('read-yaml');
const BrowserSync = require('browser-sync');
const BrowserSyncPlugin = require('browser-sync-webpack-plugin');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const { BundleAnalyzerPlugin } = require('webpack-bundle-analyzer');
const { CleanWebpackPlugin } = require('clean-webpack-plugin');

const config = read.sync('config.yml');
const storeURL = config.development.store;
const themeID = config.development.theme_id;

module.exports = (env) => ({
  mode: isProduction ? 'production' : 'development',
  entry: {
    theme: './src/js/theme.js',
    product: './src/js/product.js',
    customers: './src/js/customers.js',
  },
  output: {
    filename: '[name].bundle.js',
    chunkFilename: '[name].[chunkhash:5].bundle.js',
    path: path.resolve(__dirname, 'theme/assets'),
  },
  optimization: {
    splitChunks: {
      // Shopify does not allow "~"
      automaticNameDelimiter: '-',
    },
  },
  module: {
    rules: [
      {
        test: /\.svelte$/,
        use: {
          loader: 'svelte-loader',
          options: { emitCss: false },
        },
      },
      {
        test: /\.m?js$/,
        exclude: /(node_modules)/,
        use: {
          loader: 'babel-loader',
          options: {
            presets: ['@babel/preset-env'],
            plugins: ['@babel/plugin-proposal-object-rest-spread'],
          },
        },
      },
      {
        test: /\.css$/,
        exclude: /node_modules/,
        use: [
          MiniCssExtractPlugin.loader,
          {
            loader: 'css-loader',
            options: {
              importLoaders: 1,
              url: false, // Don't resolve url(), all assets end up in assets directory
            },
          },
          { loader: 'postcss-loader' },
        ],
      },
    ],
  },
  stats: { children: false },
  plugins: [
    // Visualize size of webpack output files
    // 'static' mode works better with BrowserSync and Themekit deploy
    new BundleAnalyzerPlugin({
      analyzerMode: env === 'analyze' ? 'static' : 'disabled',
      reportFilename: '../../report.html',
    }),

    // Only remove the bundle files generated,
    // other Shopify theme assets will end that should not be lost
    new CleanWebpackPlugin({
      cleanOnceBeforeBuildPatterns: ['*.bundle.js'],
    }),

    // Extract CSS to external file to keep JS files smaller
    new MiniCssExtractPlugin({ filename: '[name].bundle.css' }),

    new BrowserSyncPlugin({
      https: true,
      port: 3001,
      proxy: `https://${storeURL}?preview_theme_id=${themeID}`,
      middleware: [
        (function mw(req, res, next) {
          // Add url paramaters for Shopify theme preview.
          // ?_fd=0 prevents domain forwarding, ?pb=0 hides the Shopify preview bar
          const prefix = req.url.indexOf('?') > -1 ? '&' : '?';
          const queryStringComponents = ['_ab=0&_fd=0&_sc=1&pb=0'];
          req.url += prefix + queryStringComponents.join('&');
          next();
        }),
      ],
      files: [{
        // theme-ready.tmp is touched by theme-kit after uploaded to Shopify,
        // so the browser is ready to refresh.
        match: ['theme-ready.tmp'],
        fn() { BrowserSync.get('bs-webpack-plugin').reload(); },
      }],
      // Move snippet injection to </body>,
      // Shopify content_for_header causes injection to load in head and break scripts
      snippetOptions: {
        rule: {
          match: /<\/body>/i,
          fn(snippet, match) {
            return snippet + match;
          },
        },
      },
    },
    {
      reload: false,
    }),
  ],
});
