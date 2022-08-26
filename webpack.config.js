const path = require('path');

module.exports = {
  entry: {
    styra_run: './src/index.js'
  },
  output: {
    filename: '[name].js',
    path: path.resolve(__dirname, 'dist'),
  },
  optimization: {
    minimize: true
  },
};
