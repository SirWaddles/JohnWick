const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');

module.exports = {
    mode: 'production',
    entry: './src/index.js',
    output: {
        path: path.resolve(__dirname, 'dist'),
        filename: 'wick.build.js',
    },
    plugins: [new HtmlWebpackPlugin({
        title: "John Wick - Shop",
        meta: {viewport: 'width=device-width, initial-scale=1'}
    })],
    module: {
        rules: [
            {
                test: /\.js$/,
                exclude: /node-modules/,
                use: {
                    loader: 'babel-loader',
                    options: {
                        presets: [
                            ["@babel/preset-env", {
                                targets: {
                                    chrome: "72",
                                    firefox: "65",
                                },
                            }],
                            "@babel/preset-react",
                        ],
                    },
                },
            },
            {
                test: /\.css$/,
                use: ["style-loader", "css-loader"],
            },
        ],
    },
};
