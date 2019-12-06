const path = require('path');

module.exports = {
  entry: './src/index.js',
  output: {
    path: path.resolve(__dirname, 'dist'),
    libraryTarget: 'umd',
    filename: 'index.js'
  },
  target: 'node',
  module: {
    strictExportPresence: true,
  },
  resolve: {
    modules: [
        'node_modules',
        path.resolve(__dirname, 'src')
    ],
    extensions: ['.js', '.json', '.jsx'],
  }
};
