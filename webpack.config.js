var path = require('path');
module.exports = {
  entry: './actions/suggestion-provider.js',
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: 'bundle.js'
  },
  target: 'node'
};
