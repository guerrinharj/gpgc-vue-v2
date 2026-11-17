
<template>
    <section class="looper" aria-label="Audio looper">
        <div class="looper-header">
            <strong>THE LOOPER</strong>
            <span>{{ loopEnabled ? 'LOOP ACTIVE' : 'A / B' }}</span>
        </div>

        <p class="description">
            Select a section to repeat or download as WAV.
        </p>

        <div
            ref="waveformRef"
            class="waveform"
            :class="{ disabled: !hasTrack }"
            @pointerdown="onPointerDown"
            @pointermove="onPointerMove"
            @pointerup="onPointerUp"
            @pointercancel="onPointerUp"
        >
            <div
                v-for="(height, index) in waveform"
                :key="index"
                class="waveform-bar"
                :class="{ selected: isSelected(index) }"
                :style="{ height: `${height}%` }"
            ></div>

            <div
                class="selection"
                :style="selectionStyle"
            ></div>

            <div
                class="playhead"
                :style="{ left: `${playheadPercent}%` }"
            ></div>
        </div>

        <div class="time-labels">
            <span>0:00</span>
            <span>{{ formatTime(duration) }}</span>
        </div>

        <div class="point-controls">
            <label>
                <span>START / A</span>
                <input
                    v-model.number="start"
                    type="number"
                    min="0"
                    :max="duration"
                    step="0.01"
                    :disabled="!hasTrack"
                    @change="normalizePoints"
                />
            </label>

            <label>
                <span>END / B</span>
                <input
                    v-model.number="end"
                    type="number"
                    min="0"
                    :max="duration"
                    step="0.01"
                    :disabled="!hasTrack"
                    @change="normalizePoints"
                />
            </label>
        </div>

        <div class="loop-length">
            <span>LOOP LENGTH</span>
            <strong>{{ formatPreciseTime(loopLength) }}</strong>
        </div>

        <div class="actions">
            <button
                type="button"
                :disabled="!hasTrack"
                :class="{ active: loopEnabled }"
                @click="toggleLoop"
            >
                {{ loopEnabled ? 'STOP LOOP' : 'START LOOP' }}
            </button>

            <button
                type="button"
                :disabled="!hasTrack || exporting"
                @click="exportLoop"
            >
                {{ exporting ? 'EXPORTING…' : 'DOWNLOAD WAV' }}
            </button>
        </div>

        <button
            type="button"
            class="reset-button"
            :disabled="!hasTrack"
            @click="resetLoop"
        >
            Reset selection
        </button>

        <p v-if="error" class="error" role="status">
            {{ error }}
        </p>
    </section>
</template>

<script>
import {
    computed,
    onBeforeUnmount,
    ref,
    watch,
} from 'vue';

