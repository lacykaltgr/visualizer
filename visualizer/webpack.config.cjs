const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const ESLintPlugin = require('eslint-webpack-plugin');
const CopyPlugin = require('copy-webpack-plugin');

module.exports = {
  mode: 'development',
  entry: {
    index: './src/index.js',
  },
  module: {
    rules: [
      {
        test: /\.css$/i,
        use: ['style-loader', 'css-loader'],
      },
      {
        test: /\.ts$/,
        use: 'ts-loader',
        exclude: /node_modules/,
      },
      {
        // Add this rule for GLSL shader files (.vert and .frag)
        test: /\.(glsl|vs|fs|vert|frag)$/,
        use: 'webpack-glsl-loader',
        exclude: /node_modules/,
      },
    ],
  },
  resolve: {
    extensions: ['.ts', '.js', '.glsl', '.vs', '.fs', '.vert', '.frag'], // Add shader extensions
  },
  devServer: {
    static: {
      directory: path.join(__dirname, ''),
    },
    host: '0.0.0.0',
    server: 'https',
    compress: true,
    port: 8080,
    allowedHosts: ['all'],
  },
  output: {
    filename: '[name].bundle.js',
    path: path.resolve(__dirname, 'dist'),
    clean: true,
  },
  plugins: [
    new ESLintPlugin({
      extensions: ['js'],
      eslintPath: require.resolve('eslint'),
      overrideConfigFile: path.resolve(__dirname, '../.eslintrc.cjs'),
    }),
    new HtmlWebpackPlugin({
      template: './src/index.html',
    }),
    new CopyPlugin({
      patterns: [
        { from: 'src/assets', to: 'assets' },
        {
          from: 'node_modules/three/examples/jsm/libs/basis',
          to: 'vendor/basis',
        },
        {
          from: 'node_modules/three/examples/jsm/libs/draco',
          to: 'vendor/draco',
        },
      ],
    }),
  ],
  devtool: 'source-map',
};