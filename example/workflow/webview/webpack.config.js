// @ts-check
const path = require('path');

const outputPath = path.resolve(__dirname, '../extension/pack');
var CircularDependencyPlugin = require('circular-dependency-plugin');

/**@type {import('webpack').Configuration}*/
const config = {
    target: 'web',

    entry: path.resolve(__dirname, 'src/index.ts'),
    output: {
        filename: 'webview.js',
        path: outputPath
    },
    devtool: 'eval-source-map',
    mode: 'development',

    resolve: {
        extensions: ['.ts', '.tsx', '.js']
    },
    module: {
        rules: [
            {
                test: /\.tsx?$/,
                use: ['ts-loader']
            },
            {
                test: /\.js$/,
                use: ['source-map-loader'],
                enforce: 'pre'
            },
            {
                test: /\.css$/,
                exclude: /(codicon|\.useable)\.css$/,
                use: ['style-loader', 'css-loader']
            },
            {
                test: /codicon.css$/,
                use: ['ignore-loader']
            }
        ]
    },
    ignoreWarnings: [/Failed to parse source map/, /Can't resolve .* in '.*ws\/lib'/],
    plugins: [
        new CircularDependencyPlugin({
            exclude: /(node_modules|examples)\/./,
            failOnError: false
        })
    ]
};

module.exports = config;