export default {
    name: 'TheLooper',

    props: {
        audioElement: {
            type: Object,
            default: null,
        },

        sourceUrl: {
            type: String,
            default: '',
        },

        trackName: {
            type: String,
            default: 'track',
        },

        duration: {
            type: Number,
            default: 0,
        },

        currentTime: {
            type: Number,
            default: 0,
        },
    },

    emits: [
        'loop-change',
    ],

    setup(props, { emit }) {
        const start = ref(0);
        const end = ref(0);
        const loopEnabled = ref(false);
        const exporting = ref(false);
        const error = ref('');
        const waveformRef = ref(null);

        const waveform = ref(
            Array.from({ length: 64 }, (_, index) => {
                return Math.max(
                    8,
                    Math.min(
                        95,
                        Math.abs(Math.sin(index * 1.71)) * 45 +
                        Math.abs(Math.cos(index * 0.37)) * 35
                    )
                );
            })
        );

        let animationFrame = null;
        let activePointer = null;
        let activeHandle = null;
        let exportController = null;
        let exportRequestId = 0;

        const hasTrack = computed(() => {
            return Boolean(
                props.audioElement &&
                props.sourceUrl &&
                Number.isFinite(props.duration) &&
                props.duration > 0
            );
        });

        const loopLength = computed(() => {
            return Math.max(0, end.value - start.value);
        });

        const selectionStyle = computed(() => {
            if (!props.duration) {
                return {
                    left: '0%',
                    width: '0%',
                };
            }

            return {
                left: `${start.value / props.duration * 100}%`,
                width: `${loopLength.value / props.duration * 100}%`,
            };
        });

        const playheadPercent = computed(() => {
            if (!props.duration) {
                return 0;
            }

            return Math.max(
                0,
                Math.min(
                    100,
                    props.currentTime / props.duration * 100
                )
            );
        });

        function formatTime(value) {
            if (!Number.isFinite(value)) {
                return '0:00';
            }

            const minutes = Math.floor(value / 60);
            const seconds = Math.floor(value % 60);

            return `${minutes}:${String(seconds).padStart(2, '0')}`;
        }

        function formatPreciseTime(value) {
            if (!Number.isFinite(value)) {
                return '0:00.00';
            }

            const minutes = Math.floor(value / 60);
            const seconds = (value % 60).toFixed(2);

            return `${minutes}:${seconds.padStart(5, '0')}`;
        }

        function normalizePoints() {
            if (!hasTrack.value) {
                return;
            }

            const maximum = props.duration;
            const minimumLength = Math.min(0.01, maximum);

            start.value = Math.max(
                0,
                Math.min(
                    Number(start.value) || 0,
                    maximum - minimumLength
                )
            );

            end.value = Math.max(
                start.value + minimumLength,
                Math.min(
                    Number(end.value) || maximum,
                    maximum
                )
            );
        }

        function isSelected(index) {
            if (!props.duration) {
                return false;
            }

            const position = index / waveform.value.length;

            return position >= start.value / props.duration &&
                position <= end.value / props.duration;
        }

        function getPointerPosition(event) {
            const bounds = waveformRef.value.getBoundingClientRect();

            const ratio = Math.max(
                0,
                Math.min(
                    1,
                    (event.clientX - bounds.left) / bounds.width
                )
            );

            return ratio * props.duration;
        }

        function updatePointer(event) {
            if (!hasTrack.value || !activeHandle) {
                return;
            }

            const position = getPointerPosition(event);
            const minimumLength = Math.min(0.01, props.duration);

            if (activeHandle === 'start') {
                start.value = Math.max(
                    0,
                    Math.min(position, end.value - minimumLength)
                );
            } else {
                end.value = Math.min(
                    props.duration,
                    Math.max(position, start.value + minimumLength)
                );
            }
        }

        function onPointerDown(event) {
            if (!hasTrack.value) {
                return;
            }

            const position = getPointerPosition(event);

            activeHandle =
                Math.abs(position - start.value) <=
                Math.abs(position - end.value)
                    ? 'start'
                    : 'end';

            activePointer = event.pointerId;

            waveformRef.value.setPointerCapture(event.pointerId);

            updatePointer(event);
        }

        function onPointerMove(event) {
            if (activePointer !== event.pointerId) {
                return;
            }

            updatePointer(event);
        }

        function onPointerUp(event) {
            if (activePointer !== event.pointerId) {
                return;
            }

            if (
                waveformRef.value?.hasPointerCapture(event.pointerId)
            ) {
                waveformRef.value.releasePointerCapture(event.pointerId);
            }

            activePointer = null;
            activeHandle = null;
        }

        function stopMonitoring() {
            if (animationFrame !== null) {
                cancelAnimationFrame(animationFrame);
                animationFrame = null;
            }
        }

        function stopLoop() {
            loopEnabled.value = false;
            stopMonitoring();
            emit('loop-change', false);
        }

        function enforceLoop() {
            if (!loopEnabled.value || !props.audioElement) {
                return;
            }

            const audio = props.audioElement;

            if (
                audio.currentTime >= end.value ||
                audio.currentTime < start.value
            ) {
                audio.currentTime = start.value;
            }
        }

        function monitorLoop() {
            if (!loopEnabled.value || !props.audioElement) {
                stopMonitoring();
                return;
            }

            enforceLoop();

            animationFrame = requestAnimationFrame(monitorLoop);
        }

        async function toggleLoop() {
            if (!hasTrack.value) {
                return;
            }

            error.value = '';

            if (loopEnabled.value) {
                stopLoop();
                return;
            }

            normalizePoints();

            const audio = props.audioElement;

            audio.currentTime = start.value;
            loopEnabled.value = true;
            emit('loop-change', true);

            try {
                await audio.play();

                if (loopEnabled.value) {
                    stopMonitoring();
                    monitorLoop();
                }
            } catch (err) {
                stopLoop();
                error.value = 'Unable to start loop playback.';
                console.warn('Looper playback:', err);
            }
        }

        function resetLoop() {
            stopLoop();

            start.value = 0;
            end.value = props.duration || 0;
            error.value = '';
        }

        function writeString(view, offset, value) {
            for (let index = 0; index < value.length; index++) {
                view.setUint8(
                    offset + index,
                    value.charCodeAt(index)
                );
            }
        }

        function encodeWav(audioBuffer) {
            const channels = Math.min(
                2,
                audioBuffer.numberOfChannels
            );

            const sampleRate = audioBuffer.sampleRate;
            const samples = audioBuffer.length;
            const bytesPerSample = 2;
            const blockAlign = channels * bytesPerSample;
            const dataSize = samples * blockAlign;

            const buffer = new ArrayBuffer(44 + dataSize);
            const view = new DataView(buffer);

            writeString(view, 0, 'RIFF');
            view.setUint32(4, 36 + dataSize, true);
            writeString(view, 8, 'WAVE');
            writeString(view, 12, 'fmt ');

            view.setUint32(16, 16, true);
            view.setUint16(20, 1, true);
            view.setUint16(22, channels, true);
            view.setUint32(24, sampleRate, true);
            view.setUint32(
                28,
                sampleRate * blockAlign,
                true
            );
            view.setUint16(32, blockAlign, true);
            view.setUint16(34, 16, true);

            writeString(view, 36, 'data');
            view.setUint32(40, dataSize, true);

            const channelData = [];

            for (let channel = 0; channel < channels; channel++) {
                channelData.push(
                    audioBuffer.getChannelData(channel)
                );
            }

            let offset = 44;

            for (let index = 0; index < samples; index++) {
                for (let channel = 0; channel < channels; channel++) {
                    const sample = Math.max(
                        -1,
                        Math.min(1, channelData[channel][index])
                    );

                    view.setInt16(
                        offset,
                        sample < 0
                            ? sample * 0x8000
                            : sample * 0x7fff,
                        true
                    );

                    offset += 2;
                }
            }

            return new Blob(
                [buffer],
                { type: 'audio/wav' }
            );
        }

        async function exportLoop() {
            if (!hasTrack.value || exporting.value) {
                return;
            }

            normalizePoints();

            const sourceUrl = props.sourceUrl;
            const trackName = props.trackName;
            const selectedStart = start.value;
            const selectedEnd = end.value;

            const requestId = ++exportRequestId;
            const controller = new AbortController();

            exportController = controller;
            exporting.value = true;
            error.value = '';

            let context = null;

            try {
                const response = await fetch(sourceUrl, {
                    mode: 'cors',
                    signal: controller.signal,
                });

                if (!response.ok) {
                    throw new Error(
                        `Audio request failed: ${response.status}`
                    );
                }

                const arrayBuffer = await response.arrayBuffer();

                if (controller.signal.aborted) {
                    return;
                }

                const AudioContextClass =
                    window.AudioContext ||
                    window.webkitAudioContext;

                if (!AudioContextClass) {
                    throw new Error('Web Audio API unavailable.');
                }

                context = new AudioContextClass();

                const decoded = await context.decodeAudioData(
                    arrayBuffer
                );

                if (
                    controller.signal.aborted ||
                    requestId !== exportRequestId
                ) {
                    return;
                }

                const sampleRate = decoded.sampleRate;

                const startSample = Math.max(
                    0,
                    Math.floor(selectedStart * sampleRate)
                );

                const endSample = Math.min(
                    decoded.length,
                    Math.ceil(selectedEnd * sampleRate)
                );

                const length = endSample - startSample;

                if (length <= 0) {
                    throw new Error('Invalid loop selection.');
                }

                const channels = Math.min(
                    2,
                    decoded.numberOfChannels
                );

                const output = context.createBuffer(
                    channels,
                    length,
                    sampleRate
                );

                for (let channel = 0; channel < channels; channel++) {
                    const source = decoded.getChannelData(channel);
                    const destination = output.getChannelData(channel);

                    destination.set(
                        source.subarray(startSample, endSample)
                    );
                }

                const wav = encodeWav(output);
                const objectUrl = URL.createObjectURL(wav);

                const filename = trackName
                    .replace(/[^a-z0-9-_ ]/gi, '')
                    .trim()
                    .replace(/\s+/g, '-')
                    .toLowerCase() || 'track';

                const link = document.createElement('a');

                link.href = objectUrl;
                link.download = `${filename}-loop.wav`;

                document.body.appendChild(link);
                link.click();
                link.remove();

                setTimeout(() => {
                    URL.revokeObjectURL(objectUrl);
                }, 1000);
            } catch (err) {
                if (err.name !== 'AbortError') {
                    console.error('Loop export:', err);

                    error.value =
                        'Unable to export WAV. Check audio access and CORS permissions.';
                }
            } finally {
                if (context) {
                    await context.close().catch(() => {});
                }

                if (exportController === controller) {
                    exportController = null;
                }

                if (requestId === exportRequestId) {
                    exporting.value = false;
                }
            }
        }

        watch(
            () => props.sourceUrl,
            () => {
                exportRequestId++;
                exportController?.abort();
                exporting.value = false;
                resetLoop();
            }
        );

        watch(
            () => props.duration,
            (value) => {
                if (!loopEnabled.value) {
                    start.value = 0;
                    end.value = Number.isFinite(value) ? value : 0;
                } else {
                    normalizePoints();
                }
            },
            { immediate: true }
        );

        watch(
            [start, end],
            () => {
                if (loopEnabled.value) {
                    enforceLoop();
                }
            }
        );

        onBeforeUnmount(() => {
            stopLoop();
            exportRequestId++;
            exportController?.abort();
        });

        return {
            start,
            end,
            loopEnabled,
            exporting,
            error,
            waveform,
            waveformRef,
            hasTrack,
            loopLength,
            selectionStyle,
            playheadPercent,
            formatTime,
            formatPreciseTime,
            normalizePoints,
            isSelected,
            onPointerDown,
            onPointerMove,
            onPointerUp,
            toggleLoop,
            resetLoop,
            exportLoop,
        };
    },
};
</script>

