import resolve from 'rollup-plugin-node-resolve';
import json from '@rollup/plugin-json';
import commonjs from 'rollup-plugin-commonjs';
import babel from 'rollup-plugin-babel';
import builtins from 'rollup-plugin-node-builtins';
import pkg from './package.json';

export default [
    {
        input: "src/index.js",
        external: [ 'color-name', 'escape-html', 'html-to-vdom', 'jszip', 'virtual-dom', 'xmlbuilder2', '@babel', 'sax', 'timm'],
        internal: ['vm'],
        output: {
            name: 'docgen-toolkit',
            file: pkg.browser,
            format: "umd",
            exports: 'named',
            globals: {
                "@babel/runtime/regenerator": "regeneratorRuntime",
                "@babel/runtime/helpers/asyncToGenerator": "asyncToGenerator",
                "@babel/runtime/helpers/slicedToArray": "slicedToArray",
                "@babel/runtime/helpers/toConsumableArray": "toConsumableArray",
                "vm": "vm",
                "jszip": "JSZip",
                "timm": "timm",
                "xmlbuilder2": "xmlbuilder2",
                "sax": "sax"
            }
        },
        plugins: [
            resolve(),
            json({include: 'package.json', preferConst: true}),
            commonjs(),
            builtins(),
            babel({
                exclude: ["node_modules/**"],
                runtimeHelpers: true
            })
        ],
    },
    {
        input: "src/index.js",
        external: [ 'color-name', 'escape-html', 'html-to-vdom', 'jszip', 'virtual-dom', 'xmlbuilder2', '@babel', 'sax', 'timm'],
        output: [
            {file: pkg.main, format: "cjs", exports: 'named'},
            {file: pkg.module, format: "es", exports: 'named'},
        ],
        plugins: [
            babel({
                exclude: ["node_modules/**"],
                runtimeHelpers: true
            }),
        ],
    },
];