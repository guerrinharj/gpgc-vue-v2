<template>
    <section class="performance-recorder" aria-label="Performance Recorder">
        <div class="recorder-heading">
            <strong>Performance Recorder</strong>
            <span :class="['status', { recording }]">{{ recording ? '● REC' : 'READY' }}</span>
        </div>
        <p class="description">Record your live Looper performance, including keyboard jumps, pitch changes and audio effects.</p>
        <div class="clock">{{ formatTime(elapsed) }}</div>
        <div class="controls">
            <button type="button" :disabled="!canRecord || recording || processing" @click="startRecording">● REC</button>
            <button type="button" :disabled="!recording" @click="stopRecording">■ STOP</button>
            <button type="button" :disabled="!recordingUrl || recording || processing" @click="togglePreview">{{ previewPlaying ? 'Ⅱ PAUSE' : '▶ PLAY' }}</button>
        </div>
        <button class="download" type="button" :disabled="!recordingUrl || recording || processing" @click="downloadWav">↓ DOWNLOAD WAV</button>
        <audio ref="previewRef" :src="recordingUrl || undefined" @ended="previewPlaying = false"></audio>
        <p v-if="processing" class="message" role="status">Preparing WAV…</p>
        <p v-if="error" class="message" role="alert">{{ error }}</p>
        <p v-if="recordingUrl && !processing" class="message" role="status">Recording ready · {{ formatTime(elapsed) }}</p>
    </section>
</template>

<script>
import { computed, onBeforeUnmount, ref } from 'vue';

function encodeWav(buffer) {
    const channels = Math.min(buffer.numberOfChannels, 2);
    const frames = buffer.length;
    const data = new ArrayBuffer(44 + frames * channels * 2);
    const view = new DataView(data);
    const write = (offset, text) => {
        for (let i = 0; i < text.length; i++) view.setUint8(offset + i, text.charCodeAt(i));
    };
    write(0, 'RIFF');
    view.setUint32(4, data.byteLength - 8, true);
    write(8, 'WAVE');
    write(12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, channels, true);
    view.setUint32(24, buffer.sampleRate, true);
    view.setUint32(28, buffer.sampleRate * channels * 2, true);
    view.setUint16(32, channels * 2, true);
    view.setUint16(34, 16, true);
    write(36, 'data');
    view.setUint32(40, frames * channels * 2, true);
    const samples = Array.from({ length: channels }, (_, index) => buffer.getChannelData(index));
    let offset = 44;
    for (let frame = 0; frame < frames; frame++) {
        for (let channel = 0; channel < channels; channel++) {
            const value = Math.max(-1, Math.min(1, samples[channel][frame]));
            view.setInt16(offset, value < 0 ? value * 0x8000 : value * 0x7fff, true);
            offset += 2;
        }
    }
    return new Blob([data], { type: 'audio/wav' });
}

