var path = require('path');
var HtmlWebpackPlugin = require('html-webpack-plugin');

var srcDir = path.resolve(__dirname, './dev-example');

module.exports = {
  devtool: 'cheap-module-source-map',
  context: srcDir,
  performance: {
    hints: false
  },
  entry: './index.js',
  output: {
    filename: '[name].js'
  },
  optimization: {
    splitChunks: {
      cacheGroups: {
        vendor: {
          test: /[\\/]node_modules[\\/]/,
          name: 'vendor',
          chunks: 'all',
          minSize: 0
        }
      }
    },
    runtimeChunk: {
      name: 'runtime'
    }
  },
  resolve: {
    modules: ['node_modules', '.']
  },
  module: {
    rules: [
      {
        test: /\.js$/,
        use: {
          loader: 'babel-loader'
        },
        exclude: /node_modules/
      }
    ]
  },
  devServer: {
    host: '0.0.0.0',
    port: 9000,
    allowedHosts: 'all'
  },
  plugins: [
    new HtmlWebpackPlugin({
      template: 'index.html'
    })
  ]
};
