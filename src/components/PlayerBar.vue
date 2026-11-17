<template>
    <aside class="audio-player" aria-label="Audio player">
        <audio
            ref="audioRef"
            crossorigin="anonymous"
            preload="metadata"
            @loadedmetadata="onMetadata"
            @timeupdate="onTime"
            @ended="onEnded"
            @play="playing = true"
            @pause="playing = false"
            @error="onAudioError"
        ></audio>

        <div class="player-line">
            <div class="current-track">
                <router-link v-if="currentTrack?.releaseSlug" :to="`/releases/${currentTrack.releaseSlug}`">
                    <strong>{{ currentTrack?.name || 'Select a release' }}</strong>
                    <span>{{ currentTrack?.artist || '' }}</span>
                </router-link>
                <template v-else>
                    <strong>{{ currentTrack?.name || 'Select a release' }}</strong>
                    <span>{{ currentTrack?.artist || '' }}</span>
                </template>
            </div>
            <div class="transport">
                <button type="button" aria-label="Previous track" :disabled="!currentTrack" @click="previous">←</button>
                <button type="button" :aria-label="playing ? 'Pause' : 'Play'" :disabled="!currentTrack" @click="toggle">{{ playing ? 'Ⅱ' : '▶' }}</button>
                <button type="button" aria-label="Next track" :disabled="!currentTrack" @click="next">→</button>
            </div>
        </div>

        <div class="seek-line">
            <span>{{ formatTime(currentTime) }}</span>
            <input type="range" min="0" max="1000" :value="progress" :disabled="!duration" aria-label="Track position" @input="seek" />
            <span>{{ formatTime(duration) }}</span>
        </div>

        <div class="player-line lower-line">
            <button type="button" :aria-expanded="showEffects" aria-controls="player-effects" @click="showEffects = !showEffects">
                Sound settings {{ showEffects ? '−' : '+' }}
            </button>
            <label for="player-volume" class="volume-label">
                Volume <input id="player-volume" v-model.number="volume" type="range" min="0" max="100" @input="updateVolume" />
            </label>
        </div>

        <div v-show="showEffects" id="player-effects" class="player-effects">
            <label>Bass <output>{{ bass }} dB</output><input v-model.number="bass" type="range" min="-12" max="12" @input="updateEffects" /></label>
            <label>Treble <output>{{ treble }} dB</output><input v-model.number="treble" type="range" min="-12" max="12" @input="updateEffects" /></label>
            <label>Pan <output>{{ pan < 0 ? `L ${-pan}` : pan > 0 ? `R ${pan}` : 'Center' }}</output><input v-model.number="pan" type="range" min="-100" max="100" @input="updateEffects" /></label>
            <label>Echo <output>{{ echo }}%</output><input v-model.number="echo" type="range" min="0" max="70" @input="updateEffects" /></label>
            <label>Speed <output>{{ (speed / 100).toFixed(2) }}×</output><input v-model.number="speed" type="range" min="50" max="150" @input="updateEffects" /></label>
            <button class="reset-button" type="button" @click="resetEffects">Reset</button>
        </div>
        <p v-if="audioError" class="player-error" role="status">{{ audioError }}</p>
    </aside>
</template>

<script>
import { computed, nextTick, onMounted, ref, watch, onBeforeUnmount } from 'vue';
import { useStore } from 'vuex';

