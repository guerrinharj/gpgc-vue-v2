
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
                <router-link
                    v-if="currentTrack?.releaseSlug"
                    :to="`/releases/${currentTrack.releaseSlug}`"
                >
                    <strong>{{ currentTrack?.name || 'Select a release' }}</strong>
                    <span>{{ currentTrack?.artist || '' }}</span>
                </router-link>

                <template v-else>
                    <strong>{{ currentTrack?.name || 'Select a release' }}</strong>
                    <span>{{ currentTrack?.artist || '' }}</span>
                </template>
            </div>

            <div class="transport">
                <button
                    type="button"
                    aria-label="Previous track"
                    :disabled="!currentTrack"
                    @click="previous"
                >←</button>

                <button
                    type="button"
                    :aria-label="playing ? 'Pause' : 'Play'"
                    :disabled="!currentTrack"
                    @click="toggle"
                >{{ playing ? 'Ⅱ' : '▶' }}</button>

                <button
                    type="button"
                    aria-label="Next track"
                    :disabled="!currentTrack"
                    @click="next"
                >→</button>
            </div>
        </div>

        <div class="seek-line">
            <span>{{ formatTime(currentTime) }}</span>

            <input
                type="range"
                min="0"
                max="1000"
                :value="progress"
                :disabled="!duration"
                :style="rangeStyle(progress, 0, 1000)"
                aria-label="Track position"
                @input="seek"
            />

            <span>{{ formatTime(duration) }}</span>
        </div>

        <div class="player-line lower-line">
            <button
                type="button"
                :aria-expanded="showEffects"
                aria-controls="player-effects"
                @click="showEffects = !showEffects"
            >
                Sound settings {{ showEffects ? '−' : '+' }}
            </button>

            <label for="player-volume" class="volume-label">
                Volume

                <input
                    id="player-volume"
                    v-model.number="volume"
                    type="range"
                    min="0"
                    max="100"
                    :style="rangeStyle(volume, 0, 100)"
                    @input="updateVolume"
                />
            </label>
        </div>

        <div
            v-show="showEffects"
            id="player-effects"
            class="player-effects"
        >
            <label>
                Bass
                <output>{{ bass }} dB</output>

                <input
                    v-model.number="bass"
                    type="range"
                    min="-12"
                    max="12"
                    :style="rangeStyle(bass, -12, 12)"
                    @input="updateEffects"
                />
            </label>

            <label>
                Treble
                <output>{{ treble }} dB</output>

                <input
                    v-model.number="treble"
                    type="range"
                    min="-12"
                    max="12"
                    :style="rangeStyle(treble, -12, 12)"
                    @input="updateEffects"
                />
            </label>

            <label>
                Pan

                <output>
                    {{ pan < 0 ? `L ${-pan}` : pan > 0 ? `R ${pan}` : 'Center' }}
                </output>

                <input
                    v-model.number="pan"
                    type="range"
                    min="-100"
                    max="100"
                    :style="rangeStyle(pan, -100, 100)"
                    @input="updateEffects"
                />
            </label>

            <label>
                Echo
                <output>{{ echo }}%</output>

                <input
                    v-model.number="echo"
                    type="range"
                    min="0"
                    max="70"
                    :style="rangeStyle(echo, 0, 70)"
                    @input="updateEffects"
                />
            </label>

            <div class="vinyl-section">
                <div class="vinyl-header">
                    <span>Speed / Pitch</span>

                    <span class="vinyl-mode">
                        {{ vinylMode ? 'VINYL' : 'INDEPENDENT' }}
                    </span>
                </div>

                <div class="mode-switch">
                    <button
                        type="button"
                        :class="{ active: !vinylMode }"
                        :aria-pressed="!vinylMode"
                        @click="setVinylMode(false)"
                    >
                        Independent
                    </button>

                    <button
                        type="button"
                        :class="{ active: vinylMode }"
                        :aria-pressed="vinylMode"
                        @click="setVinylMode(true)"
                    >
                        Vinyl
                    </button>
                </div>

                <label class="speed-control">
                    <span class="speed-heading">
                        <span>Speed</span>

                        <output>
                            {{ (speed / 100).toFixed(2) }}×
                        </output>
                    </span>

                    <input
                        v-model.number="speed"
                        type="range"
                        min="50"
                        max="150"
                        step="1"
                        aria-label="Playback speed"
                        :style="rangeStyle(speed, 50, 150)"
                        @input="updateEffects"
                    />
                </label>

                <div class="speed-markers">
                    <span>0.50×</span>
                    <span>1.00×</span>
                    <span>1.50×</span>
                </div>

                <div class="pitch-readout">
                    <div>
                        <span>Pitch</span>
                        <strong>{{ pitchLabel }}</strong>
                    </div>

                    <div>
                        <span>BPM</span>
                        <strong>{{ bpmLabel }}</strong>
                    </div>
                </div>

                <p class="vinyl-description">
                    {{ vinylMode
                        ? 'Speed and pitch move together, like a turntable.'
                        : 'Speed changes while pitch correction remains enabled when supported.'
                    }}
                </p>
            </div>

            <StemSeparator
                v-if="showEffects && currentTrack?.url"
                :key="currentTrack.url"
                :source-url="currentTrack.url"
                :track-name="currentTrack.name || 'track'"
                :speed="speed"
                :vinyl-mode="vinylMode"
            />

            <button
                class="reset-button"
                type="button"
                @click="resetEffects"
            >
                Reset
            </button>
        </div>

        <p
            v-if="audioError"
            class="player-error"
            role="status"
        >
            {{ audioError }}
        </p>
    </aside>
