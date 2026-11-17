
<template>
    <section class="stem-separator">
        <div class="separator-header">
            <div class="separator-title">
                <strong>AI Separation</strong>
                <span>4 STEMS</span>
            </div>

            <button
                type="button"
                class="track-button"
                :disabled="!sourceUrl || busy"
                @click="separate"
            >
                {{ busy ? 'Processing…' : 'Track' }}
            </button>
        </div>

        <p v-if="status" class="status" role="status">
            {{ status }}
        </p>

        <div v-if="busy" class="progress-track">
            <div
                class="progress-fill"
                :style="{ width: `${progress}%` }"
            ></div>
        </div>

        <p v-if="error" class="error" role="alert">
            {{ error }}
        </p>

        <div v-if="stems.length" class="stem-list">
            <div
                v-for="stem in stems"
                :key="stem.id"
                class="stem-item"
            >
                <div class="stem-header">
                    <strong>{{ stem.name }}</strong>

                    <button
                        type="button"
                        class="download-button"
                        :disabled="busy"
                        @click="downloadStem(stem)"
                    >
                        ↓ WAV
                    </button>
                </div>

                <audio
                    :ref="element => registerAudio(element, stem.id)"
                    :src="stem.url"
                    controls
                    preload="metadata"
                ></audio>
            </div>

            <p class="export-note">
                Preview:
                {{ (speed / 100).toFixed(2) }}×
                ·
                {{ vinylMode ? 'Vinyl' : 'Independent' }}
            </p>
        </div>
    </section>
</template>

<script>
import {
    ref,
    watch,
    onBeforeUnmount,
    nextTick,
} from 'vue';