export default {
    name: 'PlayerBar',
    setup() {
        const store = useStore();
        const currentTrack = computed(() => store.getters.currentTrack);
        const audioRef = ref(null);
        const playing = ref(false);
        const showEffects = ref(false);
        const currentTime = ref(0);
        const duration = ref(0);
        const volume = ref(80);
        const bass = ref(0);
        const treble = ref(0);
        const pan = ref(0);
        const echo = ref(0);
        const speed = ref(100);
        const audioError = ref('');
        let audioContext = null;
        let graph = null;

        function formatTime(value) {
            if (!Number.isFinite(value)) return '0:00';
            return `${Math.floor(value / 60)}:${String(Math.floor(value % 60)).padStart(2, '0')}`;
        }
        const progress = computed(() => duration.value ? Math.round(currentTime.value / duration.value * 1000) : 0);
        function onMetadata() { duration.value = audioRef.value?.duration || 0; }
        function onTime() { currentTime.value = audioRef.value?.currentTime || 0; }
        function onAudioError() {
            if (currentTrack.value) audioError.value = 'Unable to play this audio file.';
            playing.value = false;
        }
        async function play() {
            if (!currentTrack.value?.url || !audioRef.value) return;
            audioError.value = '';
            try {
                await audioContext?.resume();
                await audioRef.value.play();
                playing.value = true;
            } catch (error) {
                playing.value = false;
                audioError.value = 'Playback was blocked or the audio could not be loaded.';
                console.warn('Audio playback:', error);
            }
        }
        function toggle() {
            if (!audioRef.value || !currentTrack.value) return;
            if (audioRef.value.paused) play();
            else audioRef.value.pause();
        }
        function previous() { store.dispatch('playPreviousTrack'); }
        function next() { store.dispatch('playNextTrack'); }
        function onEnded() {
            if (store.state.currentTrackIndex < store.state.playlist.length - 1) next();
            else playing.value = false;
        }
        function seek(event) {
            if (!audioRef.value || !duration.value) return;
            const position = Number(event.target.value) / 1000;
            audioRef.value.currentTime = position * duration.value;
            currentTime.value = audioRef.value.currentTime;
        }
        function updateVolume() {
            if (audioRef.value) audioRef.value.volume = volume.value / 100;
        }
        function ensureAudioGraph() {
            if (graph || !audioRef.value) return;
            const Context = window.AudioContext || window.webkitAudioContext;
            if (!Context) return;
            try {
                audioContext = new Context();
                const source = audioContext.createMediaElementSource(audioRef.value);
                const bassFilter = audioContext.createBiquadFilter();
                bassFilter.type = 'lowshelf'; bassFilter.frequency.value = 200;
                const trebleFilter = audioContext.createBiquadFilter();
                trebleFilter.type = 'highshelf'; trebleFilter.frequency.value = 3400;
                const stereoPan = audioContext.createStereoPanner();
                const delay = audioContext.createDelay(.8); delay.delayTime.value = .28;
                const feedback = audioContext.createGain(); feedback.gain.value = .25;
                const wet = audioContext.createGain(); wet.gain.value = 0;
                source.connect(bassFilter);
                bassFilter.connect(trebleFilter);
                trebleFilter.connect(stereoPan);
                stereoPan.connect(audioContext.destination);
                trebleFilter.connect(delay);
                delay.connect(feedback);
                feedback.connect(delay);
                delay.connect(wet);
                wet.connect(audioContext.destination);
                graph = { bassFilter, trebleFilter, stereoPan, wet };
                audioContext.resume().catch(() => {});
            } catch (error) {
                // Continue with the native audio path if filters are unavailable.
                console.warn('Web Audio filters unavailable:', error);
            }
        }
        function updateEffects() {
            if (audioRef.value) audioRef.value.playbackRate = speed.value / 100;
            ensureAudioGraph();
            if (graph) {
                graph.bassFilter.gain.value = bass.value;
                graph.trebleFilter.gain.value = treble.value;
                graph.stereoPan.pan.value = pan.value / 100;
                graph.wet.gain.value = echo.value / 100;
            }
        }
        function resetEffects() {
            bass.value = 0; treble.value = 0; pan.value = 0;
            echo.value = 0; speed.value = 100;
            updateEffects();
        }
        onMounted(() => { updateVolume(); });
        watch(() => currentTrack.value?.url, async (url) => {
            await nextTick();
            const audio = audioRef.value;
            if (!audio) return;
            audio.pause();
            audioError.value = '';
            duration.value = 0;
            currentTime.value = 0;
            if (!url) { audio.removeAttribute('src'); audio.load(); return; }
            audio.src = url;
            audio.load();
            updateVolume();
            audio.playbackRate = speed.value / 100;
            await play();
        }, { immediate: true, flush: 'post' });
        onBeforeUnmount(() => {
            audioRef.value?.pause();
            audioContext?.close().catch(() => {});
        });
        return {
            currentTrack, audioRef, playing, showEffects, currentTime, duration, volume,
            bass, treble, pan, echo, speed, audioError, progress, formatTime,
            onMetadata, onTime, onAudioError, onEnded, seek, toggle, previous, next,
            updateVolume, updateEffects, resetEffects,
        };
    },
};
</script>

<style scoped>
.audio-player {
    position: fixed; z-index: 40; left: 4vh; bottom: 4vh; width: min(350px, calc(100vw - 8vh));
    max-height: min(60dvh, 430px); overflow-y: auto; background: #000; color: #fff;
    padding: 16px 0 0; border-top: 1px solid #fff; letter-spacing: -1px;
}
.player-line { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.current-track { min-width: 0; flex: 1; display: flex; flex-direction: column; font-size: 18px; line-height: 1.15; }
.current-track strong, .current-track span { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.current-track strong { font-weight: 700; }
.current-track span { font-weight: 400; margin-top: 3px; }
.transport { display: flex; align-items: center; gap: 12px; flex: none; }
.transport button { font-size: 19px; line-height: 1; letter-spacing: 0; }
.transport button:disabled { opacity: .55; cursor: default; }
.seek-line { display: flex; align-items: center; width: 100%; gap: 9px; margin: 15px 0 11px; font-size: 12px; letter-spacing: -.5px; }
.seek-line input { flex: 1; min-width: 0; }
.lower-line { font-size: 14px; letter-spacing: -.7px; }
.volume-label { display: flex; align-items: center; gap: 9px; white-space: nowrap; }
.volume-label input { width: 65px; }
.player-effects { border-top: 1px solid #555; margin-top: 15px; padding-top: 13px; display: grid; grid-template-columns: 1fr 1fr; gap: 14px 16px; font-size: 14px; letter-spacing: -.6px; }
.player-effects label { display: flex; flex-direction: column; gap: 9px; min-width: 0; }
.player-effects output { font-size: 12px; color: #aaa; }
.player-effects input { width: 100%; }
.reset-button { text-align: left; align-self: end; }
.player-error { font-size: 12px; letter-spacing: -.5px; color: #aaa; margin: 9px 0 0; }
input[type='range'] { appearance: none; -webkit-appearance: none; background: #fff; height: 1px; cursor: pointer; border: 0; border-radius: 0; display: block; }
input[type='range']::-webkit-slider-thumb { appearance: none; width: 9px; height: 9px; background: #fff; border-radius: 50%; }
input[type='range']::-moz-range-thumb { width: 9px; height: 9px; background: #fff; border: 0; border-radius: 50%; }
@media (max-width: 768px) {
    .audio-player { left: 20px; bottom: 20px; width: min(340px, calc(100vw - 165px)); padding-top: 13px; }
    .current-track { font-size: 14px; }
    .transport { gap: 7px; }
    .transport button { font-size: 15px; }
    .lower-line { flex-wrap: wrap; gap: 8px; font-size: 12px; }
    .seek-line { font-size: 10px; }
}
@media (max-width: 420px) {
    .audio-player { left: 12px; bottom: 14px; width: calc(100vw - 150px); }
    .transport { gap: 5px; }
    .current-track { font-size: 12px; }
    .transport button { font-size: 14px; }
    .volume-label input { width: 47px; }
}
</style>
