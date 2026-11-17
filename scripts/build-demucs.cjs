
const esbuild = require('esbuild');
const fs = require('fs');
const path = require('path');

async function build() {
    const root = process.cwd();
    const output = path.join(root, 'public', 'demucs');

    fs.mkdirSync(output, { recursive: true });

    await esbuild.build({
        entryPoints: [
            path.join(root, 'src', 'workers', 'demucs.worker.js'),
        ],
        outfile: path.join(output, 'worker.js'),
        bundle: true,
        platform: 'browser',
        format: 'iife',
        target: 'es2020',
        alias: {
            'onnxruntime-node': 'onnxruntime-web',
        },
        define: {
            'process.env.NODE_ENV': '"production"',
        },
    });

    const modelSource = path.join(
        root,
        'node_modules',
        'demucs',
        'htdemucs.onnx'
    );

    fs.copyFileSync(
        modelSource,
        path.join(output, 'htdemucs.onnx')
    );

    const runtimeDir = path.join(
        root,
        'node_modules',
        'onnxruntime-web',
        'dist'
    );

    for (const file of fs.readdirSync(runtimeDir)) {
        if (
            file.startsWith('ort-wasm') &&
            (file.endsWith('.wasm') || file.endsWith('.mjs'))
        ) {
            fs.copyFileSync(
                path.join(runtimeDir, file),
                path.join(output, file)
            );
        }
    }

    console.log('Demucs browser assets built successfully.');
}

build().catch(error => {
    console.error(error);
    process.exitCode = 1;
});