</template>

<script>
import {
    computed,
    nextTick,
    onMounted,
    ref,
    watch,
    onBeforeUnmount,
} from 'vue';

import {
    useStore,
} from 'vuex';

import StemSeparator from './StemSeparator.vue';

import { detectBpmFromUrl } from '@/utils/detect-bpm';

export default {
    name: 'PlayerBar',

    components: {
        StemSeparator,
    },

    setup() {
        const store = useStore();

        const currentTrack = computed(() => {
            return store.getters.currentTrack;
        });

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
        const vinylMode = ref(true);
        const originalBpm = ref(null);
        const bpmLoading = ref(false);

        let bpmRequestId = 0;

        const audioError = ref('');

        let audioContext = null;
        let graph = null;

        const playbackRate = computed(() => {
            return speed.value / 100;
        });

        const pitchSemitones = computed(() => {
            return vinylMode.value
                ? 12 * Math.log2(playbackRate.value)
                : 0;
        });

        const pitchLabel = computed(() => {
            const value = pitchSemitones.value;

            return `${value > 0 ? '+' : ''}${value.toFixed(2)} st`;
        });

        const bpmLabel = computed(() => {
            if (bpmLoading.value) {
                return 'Detecting…';
            }

            if (!originalBpm.value) {
                return '—';
            }

            const adjustedBpm = originalBpm.value * playbackRate.value;

            return `${Math.round(adjustedBpm)} BPM`;
        });

        function rangeStyle(value, min, max) {
            const percent = Math.max(
                0,
                Math.min(
                    100,
                    ((value - min) / (max - min)) * 100
                )
            );

            return {
                '--range-progress': `${percent}%`,
            };
        }

        function formatTime(value) {
            if (!Number.isFinite(value)) {
                return '0:00';
            }

            return `${Math.floor(value / 60)}:${String(Math.floor(value % 60)).padStart(2, '0')}`;
        }

        const progress = computed(() => {
            return duration.value
                ? Math.round(
                    currentTime.value / duration.value * 1000
                )
                : 0;
        });

        async function analyzeBpm(url) {
            const requestId = ++bpmRequestId;

            originalBpm.value = null;
            bpmLoading.value = Boolean(url);

            if (!url) {
                return;
            }

            try {
                const detected = await detectBpmFromUrl(url);

                if (requestId !== bpmRequestId) {
                    return;
                }

                originalBpm.value = detected;
            } catch (error) {
                if (requestId !== bpmRequestId) {
                    return;
                }

                console.warn('BPM detection failed:', error);

                originalBpm.value = null;
            } finally {
                if (requestId === bpmRequestId) {
                    bpmLoading.value = false;
                }
            }
        }

        function onMetadata() {
            duration.value = audioRef.value?.duration || 0;
        }

        function onTime() {
            currentTime.value = audioRef.value?.currentTime || 0;
        }

        function onAudioError() {
            if (currentTrack.value) {
                audioError.value = 'Unable to play this audio file.';
            }

            playing.value = false;
        }

        async function play() {
            if (!currentTrack.value?.url || !audioRef.value) {
                return;
            }

            audioError.value = '';

            try {
                await audioContext?.resume();
                await audioRef.value.play();

                playing.value = true;
            } catch (error) {
                playing.value = false;

                audioError.value =
                    'Playback was blocked or the audio could not be loaded.';

                console.warn('Audio playback:', error);
            }
        }

        function toggle() {
            if (!audioRef.value || !currentTrack.value) {
                return;
            }

            if (audioRef.value.paused) {
                play();
            } else {
                audioRef.value.pause();
            }
        }

        function previous() {
            store.dispatch('playPreviousTrack');
        }

        function next() {
            store.dispatch('playNextTrack');
        }

        function onEnded() {
            if (
                store.state.currentTrackIndex <
                store.state.playlist.length - 1
            ) {
                next();
            } else {
                playing.value = false;
            }
        }

        function seek(event) {
            if (!audioRef.value || !duration.value) {
                return;
            }

            const position = Number(event.target.value) / 1000;

            audioRef.value.currentTime = position * duration.value;
            currentTime.value = audioRef.value.currentTime;
        }

        function updateVolume() {
            if (audioRef.value) {
                audioRef.value.volume = volume.value / 100;
            }
        }

        function applyPlaybackRate() {
            const audio = audioRef.value;

            if (!audio) {
                return;
            }

            const preserve = !vinylMode.value;

            if ('preservesPitch' in audio) {
                audio.preservesPitch = preserve;
            }

            if ('mozPreservesPitch' in audio) {
                audio.mozPreservesPitch = preserve;
            }

            if ('webkitPreservesPitch' in audio) {
                audio.webkitPreservesPitch = preserve;
            }

            audio.playbackRate = playbackRate.value;
        }

        function setVinylMode(enabled) {
            vinylMode.value = enabled;
            applyPlaybackRate();
        }

        function ensureAudioGraph() {
            if (graph || !audioRef.value) {
                return;
            }

            const Context =
                window.AudioContext ||
                window.webkitAudioContext;

            if (!Context) {
                return;
            }

            try {
                audioContext = new Context();

                const source =
                    audioContext.createMediaElementSource(
                        audioRef.value
                    );

                const bassFilter =
                    audioContext.createBiquadFilter();

                bassFilter.type = 'lowshelf';
                bassFilter.frequency.value = 200;

                const trebleFilter =
                    audioContext.createBiquadFilter();

                trebleFilter.type = 'highshelf';
                trebleFilter.frequency.value = 3400;

                const stereoPan =
                    audioContext.createStereoPanner();

                const delay =
                    audioContext.createDelay(0.8);

                delay.delayTime.value = 0.28;

                const feedback =
                    audioContext.createGain();

                feedback.gain.value = 0.25;

                const wet =
                    audioContext.createGain();

                wet.gain.value = 0;

                source.connect(bassFilter);
                bassFilter.connect(trebleFilter);
                trebleFilter.connect(stereoPan);
                stereoPan.connect(audioContext.destination);

                trebleFilter.connect(delay);
                delay.connect(feedback);
                feedback.connect(delay);
                delay.connect(wet);
                wet.connect(audioContext.destination);

                graph = {
                    bassFilter,
                    trebleFilter,
                    stereoPan,
                    wet,
                };

                audioContext.resume().catch(() => {});
            } catch (error) {
                console.warn(
                    'Web Audio filters unavailable:',
                    error
                );
            }
        }

        function updateEffects() {
            applyPlaybackRate();
            ensureAudioGraph();

            if (graph) {
                graph.bassFilter.gain.value = bass.value;
                graph.trebleFilter.gain.value = treble.value;
                graph.stereoPan.pan.value = pan.value / 100;
                graph.wet.gain.value = echo.value / 100;
            }
        }

        function resetEffects() {
            bass.value = 0;
            treble.value = 0;
            pan.value = 0;
            echo.value = 0;
            speed.value = 100;
            vinylMode.value = true;

            updateEffects();
        }

        onMounted(() => {
            updateVolume();
            applyPlaybackRate();
        });

            watch(
                () => currentTrack.value?.url,
                async url => {
                    analyzeBpm(url);

                    await nextTick();

                    const audio = audioRef.value;

                if (!audio) {
                    return;
                }

                audio.pause();

                audioError.value = '';
                duration.value = 0;
                currentTime.value = 0;

                if (!url) {
                    audio.removeAttribute('src');
                    audio.load();
                    return;
                }

                audio.src = url;
                audio.load();

                updateVolume();
                applyPlaybackRate();

                await play();
            },
            {
                immediate: true,
                flush: 'post',
            }
        );

        onBeforeUnmount(() => {
            audioRef.value?.pause();

            audioContext?.close().catch(() => {});
        });

        return {
            currentTrack,
            audioRef,
            playing,
            showEffects,
            currentTime,
            duration,
            volume,
            bass,
            treble,
            pan,
            echo,
            speed,
            vinylMode,
            audioError,
            progress,
            pitchLabel,
            bpmLabel,
            rangeStyle,
            formatTime,
            onMetadata,
            onTime,
            onAudioError,
            onEnded,
            seek,
            toggle,
            previous,
            next,
            updateVolume,
            updateEffects,
            resetEffects,
            setVinylMode,
        };
    },
};
</script>

