
import { ONNXHTDemucs } from 'demucs/dist/onnx-htdemucs.js';
import { separateTracks } from 'demucs/dist/apply.js';
import { samplesToWav } from 'demucs/dist/wav-utils.js';

let modelPromise = null;
let processing = false;

async function getModel() {
    if (modelPromise) {
        return modelPromise;
    }

    modelPromise = (async () => {
        self.postMessage({
            type: 'status',
            text: 'Loading Demucs AI model (~166 MB)...',
        });

        const modelUrl = new URL(
            'htdemucs.onnx',
            self.location.href
        ).href;

        const cache = await caches.open('gpgc-demucs-v1');

        let response = await cache.match(modelUrl);

        if (!response) {
            response = await fetch(modelUrl);

            if (!response.ok) {
                throw new Error(
                    `Model download failed: HTTP ${response.status}`
                );
            }

            const copy = response.clone();

            try {
                await cache.put(modelUrl, copy);
            } catch (error) {
                console.warn('Model caching unavailable:', error);
            }
        }

        const weights = await response.arrayBuffer();

        if (weights.byteLength < 100 * 1024 * 1024) {
            await cache.delete(modelUrl);
            throw new Error('Downloaded model is incomplete.');
        }

        self.postMessage({
            type: 'status',
            text: 'Initializing AI inference...',
        });

        return ONNXHTDemucs.init(weights);
    })();

    try {
        return await modelPromise;
    } catch (error) {
        modelPromise = null;
        throw error;
    }
}

self.onmessage = async event => {
    const message = event.data;

    if (message.type !== 'separate' || processing) {
        return;
    }

    processing = true;

    try {
        const model = await getModel();

        self.postMessage({
            type: 'status',
            text: 'Separating instruments...',
        });

        const tracks = await separateTracks(
            model,
            message.rawAudio,
            (step, total) => {
                self.postMessage({
                    type: 'progress',
                    step,
                    total,
                });
            }
        );

        const results = {};

        for (const [name, audio] of Object.entries(tracks)) {
            const wav = samplesToWav(
                audio.channelData,
                audio.sampleRate
            );

            results[name] = wav.buffer;
        }

        self.postMessage(
            {
                type: 'done',
                tracks: results,
            },
            Object.values(results)
        );
    } catch (error) {
        self.postMessage({
            type: 'error',
            message: error.message || 'Separation failed.',
        });
    } finally {
        processing = false;
    }
};
