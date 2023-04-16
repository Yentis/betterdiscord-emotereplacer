import nodeResolve from "@rollup/plugin-node-resolve";
import {main as outputFile} from "./package.json";
import wasm from "@rollup/plugin-wasm";
import webWorkerLoader from 'rollup-plugin-web-worker-loader';
import packageJson from './package.json';
import sucrase from "@rollup/plugin-sucrase";
import prettier from "rollup-plugin-prettier";

const banner = `/**
 * @name ${packageJson.name}
 * @version ${packageJson.version}
 * @description ${packageJson.description}
 * @license ${packageJson.license}
 * @author ${packageJson.author}
 * @authorId ${packageJson.authorId}
 * @website ${packageJson.website}
 * @source ${packageJson.source}
 */`

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
        interop: 'esModule',
        banner
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
        webWorkerLoader({
            targetPlatform: 'browser',
            preserveSource: true
        }),
        sucrase({
            transforms: ['typescript'],
            disableESTransforms: true
        }),
        prettier({
            parser: 'babel',
            singleQuote: true
        })
    ],
    onwarn
};