<style scoped>
.audio-player {
    position: fixed;
    z-index: 40;
    left: 4vh;
    bottom: 4vh;
    width: min(350px, calc(100vw - 8vh));
    max-height: min(60dvh, 430px);
    overflow-y: auto;
    background: #000;
    color: #fff;
    border: 1px solid white;
    letter-spacing: -1px;
    padding: 20px;
}

.player-line {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
}

.current-track {
    min-width: 0;
    flex: 1;
    display: flex;
    flex-direction: column;
    font-size: 18px;
    line-height: 1.15;
}

.current-track strong,
.current-track span {
    display: block;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.current-track strong {
    font-weight: 700;
}

.current-track span {
    font-weight: 400;
    margin-top: 3px;
}

.transport {
    display: flex;
    align-items: center;
    gap: 12px;
    flex: none;
}

.transport button {
    font-size: 19px;
    line-height: 1;
    letter-spacing: 0;
}

.transport button:disabled {
    opacity: 0.55;
    cursor: default;
}

.seek-line {
    display: flex;
    align-items: center;
    width: 100%;
    gap: 9px;
    margin: 15px 0 11px;
    font-size: 12px;
    letter-spacing: -0.5px;
}

.seek-line input {
    flex: 1;
    min-width: 0;
}

.lower-line {
    font-size: 14px;
    letter-spacing: -0.7px;
}

.volume-label {
    display: flex;
    align-items: center;
    gap: 9px;
    white-space: nowrap;
}

.volume-label input {
    width: 65px;
}

.player-effects {
    border-top: 1px solid #555;
    margin-top: 15px;
    padding-top: 13px;
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 14px 16px;
    font-size: 14px;
    letter-spacing: -0.6px;
}

.player-effects label {
    display: flex;
    flex-direction: column;
    gap: 9px;
    min-width: 0;
}

.player-effects output {
    font-size: 12px;
    color: #aaa;
}

.player-effects input {
    width: 100%;
}

/* VINYL SPEED / PITCH */

.vinyl-section {
    grid-column: 1 / -1;
    border-top: 1px solid rgba(255, 255, 255, 0.2);
    padding-top: 17px;
    margin-top: 4px;
}

.vinyl-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    font-size: 14px;
    font-weight: 600;
    margin-bottom: 14px;
}

