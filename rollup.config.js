import nodeResolve from "@rollup/plugin-node-resolve";
import ts from "rollup-plugin-ts";
import commonjs from "@rollup/plugin-commonjs";
import {terser} from "rollup-plugin-terser";
import replace from "@rollup/plugin-replace";
import license from "rollup-plugin-license";
import json from '@rollup/plugin-json';
import {main as outputFile} from "./package.json";
import wasm from "@rollup/plugin-wasm";

const onwarn = (warning, rollupWarn) => {
    const ignoredWarnings = [
        {
            ignoredCode: 'CIRCULAR_DEPENDENCY',
            ignoredPath: 'node_modules/xmlbuilder'
        }
    ]

    // Only show warning when code and path doesn't match
    // anything in above list of ignored warnings
    if (!ignoredWarnings.some(({ ignoredCode, ignoredPath }) => (
        warning.code === ignoredCode &&
        warning.importer.startsWith(ignoredPath)))
    ) {
        rollupWarn(warning)
    }
}

export default {
    input: 'src/index.ts',
    output: {
        file: outputFile,
        format: 'cjs',
        exports: 'auto',
        interop: 'esModule'
    },
    treeshake: 'smallest',
    // These modules already exist in Discord, don't package them
    external: [
        'request',
        'electron',
        'fs',
        'path',
        'https',
        'http',
        'lodash',
        'events'
    ],
    plugins: [
        nodeResolve({
            preferBuiltins: true
        }),
        wasm({
            targetEnv: 'auto-inline'
        }),
        ts(),
        commonjs(),
        terser({
            compress: false,
            mangle: false,
            format: {
                beautify: true,
                ecma: 2019,
                keep_numbers: true,
                indent_level: 4,
                quote_style: 3
            }
        }),
        replace({
            preventAssignment: false,
            values: {
                '    ': '\t'
            } 
        }),
        license({
            banner: {
                commentStyle: 'regular',
                content: {
                    file: 'src/banner.txt',
                    encoding: 'utf-8'
                }
            }
        }),
        json()
    ],
    onwarn
};