export default {
    name: 'StemSeparator',

    props: {
        sourceUrl: {
            type: String,
            default: '',
        },

        trackName: {
            type: String,
            default: 'track',
        },

        speed: {
            type: Number,
            default: 100,
        },

        vinylMode: {
            type: Boolean,
            default: true,
        },
    },

    setup(props) {
        const stems = ref([]);
        const busy = ref(false);
        const status = ref('');
        const error = ref('');
        const progress = ref(0);

        const audioElements = new Map();

        let worker = null;
        let generation = 0;
        let disposed = false;
        let audioContext = null;

        const stemNames = [
            'drums',
            'bass',
            'vocals',
            'other',
        ];

        function clearStems() {
            for (const audio of audioElements.values()) {
                audio.pause();
            }

            for (const stem of stems.value) {
                URL.revokeObjectURL(stem.url);
            }

            stems.value = [];
            audioElements.clear();
        }

        function stopWorker() {
            if (worker) {
                worker.terminate();
                worker = null;
            }

            busy.value = false;
            progress.value = 0;
        }

        function applyPlayback(audio) {
            if (!audio) {
                return;
            }

            const preserve = !props.vinylMode;

            if ('preservesPitch' in audio) {
                audio.preservesPitch = preserve;
            }

            if ('webkitPreservesPitch' in audio) {
                audio.webkitPreservesPitch = preserve;
            }

            if ('mozPreservesPitch' in audio) {
                audio.mozPreservesPitch = preserve;
            }

            audio.playbackRate = props.speed / 100;
        }

        function registerAudio(element, id) {
            if (!element) {
                audioElements.delete(id);
                return;
            }

            audioElements.set(id, element);
            applyPlayback(element);
        }

        watch(
            () => [props.speed, props.vinylMode],
            () => {
                for (const audio of audioElements.values()) {
                    applyPlayback(audio);
                }
            }
        );

        watch(
            () => props.sourceUrl,
            () => {
                generation++;
                stopWorker();
                clearStems();

                status.value = '';
                error.value = '';
            }
        );

        function workerUrl() {
            const base = process.env.BASE_URL || '/';

            return `${base.replace(/\/?$/, '/') }demucs/worker.js`;
        }

        async function getAudioContext() {
            if (!audioContext) {
                const Context =
                    window.AudioContext ||
                    window.webkitAudioContext;

                audioContext = new Context({
                    sampleRate: 44100,
                });
            }

            if (audioContext.state === 'suspended') {
                await audioContext.resume();
            }

            return audioContext;
        }

        async function separate() {
            if (!props.sourceUrl || busy.value) {
                return;
            }

            const token = ++generation;
            const selectedUrl = props.sourceUrl;

            stopWorker();
            clearStems();

            busy.value = true;
            error.value = '';
            status.value = 'Loading current track...';
            progress.value = 0;

            try {
                const context = await getAudioContext();

                const response = await fetch(selectedUrl);

                if (!response.ok) {
                    throw new Error(
                        `Audio request failed: HTTP ${response.status}`
                    );
                }

                const data = await response.arrayBuffer();

                if (token !== generation || disposed) {
                    return;
                }

                status.value = 'Decoding audio...';

                const decoded = await context.decodeAudioData(data);

                if (token !== generation || disposed) {
                    return;
                }

                const channelData = [];

                for (
                    let index = 0;
                    index < Math.min(2, decoded.numberOfChannels);
                    index++
                ) {
                    channelData.push(
                        new Float32Array(
                            decoded.getChannelData(index)
                        )
                    );
                }

                if (channelData.length === 1) {
                    channelData.push(
                        new Float32Array(channelData[0])
                    );
                }

                if (channelData.length !== 2) {
                    throw new Error('Unable to decode stereo audio.');
                }

                const rawAudio = {
                    channelData,
                    sampleRate: decoded.sampleRate,
                };

                const instance = new Worker(workerUrl());

                worker = instance;

                instance.onmessage = async event => {
                    if (token !== generation || disposed) {
                        return;
                    }

                    const message = event.data;

                    if (message.type === 'status') {
                        status.value = message.text;
                    }

                    if (message.type === 'progress') {
                        progress.value = message.total
                            ? Math.round(
                                message.step / message.total * 100
                            )
                            : 0;

                        status.value =
                            `Separating instruments... ${progress.value}%`;
                    }

                    if (message.type === 'error') {
                        error.value = message.message;
                        status.value = '';
                        stopWorker();
                    }

                    if (message.type === 'done') {
                        const output = [];

                        for (const name of stemNames) {
                            const buffer = message.tracks[name];

                            if (!buffer) {
                                error.value =
                                    `Missing ${name} stem.`;
                                continue;
                            }

                            const blob = new Blob(
                                [buffer],
                                {
                                    type: 'audio/wav',
                                }
                            );

                            output.push({
                                id: name,
                                name:
                                    name.charAt(0).toUpperCase() +
                                    name.slice(1),
                                url: URL.createObjectURL(blob),
                            });
                        }

                        clearStems();

                        stems.value = output;

                        status.value =
                            output.length === 4
                                ? 'Four stems ready.'
                                : 'Some stems could not be generated.';

                        progress.value = 100;

                        stopWorker();

                        await nextTick();

                        for (const audio of audioElements.values()) {
                            applyPlayback(audio);
                        }
                    }
                };

                instance.onerror = event => {
                    if (token !== generation || disposed) {
                        return;
                    }

                    error.value =
                        event.message ||
                        'Unable to start Demucs worker.';

                    status.value = '';
                    stopWorker();
                };

                status.value = 'Starting Demucs...';

                instance.postMessage(
                    {
                        type: 'separate',
                        rawAudio,
                    },
                    channelData.map(channel => channel.buffer)
                );
            } catch (err) {
                if (token === generation && !disposed) {
                    error.value =
                        err.message || 'Separation failed.';

                    status.value = '';
                    stopWorker();
                }
            }
        }

        async function downloadStem(stem) {
            const response = await fetch(stem.url);
            const buffer = await response.arrayBuffer();

            const Context =
                window.AudioContext ||
                window.webkitAudioContext;

            const context = new Context();

            let decoded;

            try {
                decoded = await context.decodeAudioData(buffer);
            } finally {
                await context.close();
            }

            const rate = props.speed / 100;

            const offline = new OfflineAudioContext(
                decoded.numberOfChannels,
                Math.ceil(decoded.length / rate),
                decoded.sampleRate
            );

            const source = offline.createBufferSource();

            source.buffer = decoded;
            source.playbackRate.value = rate;
            source.connect(offline.destination);
            source.start();

            const rendered = await offline.startRendering();

            const channels = rendered.numberOfChannels;
            const samples = rendered.length;
            const sampleRate = rendered.sampleRate;

            const wav = new ArrayBuffer(
                44 + samples * channels * 2
            );

            const view = new DataView(wav);

            function writeString(offset, value) {
                for (let i = 0; i < value.length; i++) {
                    view.setUint8(
                        offset + i,
                        value.charCodeAt(i)
                    );
                }
            }

            writeString(0, 'RIFF');
            view.setUint32(4, wav.byteLength - 8, true);
            writeString(8, 'WAVE');
            writeString(12, 'fmt ');
            view.setUint32(16, 16, true);
            view.setUint16(20, 1, true);
            view.setUint16(22, channels, true);
            view.setUint32(24, sampleRate, true);
            view.setUint32(
                28,
                sampleRate * channels * 2,
                true
            );
            view.setUint16(32, channels * 2, true);
            view.setUint16(34, 16, true);
            writeString(36, 'data');
            view.setUint32(
                40,
                samples * channels * 2,
                true
            );

            const data = Array.from(
                { length: channels },
                (_, index) => rendered.getChannelData(index)
            );

            let offset = 44;

            for (let i = 0; i < samples; i++) {
                for (let channel = 0; channel < channels; channel++) {
                    const value = Math.max(
                        -1,
                        Math.min(1, data[channel][i])
                    );

                    view.setInt16(
                        offset,
                        value < 0
                            ? value * 32768
                            : value * 32767,
                        true
                    );

                    offset += 2;
                }
            }

            const blob = new Blob(
                [wav],
                {
                    type: 'audio/wav',
                }
            );

            const url = URL.createObjectURL(blob);

            const safeName = props.trackName.replace(
                /[^a-z0-9_-]+/gi,
                '_'
            );

            const link = document.createElement('a');

            link.href = url;
            link.download =
                `${safeName}_${stem.id}_${props.speed}pct.wav`;

            document.body.appendChild(link);
            link.click();
            link.remove();

            setTimeout(() => {
                URL.revokeObjectURL(url);
            }, 10000);
        }

        onBeforeUnmount(() => {
            disposed = true;
            generation++;

            stopWorker();
            clearStems();

            if (audioContext) {
                audioContext.close().catch(() => {});
            }
        });

        return {
            stems,
            busy,
            status,
            error,
            progress,
            registerAudio,
            separate,
            downloadStem,
        };
    },
};
</script>