.vinyl-mode {
    font-size: 10px;
    font-weight: 400;
    letter-spacing: 0.5px;
    color: #aaa;
}

.mode-switch {
    display: grid;
    grid-template-columns: 1fr 1fr;
    border: 1px solid rgba(255, 255, 255, 0.3);
    margin-bottom: 22px;
}

.mode-switch button {
    padding: 10px 8px;
    font-size: 12px;
    text-align: center;
    transition:
        background 180ms ease,
        color 180ms ease;
}

.mode-switch button + button {
    border-left: 1px solid rgba(255, 255, 255, 0.3);
}

.mode-switch button.active {
    background: #fff;
    color: #000;
}

.speed-control {
    display: flex;
    flex-direction: column;
    gap: 13px;
}

.speed-heading {
    display: flex;
    justify-content: space-between;
    align-items: center;
}

.speed-heading output {
    color: #fff;
    font-size: 14px;
}

.speed-markers {
    display: flex;
    justify-content: space-between;
    font-size: 10px;
    color: #888;
    letter-spacing: 0;
    margin-top: 9px;
}

.pitch-readout {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
    margin-top: 20px;
}

.pitch-readout > div {
    display: flex;
    flex-direction: column;
    gap: 7px;
    border-top: 1px solid rgba(255, 255, 255, 0.15);
    padding-top: 12px;
}