<style scoped>
.looper {
    grid-column: 1 / -1;
    border-top: 1px solid #555;
    padding-top: 18px;
    margin-top: 5px;
    color: #fff;
}

.looper-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    font-size: 14px;
    letter-spacing: -0.5px;
}

.looper-header span {
    color: #999;
    font-size: 10px;
    letter-spacing: 0.5px;
}

.description {
    color: #999;
    font-size: 11px;
    line-height: 1.5;
    margin: 12px 0 18px;
    letter-spacing: 0;
}

.waveform {
    position: relative;
    display: flex;
    align-items: center;
    gap: 2px;
    width: 100%;
    height: 75px;
    cursor: crosshair;
    overflow: hidden;
    touch-action: none;
}

.waveform.disabled {
    opacity: 0.35;
    cursor: default;
}

.waveform-bar {
    flex: 1;
    min-width: 1px;
    background: #555;
    pointer-events: none;
}

.waveform-bar.selected {
    background: #fff;
}

.selection {
    position: absolute;
    top: 0;
    bottom: 0;
    background: rgba(255, 255, 255, 0.08);
    border-left: 1px solid #fff;
    border-right: 1px solid #fff;
    pointer-events: none;
}

.playhead {
    position: absolute;
    top: 0;
    bottom: 0;
    width: 1px;
    background: #fff;
    pointer-events: none;
}