<style scoped>
.stem-separator {
    grid-column: 1 / -1;
    min-width: 0;
    padding-top: 12px;
    border-top: 1px solid #444;
}

.separator-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
}

.separator-title {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 12px;
}

.separator-title span {
    color: #999;
    font-size: 9px;
    letter-spacing: 0.08em;
}

.track-button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: auto;
    padding: 6px 12px;
    border: 0;
    border-radius: 3px;
    background: #fff;
    color: #000;
    font-size: 11px;
    font-weight: 600;
    cursor: pointer;
}

.track-button:disabled {
    opacity: 0.45;
    cursor: default;
}

.status {
    margin: 10px 0;
    color: #aaa;
    font-size: 11px;
}

.progress-track {
    height: 3px;
    background: #333;
    overflow: hidden;
}

.progress-fill {
    height: 100%;
    background: #fff;
    transition: width 0.2s ease;
}

.error {
    margin: 10px 0;
    color: #ff8888;
    font-size: 11px;
    overflow-wrap: anywhere;
}

.stem-list {
    margin-top: 12px;
}

.stem-item {
    padding: 10px 0;
    border-top: 1px solid #333;
}

.stem-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    font-size: 12px;
}

.download-button {
    color: inherit;
    font-size: 10px;
    text-decoration: underline;
    cursor: pointer;
}

.stem-item audio {
    display: block;
    width: 100%;
    height: 34px;
    margin-top: 8px;
}

.export-note {
    color: #999;
    font-size: 10px;
    margin-top: 10px;
}
</style>
