import nodeResolve from "@rollup/plugin-node-resolve";
import ts from "rollup-plugin-ts";
import commonjs from "@rollup/plugin-commonjs";
import {terser} from "rollup-plugin-terser";
import replace from "@rollup/plugin-replace";
import license from "rollup-plugin-license";
import json from '@rollup/plugin-json';
import {main as outputFile} from "./package.json";

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
    input: "src/index.ts",
    output: {
        file: outputFile,
        format: "cjs",
        exports: "auto"
    },
    // These modules already exist in Discord, don't package them
    external: [
        'request',
        'electron',
        'fs',
        'path',
        'https',
        'http',
        'lodash',
        'stream',
        'events'
    ],
    plugins: [
        nodeResolve({
            preferBuiltins: true
        }),
        ts(),
        commonjs(),
        terser({
            compress: {
                ecma: 2019,
                keep_classnames: true,
                keep_fnames: true,
                passes: 3
            },
            mangle: false,
            format: {
                beautify: true,
                ecma: 2019,
                keep_numbers: true,
                indent_level: 4
            }
        }),
        replace({
            preventAssignment: false,
            values: {
                "    ": "\t"
            } 
        }),
        license({
            banner: {
                commentStyle: "regular",
                content: {
                    file: "src/banner.txt",
                    encoding: "utf-8"
                }
            }
        }),
        json()
    ],
    onwarn
};