export default {
    name: 'ThePerformanceRecorder',
    props: {
        audioContext: { type: Object, default: null },
        recordingStream: { type: Object, default: null },
        trackName: { type: String, default: 'performance' },
        bpm: { type: Number, default: null },
    },
    setup(props) {
        const recording = ref(false);
        const processing = ref(false);
        const previewPlaying = ref(false);
        const recordingUrl = ref('');
        const previewRef = ref(null);
        const elapsed = ref(0);
        const error = ref('');
        const canRecord = computed(() => Boolean(props.audioContext && props.recordingStream && typeof MediaRecorder !== 'undefined'));
        let recorder = null;
        let clock = null;
        let startedAt = 0;
        let disposed = false;
        const formatTime = seconds => `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`;
        function clearClock() {
            if (clock !== null) window.clearInterval(clock);
            clock = null;
        }
        function clearRecording() {
            if (recordingUrl.value) URL.revokeObjectURL(recordingUrl.value);
            recordingUrl.value = '';
            previewPlaying.value = false;
        }
        async function startRecording() {
            if (!canRecord.value || recording.value || processing.value) return;
            error.value = '';
            try {
                await props.audioContext.resume();
                const type = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4'].find(candidate => MediaRecorder.isTypeSupported(candidate));
                if (!type) throw new Error('This browser does not support audio recording.');
                const chunks = [];
                const context = props.audioContext;
                const mediaRecorder = new MediaRecorder(props.recordingStream, { mimeType: type });
                recorder = mediaRecorder;
                mediaRecorder.ondataavailable = event => {
                    if (event.data && event.data.size) chunks.push(event.data);
                };
                mediaRecorder.onerror = () => {
                    error.value = 'Audio recording failed.';
                    recording.value = false;
                    clearClock();
                };
                mediaRecorder.onstop = async () => {
                    recording.value = false;
                    clearClock();
                    processing.value = true;
                    try {
                        const encoded = new Blob(chunks, { type });
                        const bytes = await encoded.arrayBuffer();
                        const decoded = await context.decodeAudioData(bytes);
                        const wav = encodeWav(decoded);
                        if (!disposed) {
                            clearRecording();
                            recordingUrl.value = URL.createObjectURL(wav);
                        }
                    } catch (cause) {
                        console.warn('WAV export:', cause);
                        if (!disposed) error.value = 'Unable to convert the recording to WAV.';
                    } finally {
                        processing.value = false;
                        recorder = null;
                    }
                };
                if (previewRef.value) previewRef.value.pause();
                clearRecording();
                elapsed.value = 0;
                mediaRecorder.start(250);
                startedAt = performance.now();
                recording.value = true;
                clock = window.setInterval(() => {
                    elapsed.value = (performance.now() - startedAt) / 1000;
                }, 100);
            } catch (cause) {
                console.warn('Performance recording:', cause);
                error.value = cause.message || 'Unable to start recording.';
            }
        }
        function stopRecording() {
            if (!recorder || recorder.state === 'inactive') return;
            elapsed.value = (performance.now() - startedAt) / 1000;
            recorder.stop();
            recording.value = false;
            clearClock();
        }
        async function togglePreview() {
            const audio = previewRef.value;
            if (!audio || !recordingUrl.value) return;
            if (audio.paused) {
                try {
                    await audio.play();
                    previewPlaying.value = true;
                } catch (cause) {
                    error.value = 'Unable to play the recorded audio.';
                }
            } else {
                audio.pause();
                previewPlaying.value = false;
            }
        }
        function downloadWav() {
            if (!recordingUrl.value) return;
            const name = props.trackName.replace(/[^a-z0-9_-]+/gi, '-').replace(/^-|-$/g, '') || 'performance';
            const bpm = Number.isFinite(props.bpm) && props.bpm > 0 ? `-${Math.round(props.bpm)}BPM` : '';
            const anchor = document.createElement('a');
            anchor.href = recordingUrl.value;
            anchor.download = `${name}${bpm}-performance.wav`;
            document.body.appendChild(anchor);
            anchor.click();
            anchor.remove();
        }
        onBeforeUnmount(() => {
            disposed = true;
            clearClock();
            if (recorder && recorder.state !== 'inactive') recorder.stop();
            previewRef.value?.pause();
            clearRecording();
        });
        return {
            recording, processing, previewPlaying, recordingUrl, previewRef, elapsed,
            error, canRecord, formatTime, startRecording, stopRecording, togglePreview, downloadWav,
        };
    },
};
</script>

<style scoped>
.performance-recorder { padding-top: 18px; color: #fff; }
.recorder-heading { display: flex; justify-content: space-between; align-items: center; gap: 10px; font-size: 14px; }
.status { font-size: 10px; color: #999; letter-spacing: 0.5px; }
.status.recording { color: #ff5555; }
.description { margin: 15px 0; color: #999; font-size: 11px; line-height: 1.5; letter-spacing: 0; }
.clock { margin: 20px 0; font-size: 32px; font-variant-numeric: tabular-nums; letter-spacing: -1px; }
.controls { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 6px; }
.controls button, .download { border: 1px solid #666; background: #202020; color: #fff; padding: 10px 4px; font-size: 11px; cursor: pointer; }
.controls button:hover:not(:disabled), .download:hover:not(:disabled) { background: #fff; color: #000; }
.controls button:disabled, .download:disabled { opacity: 0.4; cursor: default; }
.download { width: 100%; margin-top: 8px; }
.message { margin: 14px 0 0; color: #aaa; font-size: 11px; line-height: 1.5; }
</style>