.time-labels {
    display: flex;
    justify-content: space-between;
    color: #999;
    font-size: 10px;
    margin-top: 6px;
}

.point-controls {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
    margin-top: 20px;
}

.point-controls label {
    display: flex;
    flex-direction: column;
    gap: 8px;
    min-width: 0;
}

.point-controls label span {
    color: #999;
    font-size: 10px;
    letter-spacing: 0.3px;
}

.point-controls input {
    box-sizing: border-box;
    width: 100%;
    min-width: 0;
    background: #000;
    color: #fff;
    border: 1px solid #555;
    border-radius: 0;
    padding: 10px;
    font: inherit;
    font-size: 13px;
}

.point-controls input:focus-visible {
    outline: 1px solid #fff;
}

.loop-length {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    border-top: 1px solid #333;
    margin-top: 18px;
    padding-top: 14px;
}

.loop-length span {
    color: #999;
    font-size: 10px;
    letter-spacing: 0.3px;
}

.loop-length strong {
    font-size: 15px;
    font-weight: 400;
    font-variant-numeric: tabular-nums;
}

.actions {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
    margin-top: 20px;
}

.actions button {
    min-height: 40px;
    padding: 9px 5px;
    background: #000;
    border: 1px solid #fff;
    color: #fff;
    font: inherit;
    font-size: 11px;
    letter-spacing: -0.2px;
    cursor: pointer;
}

.actions button.active,
.actions button:hover:not(:disabled) {
    background: #fff;
    color: #000;
}

.actions button:disabled {
    opacity: 0.4;
    cursor: default;
}

.reset-button {
    display: block;
    margin-top: 15px;
    color: #aaa;
    font-size: 11px;
    text-decoration: underline;
    text-underline-offset: 3px;
    cursor: pointer;
}

.reset-button:disabled {
    opacity: 0.4;
    cursor: default;
}

.error {
    margin-top: 12px;
    color: #ff9999;
    font-size: 11px;
    line-height: 1.5;
}

@media (max-width: 420px) {
    .actions {
        grid-template-columns: 1fr;
    }

    .point-controls {
        gap: 6px;
    }

    .point-controls input {
        padding: 7px;
        font-size: 11px;
    }
}
</style>