.pitch-readout span {
    font-size: 11px;
    color: #999;
    letter-spacing: -0.2px;
}

.pitch-readout strong {
    font-size: 20px;
    font-weight: 400;
    letter-spacing: -0.8px;
    font-variant-numeric: tabular-nums;
}

.vinyl-description {
    margin: 15px 0 0;
    font-size: 11px;
    line-height: 1.5;
    color: #888;
    letter-spacing: -0.2px;
}

.reset-button {
    grid-column: 1 / -1;
    text-align: left;
    justify-self: start;
    margin-top: 4px;
    font-size: 13px;
    text-decoration: underline;
    text-underline-offset: 3px;
}

.player-error {
    font-size: 12px;
    letter-spacing: -0.5px;
    color: #aaa;
    margin: 9px 0 0;
}

/* RANGE INPUTS */

input[type='range'] {
    appearance: none;
    -webkit-appearance: none;

    width: 100%;
    height: 2px;
    padding: 0;

    border: 0;
    border-radius: 0;

    background: linear-gradient(
        to right,
        #fff 0%,
        #fff var(--range-progress, 50%),
        #444 var(--range-progress, 50%),
        #444 100%
    );

    cursor: pointer;
}

input[type='range']::-webkit-slider-runnable-track {
    appearance: none;
    -webkit-appearance: none;
    height: 2px;
    background: transparent;
    border: 0;
}

input[type='range']::-webkit-slider-thumb {
    appearance: none;
    -webkit-appearance: none;

    width: 10px;
    height: 10px;
    margin-top: -4px;

    background: #fff;
    border: 0;
    border-radius: 50%;
}

input[type='range']::-moz-range-track {
    height: 2px;
    background: #444;
    border: 0;
}

input[type='range']::-moz-range-progress {
    height: 2px;
    background: #fff;
}

input[type='range']::-moz-range-thumb {
    width: 10px;
    height: 10px;
    background: #fff;
    border: 0;
    border-radius: 50%;
}

input[type='range']:disabled {
    opacity: 0.35;
    cursor: default;
}

button:focus-visible,
input:focus-visible {
    outline: 1px solid #fff;
    outline-offset: 4px;
}

/* MOBILE */

@media (max-width: 768px) {
    .audio-player {
        left: 20px;
        bottom: 20px;
        width: min(340px, calc(100vw - 165px));
        padding-top: 13px;
    }

    .current-track {
        font-size: 14px;
    }

    .transport {
        gap: 7px;
    }

    .transport button {
        font-size: 15px;
    }

    .lower-line {
        flex-wrap: wrap;
        gap: 8px;
        font-size: 12px;
    }

    .seek-line {
        font-size: 10px;
    }

    .pitch-readout strong {
        font-size: 17px;
    }
}

@media (max-width: 420px) {
    .audio-player {
        left: 12px;
        bottom: 14px;
        width: calc(100vw - 150px);
    }

    .transport {
        gap: 5px;
    }

    .current-track {
        font-size: 12px;
    }

    .transport button {
        font-size: 14px;
    }

    .volume-label input {
        width: 47px;
    }

    .mode-switch button {
        font-size: 10px;
        padding: 9px 4px;
    }

    .pitch-readout {
        gap: 8px;
    }

    .pitch-readout strong {
        font-size: 15px;
    }
}

@media (prefers-reduced-motion: reduce) {
    .mode-switch button {
        transition: none;
    }
}
</style>
