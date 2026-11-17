
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

            <div class="selection" :style="selectionStyle"></div>

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

        <div class="direction-section">
            <div class="direction-header">
                <span>PLAYBACK DIRECTION</span>
                <span>{{ direction.toUpperCase() }}</span>
            </div>

            <div class="direction-controls" role="group" aria-label="Playback direction">
                <button
                    v-for="option in directions"
                    :key="option.value"
                    type="button"
                    :disabled="!hasTrack"
                    :class="{ active: direction === option.value }"
                    :aria-pressed="direction === option.value"
                    @click="setDirection(option.value)"
                >
                    <span class="direction-icon">{{ option.icon }}</span>
                    <span>{{ option.label }}</span>
                </button>
            </div>

            <p class="direction-description">
                {{ directionDescription }}
            </p>
        </div>

        <div class="actions">
            <button
                type="button"
                :disabled="!hasTrack"
                :class="{ active: loopEnabled }"
                @click="toggleLoop"
            >
                {{
                    preparing
                        ? 'CANCEL'
                        : loopEnabled
                            ? 'STOP LOOP'
                            : 'START LOOP'
                }}
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
        audioContext: {
            type: Object,
            default: null,
        },
        connectLoopSource: {
            type: Function,
            default: null,
        },
        playbackRate: {
            type: Number,
            default: 1,
        },
    },

    emits: [
        'loop-change',
        'loop-playing',
        'loop-time',
    ],

    setup(props, { emit, expose }) {
        const start = ref(0);
        const end = ref(0);
        const direction = ref('forward');
        const loopEnabled = ref(false);
        const loopPlaying = ref(false);
        const preparing = ref(false);
        const exporting = ref(false);
        const error = ref('');
        const waveformRef = ref(null);
        const processedTime = ref(null);

        const directions = [
            { value: 'forward', label: 'Forward', icon: '→' },
            { value: 'reverse', label: 'Reverse', icon: '←' },
            { value: 'pingpong', label: 'Ping-Pong', icon: '↔' },
        ];

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

        let playbackController = null;
        let exportController = null;
        let playbackRequestId = 0;
        let exportRequestId = 0;

        let decodedCache = null;
        let decodedCacheUrl = '';

        let sourceNode = null;
        let bufferDuration = 0;
        let playbackStartedAt = 0;
        let playbackOffset = 0;
        let playbackStart = 0;
        let playbackEnd = 0;
        let playbackDirection = 'forward';

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

        const directionDescription = computed(() => {
            switch (direction.value) {
                case 'reverse':
                    return 'Play the selected audio backwards.';
                case 'pingpong':
                    return 'Play forwards, then backwards, continuously.';
                default:
                    return 'Play the selected audio normally.';
            }
        });

        const selectionStyle = computed(() => {
            if (!props.duration) {
                return { left: '0%', width: '0%' };
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

            const time = processedTime.value === null
                ? props.currentTime
                : processedTime.value;

            return Math.max(
                0,
                Math.min(100, time / props.duration * 100)
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
            const minimum = Math.min(0.01, maximum);

            start.value = Math.max(
                0,
                Math.min(Number(start.value) || 0, maximum - minimum)
            );

            end.value = Math.max(
                start.value + minimum,
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
                Math.min(1, (event.clientX - bounds.left) / bounds.width)
            );

            return ratio * props.duration;
        }

        function updatePointer(event) {
            if (!hasTrack.value || !activeHandle) {
                return;
            }

            const position = getPointerPosition(event);
            const minimum = Math.min(0.01, props.duration);

            if (activeHandle === 'start') {
                start.value = Math.max(
                    0,
                    Math.min(position, end.value - minimum)
                );
            } else {
                end.value = Math.min(
                    props.duration,
                    Math.max(position, start.value + minimum)
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
            if (activePointer === event.pointerId) {
                updatePointer(event);
            }
        }

        function onPointerUp(event) {
            if (activePointer !== event.pointerId) {
                return;
            }

            if (waveformRef.value?.hasPointerCapture(event.pointerId)) {
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

        function stopSource() {
            if (!sourceNode) {
                return;
            }

            try {
                sourceNode.stop();
            } catch (_) {
                // Already stopped.
            }

            sourceNode.disconnect();
            sourceNode = null;
        }

        function setPlaying(value) {
            if (loopPlaying.value === value) {
                return;
            }

            loopPlaying.value = value;
            emit('loop-playing', value);
        }

        function stopLoop() {
            playbackRequestId++;
            playbackController?.abort();
            playbackController = null;

            const wasEnabled = loopEnabled.value;

            stopMonitoring();
            stopSource();

            loopEnabled.value = false;
            preparing.value = false;
            processedTime.value = null;

            setPlaying(false);

            if (wasEnabled) {
                emit('loop-change', false);
            }
        }

        function enforceForward() {
            if (
                !loopEnabled.value ||
                !props.audioElement ||
                direction.value !== 'forward'
            ) {
                return;
            }

            const audio = props.audioElement;

            if (
                audio.currentTime < start.value ||
                audio.currentTime >= end.value
            ) {
                audio.currentTime = start.value;
            }
        }

        function monitorForward() {
            if (
                !loopEnabled.value ||
                !loopPlaying.value ||
                direction.value !== 'forward'
            ) {
                stopMonitoring();
                return;
            }

            enforceForward();
            animationFrame = requestAnimationFrame(monitorForward);
        }

        function currentBufferOffset() {
            if (!props.audioContext || !bufferDuration) {
                return playbackOffset;
            }

            if (!loopPlaying.value) {
                return playbackOffset;
            }

            const elapsed =
                (props.audioContext.currentTime - playbackStartedAt) *
                Math.max(0.01, props.playbackRate);

            return (playbackOffset + elapsed) % bufferDuration;
        }

        function offsetToTrackTime(offset) {
            const length = playbackEnd - playbackStart;

            if (length <= 0) {
                return playbackStart;
            }

            if (playbackDirection === 'reverse') {
                return playbackEnd - Math.min(offset, length);
            }

            const position = offset % (length * 2);

            return position <= length
                ? playbackStart + position
                : playbackEnd - (position - length);
        }

        function monitorProcessed() {
            if (
                !loopEnabled.value ||
                !loopPlaying.value ||
                !sourceNode
            ) {
                stopMonitoring();
                return;
            }

            const position = offsetToTrackTime(currentBufferOffset());

            processedTime.value = position;
            emit('loop-time', position);

            animationFrame = requestAnimationFrame(monitorProcessed);
        }

        async function decodeAudio(url, signal) {
            if (decodedCache && decodedCacheUrl === url) {
                return decodedCache;
            }

            const response = await fetch(url, {
                mode: 'cors',
                signal,
            });

            if (!response.ok) {
                throw new Error(`Audio request failed: ${response.status}`);
            }

            const arrayBuffer = await response.arrayBuffer();

            if (signal?.aborted) {
                throw new DOMException('Aborted', 'AbortError');
            }

            const Context =
                window.AudioContext ||
                window.webkitAudioContext;

            if (!Context) {
                throw new Error('Web Audio API unavailable.');
            }

            const context = new Context();

            try {
                const decoded = await context.decodeAudioData(arrayBuffer);

                if (signal?.aborted) {
                    throw new DOMException('Aborted', 'AbortError');
                }

                if (url === props.sourceUrl) {
                    decodedCache = decoded;
                    decodedCacheUrl = url;
                }

                return decoded;
            } finally {
                await context.close().catch(() => {});
            }
        }

        function createLoopBuffer(
            context,
            decoded,
            selectedStart,
            selectedEnd,
            selectedDirection
        ) {
            const rate = decoded.sampleRate;

            const first = Math.max(
                0,
                Math.floor(selectedStart * rate)
            );

            const last = Math.min(
                decoded.length,
                Math.ceil(selectedEnd * rate)
            );

            const length = last - first;

            if (length <= 0) {
                throw new Error('Invalid loop selection.');
            }

            const channels = Math.min(2, decoded.numberOfChannels);

            const outputLength = selectedDirection === 'pingpong'
                ? Math.max(1, length * 2 - 2)
                : length;

            const output = context.createBuffer(
                channels,
                outputLength,
                rate
            );

            for (let channel = 0; channel < channels; channel++) {
                const input = decoded.getChannelData(channel);
                const destination = output.getChannelData(channel);

                if (selectedDirection === 'forward') {
                    destination.set(input.subarray(first, last));
                }

                if (selectedDirection === 'reverse') {
                    for (let index = 0; index < length; index++) {
                        destination[index] = input[last - 1 - index];
                    }
                }

                if (selectedDirection === 'pingpong') {
                    destination.set(input.subarray(first, last));

                    for (let index = 1; index < length - 1; index++) {
                        destination[length + index - 1] =
                            input[last - 1 - index];
                    }
                }
            }

            return output;
        }

        function startBufferSource(buffer, offset = 0) {
            const context = props.audioContext;

            if (!context || !props.connectLoopSource) {
                throw new Error('Player audio graph unavailable.');
            }

            stopSource();

            const source = context.createBufferSource();

            source.buffer = buffer;
            source.loop = true;
            source.playbackRate.value = Math.max(
                0.01,
                props.playbackRate
            );

            props.connectLoopSource(source);

            bufferDuration = buffer.duration;
            playbackOffset = offset % bufferDuration;
            playbackStartedAt = context.currentTime;

            sourceNode = source;
            source.start(0, playbackOffset);

            setPlaying(true);

            stopMonitoring();
            monitorProcessed();
        }

        async function startProcessed(requestId, controller) {
            const selectedStart = start.value;
            const selectedEnd = end.value;
            const selectedDirection = direction.value;

            const decoded = await decodeAudio(
                props.sourceUrl,
                controller.signal
            );

            if (
                controller.signal.aborted ||
                requestId !== playbackRequestId
            ) {
                return;
            }

            const context = props.audioContext;

            if (!context || !props.connectLoopSource) {
                throw new Error('Player audio graph unavailable.');
            }

            const buffer = createLoopBuffer(
                context,
                decoded,
                selectedStart,
                selectedEnd,
                selectedDirection
            );

            await context.resume();

            if (
                controller.signal.aborted ||
                requestId !== playbackRequestId
            ) {
                return;
            }

            props.audioElement.pause();

            playbackStart = selectedStart;
            playbackEnd = selectedEnd;
            playbackDirection = selectedDirection;

            loopEnabled.value = true;
            preparing.value = false;

            emit('loop-change', true);

            startBufferSource(buffer);
        }

        async function startLoop() {
            if (!hasTrack.value) {
                return;
            }

            if (loopEnabled.value) {
                await resumeLoop();
                return;
            }

            if (preparing.value) {
                return;
            }

            error.value = '';
            normalizePoints();

            const requestId = ++playbackRequestId;

            if (direction.value === 'forward') {
                try {
                    const audio = props.audioElement;

                    audio.currentTime = start.value;

                    loopEnabled.value = true;
                    emit('loop-change', true);

                    await props.audioContext?.resume();
                    await audio.play();

                    if (
                        requestId !== playbackRequestId ||
                        !loopEnabled.value
                    ) {
                        return;
                    }

                    setPlaying(true);
                    monitorForward();
                } catch (err) {
                    stopLoop();
                    error.value = 'Unable to start loop playback.';
                    console.warn('Looper playback:', err);
                }

                return;
            }

            const controller = new AbortController();

            playbackController = controller;
            preparing.value = true;

            try {
                await startProcessed(requestId, controller);
            } catch (err) {
                if (
                    err.name !== 'AbortError' &&
                    requestId === playbackRequestId
                ) {
                    stopLoop();

                    error.value =
                        'Unable to process audio. Check CORS permissions.';

                    console.warn('Looper playback:', err);
                }
            } finally {
                if (requestId === playbackRequestId) {
                    preparing.value = false;
                    playbackController = null;
                }
            }
        }

        function pauseLoop() {
            if (!loopEnabled.value || !loopPlaying.value) {
                return;
            }

            stopMonitoring();

            if (direction.value === 'forward') {
                props.audioElement?.pause();
            } else {
                playbackOffset = currentBufferOffset();
                stopSource();
            }

            setPlaying(false);
        }

        async function resumeLoop() {
            if (!loopEnabled.value || loopPlaying.value) {
                return;
            }

            if (direction.value === 'forward') {
                try {
                    await props.audioContext?.resume();
                    await props.audioElement.play();

                    if (!loopEnabled.value) {
                        return;
                    }

                    setPlaying(true);
                    monitorForward();
                } catch (err) {
                    error.value = 'Unable to resume playback.';
                    console.warn('Looper resume:', err);
                }

                return;
            }

            if (!decodedCache || !props.audioContext) {
                stopLoop();
                await startLoop();
                return;
            }

            try {
                const buffer = createLoopBuffer(
                    props.audioContext,
                    decodedCache,
                    playbackStart,
                    playbackEnd,
                    playbackDirection
                );

                await props.audioContext.resume();

                if (loopEnabled.value) {
                    startBufferSource(buffer, playbackOffset);
                }
            } catch (err) {
                error.value = 'Unable to resume loop.';
                console.warn('Looper resume:', err);
            }
        }

        function seekLoop(time) {
            if (!loopEnabled.value) {
                return false;
            }

            const target = Math.max(
                start.value,
                Math.min(end.value, time)
            );

            if (direction.value === 'forward') {
                const audio = props.audioElement;

                if (!audio) {
                    return false;
                }

                audio.currentTime = target;
                return true;
            }

            const length = playbackEnd - playbackStart;

            if (length <= 0) {
                return false;
            }

            const offset = direction.value === 'reverse'
                ? playbackEnd - target
                : target - playbackStart;

            playbackOffset = Math.max(
                0,
                Math.min(offset, bufferDuration)
            );

            processedTime.value = target;
            emit('loop-time', target);

            if (loopPlaying.value) {
                const buffer = sourceNode?.buffer;

                if (buffer) {
                    startBufferSource(buffer, playbackOffset);
                }
            }

            return true;
        }

        function updateLoopRate() {
            if (!sourceNode || !props.audioContext) {
                return;
            }

            playbackOffset = currentBufferOffset();
            playbackStartedAt = props.audioContext.currentTime;

            sourceNode.playbackRate.value = Math.max(
                0.01,
                props.playbackRate
            );
        }

        function toggleLoop() {
            if (loopEnabled.value || preparing.value) {
                stopLoop();
            } else {
                void startLoop();
            }
        }

        function setDirection(value) {
            if (direction.value === value) {
                return;
            }

            const restart = loopEnabled.value || preparing.value;

            stopLoop();
            direction.value = value;
            error.value = '';

            if (restart) {
                void startLoop();
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
                view.setUint8(offset + index, value.charCodeAt(index));
            }
        }

        function encodeWav(audioBuffer) {
            const channels = Math.min(
                2,
                audioBuffer.numberOfChannels
            );

            const sampleRate = audioBuffer.sampleRate;
            const samples = audioBuffer.length;
            const blockAlign = channels * 2;
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
            view.setUint32(28, sampleRate * blockAlign, true);
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

            return new Blob([buffer], { type: 'audio/wav' });
        }

        async function exportLoop() {
            if (!hasTrack.value || exporting.value) {
                return;
            }

            normalizePoints();

            const selectedStart = start.value;
            const selectedEnd = end.value;
            const selectedDirection = direction.value;
            const sourceUrl = props.sourceUrl;
            const trackName = props.trackName;

            const requestId = ++exportRequestId;
            const controller = new AbortController();

            exportController = controller;
            exporting.value = true;
            error.value = '';

            try {
                const decoded = await decodeAudio(
                    sourceUrl,
                    controller.signal
                );

                if (
                    controller.signal.aborted ||
                    requestId !== exportRequestId
                ) {
                    return;
                }

                const Context =
                    window.AudioContext ||
                    window.webkitAudioContext;

                const context = new Context();

                try {
                    const output = createLoopBuffer(
                        context,
                        decoded,
                        selectedStart,
                        selectedEnd,
                        selectedDirection
                    );

                    const wav = encodeWav(output);
                    const url = URL.createObjectURL(wav);

                    const filename = trackName
                        .replace(/[^a-z0-9-_ ]/gi, '')
                        .trim()
                        .replace(/\s+/g, '-')
                        .toLowerCase() || 'track';

                    const suffix = selectedDirection === 'forward'
                        ? 'loop'
                        : `loop-${selectedDirection}`;

                    const link = document.createElement('a');

                    link.href = url;
                    link.download = `${filename}-${suffix}.wav`;

                    document.body.appendChild(link);
                    link.click();
                    link.remove();

                    setTimeout(() => URL.revokeObjectURL(url), 1000);
                } finally {
                    await context.close().catch(() => {});
                }
            } catch (err) {
                if (err.name !== 'AbortError') {
                    console.error('Loop export:', err);
                    error.value =
                        'Unable to export WAV. Check audio access and CORS.';
                }
            } finally {
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

                decodedCache = null;
                decodedCacheUrl = '';

                resetLoop();
            },
            { flush: 'sync' }
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

        watch([start, end], () => {
            if (!loopEnabled.value) {
                return;
            }

            if (direction.value === 'forward') {
                enforceForward();
            } else {
                stopLoop();
                void startLoop();
            }
        });

        watch(
            () => props.playbackRate,
            updateLoopRate
        );

        onBeforeUnmount(() => {
            stopLoop();

            exportRequestId++;
            exportController?.abort();

            decodedCache = null;
        });

        expose({
            startLoop,
            stopLoop,
            pauseLoop,
            resumeLoop,
            seekLoop,
            updateLoopRate,
        });

        return {
            start,
            end,
            direction,
            directions,
            directionDescription,
            loopEnabled,
            preparing,
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
            setDirection,
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

.direction-section {
    border-top: 1px solid #333;
    margin-top: 22px;
    padding-top: 16px;
}

.direction-header {
    display: flex;
    justify-content: space-between;
    gap: 10px;
    margin-bottom: 12px;
    color: #999;
    font-size: 10px;
    letter-spacing: 0.3px;
}

.direction-header span:last-child {
    color: #fff;
}

.direction-controls {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 6px;
}

.direction-controls button {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 6px;
    min-height: 64px;
    min-width: 0;
    padding: 10px 4px;
    background: #000;
    border: 1px solid #555;
    border-radius: 0;
    color: #aaa;
    font: inherit;
    font-size: 10px;
    cursor: pointer;
    transition: background 150ms ease, color 150ms ease;
}

.direction-controls button:hover:not(:disabled) {
    border-color: #fff;
    color: #fff;
}

.direction-controls button.active {
    background: #fff;
    border-color: #fff;
    color: #000;
}

.direction-controls button:disabled {
    opacity: 0.4;
    cursor: default;
}

.direction-icon {
    font-family: Arial, sans-serif;
    font-size: 24px;
    line-height: 1;
}

.direction-description {
    margin: 10px 0 0;
    color: #777;
    font-size: 10px;
    line-height: 1.5;
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
    padding: 0;
    background: transparent;
    border: 0;
    color: #aaa;
    font: inherit;
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

    .direction-controls {
        gap: 4px;
    }

    .direction-controls button {
        min-height: 58px;
        font-size: 9px;
    }

    .direction-icon {
        font-size: 21px;
    }
}
</style>
