<template>
    <aside class="audio-player" aria-label="Audio player">
        <audio
            ref="audioRef"
            crossorigin="anonymous"
            preload="metadata"
            @loadedmetadata="onMetadata"
            @timeupdate="onTime"
            @ended="onEnded"
            @play="onAudioPlay"
            @pause="onAudioPause"
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
                <button
            type="button"
            class="shuffle-button"
                    :class="{ active: radioMode }"
                    :aria-pressed="radioMode"
                    :disabled="shuffleLoading"
                    :title="radioMode ? 'Restart shuffle' : 'Shuffle tracks from 2018 onward'"
            aria-label="Shuffle tracks from 2018 onward"
                    @click="startShuffle"
                >⤨</button>
            </div>
        </div>
        <p
            v-if="shuffleLoading"
            class="shuffle-status"
            role="status"
        >
            Loading shuffle…
        </p>
        <p
            v-if="shuffleError"
            class="player-error"
            role="status"
        >
            {{ shuffleError }}
        </p>
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
        <div class="tools-bar">
            <button
            type="button"
            class="tools-toggle"
                :aria-expanded="showAudioTools"
            aria-controls="audio-tools-panel"
                @click="toggleAudioTools"
            >
                <span class="tools-icon">☷</span>
                <span>Audio Tools</span>
                <span class="tools-chevron">
                    {{ showAudioTools ? '⌃' : '⌄' }}
                </span>
            </button>
            <label for="player-volume" class="volume-label">
                <span>Volume</span>
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
v-show="showAudioTools"
            id="audio-tools-panel"
            class="audio-tools-panel"
        >
            <div
            class="tool-tabs"
            role="group"
            aria-label="Audio tools"
            >
                <button
            type="button"
            class="tool-tab"
                    :class="{ active: activeTool === 'sound' }"
                    :aria-pressed="activeTool === 'sound'"
            aria-controls="player-effects"
                    @click="toggleTool('sound')"
                >
                    <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="1.6"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true"
                    >
                        <line x1="4" y1="7" x2="20" y2="7" />
                        <line x1="4" y1="17" x2="20" y2="17" />
                        <circle cx="9" cy="7" r="2.5" fill="currentColor" stroke="none" />
                        <circle cx="16" cy="17" r="2.5" fill="currentColor" stroke="none" />
                    </svg>
                    <span>Sound</span>
                </button>
                <button
            type="button"
            class="tool-tab"
                    :class="{ active: activeTool === 'stems' }"
                    :aria-pressed="activeTool === 'stems'"
            aria-controls="player-stems"
                    @click="toggleTool('stems')"
                >
                    <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="1.6"
            stroke-linecap="round"
            aria-hidden="true"
                    >
                        <line x1="4" y1="10" x2="4" y2="14" />
                        <line x1="8" y1="5" x2="8" y2="19" />
                        <line x1="12" y1="2" x2="12" y2="22" />
                        <line x1="16" y1="6" x2="16" y2="18" />
                        <line x1="20" y1="9" x2="20" y2="15" />
                    </svg>
                    <span>Stems</span>
                </button>
                <button
            type="button"
            class="tool-tab"
                    :class="{ active: activeTool === 'looper' }"
                    :aria-pressed="activeTool === 'looper'"
            aria-controls="player-looper"
                    @click="toggleTool('looper')"
                >
                    <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="1.6"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true"
                    >
                        <path d="M17 2l4 4-4 4" />
                        <path d="M3 11V9a3 3 0 0 1 3-3h15" />
                        <path d="M7 22l-4-4 4-4" />
                        <path d="M21 13v2a3 3 0 0 1-3 3H3" />
                    </svg>
                    <span>Looper</span>
                </button>
                <button
            type="button"
            class="tool-tab"
                    :class="{ active: activeTool === 'recorder' }"
                    :aria-pressed="activeTool === 'recorder'"
            aria-controls="player-recorder"
                    @click="toggleTool('recorder')"
                >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true">
                        <circle cx="12" cy="12" r="7" />
                        <circle cx="12" cy="12" r="3" fill="currentColor" stroke="none" />
                    </svg>
                    <span>Record</span>
                </button>
            </div>
            <div
v-show="activeTool === 'sound'"
            id="player-effects"
            class="tool-content"
            >
                <div class="tool-heading">
                    <strong>Sound Settings</strong>
                    <button
            type="button"
            class="heading-action"
                        @click="resetEffects"
                    >
                        Reset
                    </button>
                </div>
                <div class="player-effects">
                    <label>
                        <span class="control-heading">
                            <span>Bass</span>
                            <output>{{ bass }} dB</output>
                        </span>
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
                        <span class="control-heading">
                            <span>Treble</span>
                            <output>{{ treble }} dB</output>
                        </span>
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
                        <span class="control-heading">
                            <span>Pan</span>
                            <output>
                                {{
                                    pan < 0
                                        ? `L ${-pan}`
                                        : pan > 0
                                            ? `R ${pan}`
                                            : 'Center'
                                }}
                            </output>
                        </span>
                        <input
            v-model.number="pan"
            type="range"
            min="-100"
            max="100"
                            :style="rangeStyle(pan, -100, 100)"
                            @input="updateEffects"
                        />
                    </label>
                    <div class="echo-controls">
                        <div class="echo-header">
                            <strong>Echo</strong>
                            <span>DELAY</span>
                        </div>
                        <label>
                            <span class="control-heading">
                                <span>Dry / Wet</span>
                                <output>{{ echo }}%</output>
                            </span>
                            <input
                                v-model.number="echo"
                                type="range"
                                min="0"
                                max="70"
                                :style="rangeStyle(echo, 0, 70)"
                                aria-label="Echo dry wet"
                                @input="updateEffects"
                            />
                        </label>
                        <label>
                            <span class="control-heading">
                                <span>Time</span>
                                <output>{{ echoTime }} ms</output>
                            </span>
                            <input
                                v-model.number="echoTime"
                                type="range"
                                min="50"
                                max="1500"
                                step="10"
                                :style="rangeStyle(echoTime, 50, 1500)"
                                aria-label="Echo delay time"
                                @input="updateEffects"
                            />
                        </label>
                        <label>
                            <span class="control-heading">
                                <span>Feedback</span>
                                <output>{{ echoFeedback }}%</output>
                            </span>
                            <input
                                v-model.number="echoFeedback"
                                type="range"
                                min="0"
                                max="85"
                                :style="rangeStyle(echoFeedback, 0, 85)"
                                aria-label="Echo feedback"
                                @input="updateEffects"
                            />
                        </label>
                    </div>
                </div>
                <div class="vinyl-section">
                    <div class="vinyl-header">
                        <strong>Speed / Pitch</strong>
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
                            <span>Playback speed</span>
                            <output>{{ playbackRate.toFixed(2) }}×</output>
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
                            <span>PITCH</span>
                            <strong>{{ pitchLabel }}</strong>
                        </div>
                        <div>
                            <span>BPM</span>
                            <strong>{{ bpmLabel }}</strong>
                        </div>
                    </div>
                    <p class="vinyl-description">
                        {{
                            vinylMode
                                ? 'Speed and pitch move together, like a turntable.'
                                : 'Pitch correction is available for normal playback when supported. Reverse and Ping-Pong use vinyl-style speed.'
                        }}
                    </p>
                </div>
            </div>
            <div
v-show="activeTool === 'stems'"
            id="player-stems"
            class="tool-content"
            >
                <div class="tool-heading">
                    <strong>Stem Separation</strong>
                </div>
                <p class="tool-description">
                    Separate individual elements of the current track.
                </p>
                <StemSeparator
                    v-if="activeTool === 'stems' && currentTrack?.url"
                    :key="currentTrack.url"
                    :source-url="currentTrack.url"
                    :track-name="currentTrack.name || 'track'"
                    :speed="speed"
                    :vinyl-mode="vinylMode"
                />
                <p v-else class="tool-empty">
                    Select a track to use Stem Separation.
                </p>
            </div>
            <div
v-show="activeTool === 'looper'"
            id="player-looper"
            class="tool-content looper-content"
            >
                <TheLooper
            ref="looperRef"
                    :audio-element="audioRef"
                    :source-url="currentTrack?.url || ''"
                    :track-name="currentTrack?.name || 'track'"
                    :duration="duration"
                    :current-time="currentTime"
                    :audio-context="audioContext"
                    :connect-loop-source="connectLoopSource"
                    :playback-rate="playbackRate"
                    :original-bpm="originalBpm"
                    @loop-change="onLoopChange"
                    @loop-playing="onLoopPlaying"
                    @loop-time="onLoopTime"
                />
            </div>
            <div
v-show="activeTool === 'recorder'"
            id="player-recorder"
            class="tool-content recorder-content"
            >
                <ThePerformanceRecorder
                    :audio-context="audioContext"
                    :recording-stream="recordingStream"
                    :track-name="currentTrack?.name || 'performance'"
                    :bpm="originalBpm ? originalBpm * playbackRate : null"
                />
            </div>
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
    onBeforeUnmount,
    ref,
    watch,
    } from 'vue';
        import { useStore } from 'vuex';
        import StemSeparator from './StemSeparator.vue';
        import TheLooper from './TheLooper.vue';
        import ThePerformanceRecorder from './ThePerformanceRecorder.vue';
        import { detectBpmFromUrl } from '@/utils/detect-bpm';
        export default {
    name: 'PlayerBar',
    components: {
        StemSeparator,
        TheLooper,
        ThePerformanceRecorder,
    },
    setup() {
        const store = useStore();
        const currentTrack = computed(() => {
            return store.getters.currentTrack;
        });
        const radioMode = computed(() => {
            return store.state.radioMode;
        });
        const shuffleLoading = ref(false);
        const shuffleError = ref('');
        const audioRef = ref(null);
        const looperRef = ref(null);
        const playing = ref(false);
        const loopActive = ref(false);
        const loopPlaying = ref(false);
        const showAudioTools = ref(false);
        const activeTool = ref(null);
        const currentTime = ref(0);
        const duration = ref(0);
        const volume = ref(80);
        const bass = ref(0);
        const treble = ref(0);
        const pan = ref(0);
        const echo = ref(0);
        const echoTime = ref(280);
        const echoFeedback = ref(25);
        const speed = ref(100);
        const vinylMode = ref(true);
        const originalBpm = ref(null);
        const bpmLoading = ref(false);
        const audioError = ref('');
        const audioContext = ref(null);
        const recordingStream = ref(null);
        let graph = null;
        let bpmRequestId = 0;
        let trackRequestId = 0;
        function toggleAudioTools() {
            showAudioTools.value = !showAudioTools.value;
            if (!showAudioTools.value) {
                activeTool.value = null;
            }
        }
        function toggleTool(tool) {
            activeTool.value = activeTool.value === tool
                ? null
                : tool;
        }
        function onLoopChange(active) {
            loopActive.value = active;
            if (!active) {
                loopPlaying.value = false;
                playing.value = !audioRef.value?.paused;
                currentTime.value = audioRef.value?.currentTime || 0;
            }
        }
        function onLoopPlaying(active) {
            loopPlaying.value = active;
            playing.value = active;
        }
        function onLoopTime(time) {
            if (loopActive.value) {
                currentTime.value = time;
            }
        }
        function stopActiveLoop() {
            looperRef.value?.stopLoop();
            loopActive.value = false;
            loopPlaying.value = false;
        }
        async function startShuffle() {
            if (shuffleLoading.value) {
                return;
            }
            stopActiveLoop();
            shuffleLoading.value = true;
            shuffleError.value = '';
            try {
                const started = await store.dispatch('startRadio');
                if (!started) {
                    shuffleError.value =
                        store.state.error ||
                        'No tracks found from 2018 onward.';
                }
            } catch (error) {
                console.error('Shuffle error:', error);
                shuffleError.value = 'Unable to start shuffle.';
            } finally {
                shuffleLoading.value = false;
            }
        }
        const playbackRate = computed(() => {
            return speed.value / 100;
        });
        const pitchSemitones = computed(() => {
            const processed = loopActive.value &&
                audioRef.value?.paused;
            return (vinylMode.value || processed)
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
            return `${Math.round(
                originalBpm.value * playbackRate.value
            )} BPM`;
        });
        function rangeStyle(value, min, max) {
            const percent = Math.max(
                0,
                Math.min(
                    100,
                    (value - min) / (max - min) * 100
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
            return `${Math.floor(value / 60)}:${String(
                Math.floor(value % 60)
            ).padStart(2, '0')}`;
        }
        const progress = computed(() => {
            return duration.value
                ? Math.round(currentTime.value / duration.value * 1000)
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
            const value = audioRef.value?.duration;
            duration.value =
                Number.isFinite(value) && value > 0
                    ? value
                    : 0;
        }
        function onTime() {
            if (loopActive.value && audioRef.value?.paused) {
                return;
            }
            currentTime.value = audioRef.value?.currentTime || 0;
        }
        function onAudioPlay() {
            if (!loopActive.value || !audioRef.value?.paused) {
                playing.value = true;
            }
        }
        function onAudioPause() {
            if (!loopPlaying.value) {
                playing.value = false;
            }
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
            if (loopActive.value) {
                await looperRef.value?.resumeLoop();
                return;
            }
            audioError.value = '';
            try {
                await audioContext.value?.resume();
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
            if (loopActive.value) {
                if (loopPlaying.value) {
                    looperRef.value?.pauseLoop();
                } else {
                    void looperRef.value?.resumeLoop();
                }
                return;
            }
            if (audioRef.value.paused) {
                void play();
            } else {
                audioRef.value.pause();
            }
        }
        function previous() {
            stopActiveLoop();
            store.dispatch('playPreviousTrack');
        }
        function next() {
            stopActiveLoop();
            store.dispatch('playNextTrack');
        }
        function onEnded() {
            if (loopActive.value) {
                return;
            }
            if (
                store.state.radioMode ||
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
            const time = position * duration.value;
            if (loopActive.value) {
                const handled = looperRef.value?.seekLoop(time);
                if (handled) {
                    return;
                }
            }
            audioRef.value.currentTime = time;
            currentTime.value = time;
        }
        function updateVolume() {
            if (audioRef.value) {
                audioRef.value.volume = volume.value / 100;
            }
            if (graph) {
                graph.masterGain.gain.value = volume.value / 100;
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
            looperRef.value?.updateLoopRate();
        }
        function setVinylMode(enabled) {
            vinylMode.value = enabled;
            applyPlaybackRate();
        }
        function ensureAudioGraph() {
            if (graph) {
                return graph;
            }
            if (!audioRef.value) {
                return null;
            }
            const Context =
                window.AudioContext ||
                window.webkitAudioContext;
            if (!Context) {
                return null;
            }
            try {
                const context = new Context();
                audioContext.value = context;
                const mediaSource =
                    context.createMediaElementSource(audioRef.value);
                const bassFilter = context.createBiquadFilter();
                bassFilter.type = 'lowshelf';
                bassFilter.frequency.value = 200;
                const trebleFilter = context.createBiquadFilter();
                trebleFilter.type = 'highshelf';
                trebleFilter.frequency.value = 3400;
                const stereoPan = context.createStereoPanner();
                const delay = context.createDelay(1.5);
                delay.delayTime.value = echoTime.value / 1000;
                const feedback = context.createGain();
                feedback.gain.value = echoFeedback.value / 100;
                const wet = context.createGain();
                wet.gain.value = 0;
                const masterGain = context.createGain();
                masterGain.gain.value = volume.value / 100;
                // Both normal playback and processed loops enter here.
                const input = context.createGain();
                input.connect(bassFilter);
                bassFilter.connect(trebleFilter);
                trebleFilter.connect(stereoPan);
                stereoPan.connect(masterGain);
                trebleFilter.connect(delay);
                delay.connect(feedback);
                feedback.connect(delay);
                delay.connect(wet);
                wet.connect(masterGain);
                masterGain.connect(context.destination);
                const recorderDestination = context.createMediaStreamDestination();
                masterGain.connect(recorderDestination);
                recordingStream.value = recorderDestination.stream;
                mediaSource.connect(input);
                graph = {
                    input,
                    mediaSource,
                    bassFilter,
                    trebleFilter,
                    stereoPan,
                    wet,
                    delay,
                    feedback,
                    masterGain,
                };
                // The graph handles volume for both audio sources.
                // Keep the media element at unity gain to avoid
                // applying volume twice.
                audioRef.value.volume = 1;
                context.resume().catch(() => {});
                return graph;
            } catch (error) {
                console.warn(
                    'Web Audio filters unavailable:',
                    error
                );
                return null;
            }
        }
        function connectLoopSource(source) {
            const currentGraph = ensureAudioGraph();
            if (!currentGraph) {
                throw new Error('Audio graph unavailable.');
            }
            source.connect(currentGraph.input);
        }
        function updateEffects() {
            applyPlaybackRate();
            ensureAudioGraph();
            if (graph) {
                graph.bassFilter.gain.value = bass.value;
                graph.trebleFilter.gain.value = treble.value;
                graph.stereoPan.pan.value = pan.value / 100;
                graph.wet.gain.setTargetAtTime(
                    echo.value / 100,
                    graph.wet.context.currentTime,
                    0.01
                );
                graph.delay.delayTime.setTargetAtTime(
                    echoTime.value / 1000,
                    graph.delay.context.currentTime,
                    0.01
                );
                graph.feedback.gain.setTargetAtTime(
                    echoFeedback.value / 100,
                    graph.feedback.context.currentTime,
                    0.01
                );
            }
        }
        function resetEffects() {
            bass.value = 0;
            treble.value = 0;
            pan.value = 0;
            echo.value = 0;
            echoTime.value = 280;
            echoFeedback.value = 25;
            speed.value = 100;
            vinylMode.value = true;
            updateEffects();
        }
        onMounted(() => {
            ensureAudioGraph();
            updateEffects();
            updateVolume();
            applyPlaybackRate();
        });
        watch(
            () => currentTrack.value?.url,
            async url => {
                const requestId = ++trackRequestId;
                stopActiveLoop();
                analyzeBpm(url);
                await nextTick();
                if (requestId !== trackRequestId) {
                    return;
                }
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
            trackRequestId++;
            bpmRequestId++;
            stopActiveLoop();
            audioRef.value?.pause();
            audioContext.value?.close().catch(() => {});
        });
        return {
            currentTrack,
            radioMode,
            shuffleLoading,
            shuffleError,
            startShuffle,
            audioRef,
            looperRef,
            audioContext,
            recordingStream,
            originalBpm,
            playing,
            showAudioTools,
            activeTool,
            loopActive,
            toggleAudioTools,
            toggleTool,
            onLoopChange,
            onLoopPlaying,
            onLoopTime,
            connectLoopSource,
            currentTime,
            duration,
            volume,
            bass,
            treble,
            pan,
            echo,
            echoTime,
            echoFeedback,
            speed,
            vinylMode,
            playbackRate,
            audioError,
            progress,
            pitchLabel,
            bpmLabel,
            rangeStyle,
            formatTime,
            onMetadata,
            onTime,
            onAudioPlay,
            onAudioPause,
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
    max-height: min(75dvh, 650px);
    overflow-y: auto;
    background: #000;
    color: #fff;
    border: 1px solid #fff;
    letter-spacing: -1px;
    padding: 20px;
    scrollbar-width: thin;
    scrollbar-color: #555 #000;
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
.shuffle-button.active {
    text-decoration: underline;
    text-underline-offset: 5px;
}
.shuffle-status {
    margin: 10px 0 0;
    font-size: 12px;
    color: #aaa;
    letter-spacing: -0.5px;
}
.seek-line {
    display: flex;
    align-items: center;
    width: 100%;
    gap: 9px;
    margin: 15px 0 14px;
    font-size: 12px;
    letter-spacing: -0.5px;
}
.seek-line input {
    flex: 1;
    min-width: 0;
}
.tools-bar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    min-height: 28px;
}
.tools-toggle {
    display: flex;
    align-items: center;
    gap: 7px;
    min-width: 0;
    font-size: 13px;
    font-weight: 500;
    letter-spacing: -0.5px;
    white-space: nowrap;
    cursor: pointer;
}
.tools-icon {
    font-size: 18px;
    line-height: 1;
    letter-spacing: 0;
}
.tools-chevron {
    margin-left: 1px;
    font-size: 15px;
    color: #aaa;
    letter-spacing: 0;
}
.volume-label {
    display: flex;
    align-items: center;
    gap: 9px;
    white-space: nowrap;
    font-size: 12px;
    letter-spacing: -0.5px;
}
.volume-label input {
    width: 65px;
}
.audio-tools-panel {
    border-top: 1px solid #444;
    margin-top: 17px;
    padding-top: 14px;
}
.tool-tabs {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 6px;
}
.tool-tab {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 8px;
    min-width: 0;
    min-height: 67px;
    padding: 11px 5px;
    background: #222;
    border: 1px solid transparent;
    color: #bbb;
    font-size: 11px;
    font-weight: 500;
    letter-spacing: -0.2px;
    cursor: pointer;
    transition:
background 150ms ease,
        color 150ms ease;
}
.tool-tab svg {
    width: 19px;
    height: 19px;
    flex: none;
}
.tool-tab:hover:not(.active) {
    background: #303030;
    color: #fff;
}
.tool-tab.active {
    background: #fff;
    color: #000;
}
.tool-content {
    padding-top: 22px;
}
.tool-heading {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    margin-bottom: 20px;
}
.tool-heading strong {
    font-size: 14px;
    font-weight: 600;
    letter-spacing: -0.5px;
}
.heading-action {
    color: #aaa;
    font-size: 12px;
    text-decoration: underline;
    text-underline-offset: 3px;
}
.tool-description {
    margin: -7px 0 18px;
    color: #999;
    font-size: 11px;
    line-height: 1.5;
    letter-spacing: 0;
}
.tool-empty {
    color: #999;
    font-size: 12px;
    line-height: 1.5;
}
.player-effects {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 23px 16px;
    font-size: 13px;
    letter-spacing: -0.5px;
}
.player-effects label {
    display: flex;
    flex-direction: column;
    gap: 13px;
    min-width: 0;
}
.control-heading {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 5px;
}
.player-effects output {
    font-size: 11px;
    color: #aaa;
    white-space: nowrap;
}
.player-effects input {
    width: 100%;
}
.echo-controls {
    grid-column: 1 / -1;
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 22px 16px;
    padding-top: 18px;
    border-top: 1px solid rgba(255, 255, 255, 0.2);
}
.echo-header {
    grid-column: 1 / -1;
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: -4px;
}
.echo-header strong {
    font-size: 13px;
    font-weight: 600;
}
.echo-header > span {
    font-size: 10px;
    color: #888;
    letter-spacing: 0.4px;
}
.echo-controls label:first-of-type {
    grid-column: 1 / -1;
}
.vinyl-section {
    border-top: 1px solid rgba(255, 255, 255, 0.2);
    padding-top: 20px;
    margin-top: 27px;
}
.vinyl-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    font-size: 13px;
    margin-bottom: 15px;
}
.vinyl-header strong {
    font-weight: 600;
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
    font-size: 13px;
}
.speed-heading {
    display: flex;
    justify-content: space-between;
    align-items: center;
}
.speed-heading output {
    color: #fff;
    font-size: 13px;
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
    margin-top: 22px;
}
.pitch-readout > div {
    display: flex;
    flex-direction: column;
    gap: 7px;
    background: #202020;
    padding: 13px;
    min-width: 0;
}
.pitch-readout span {
    font-size: 10px;
    color: #999;
    letter-spacing: 0.3px;
}
.pitch-readout strong {
    font-size: 19px;
    font-weight: 400;
    letter-spacing: -0.8px;
    font-variant-numeric: tabular-nums;
}
.vinyl-description {
    margin: 17px 0 0;
    font-size: 11px;
    line-height: 1.5;
    color: #888;
    letter-spacing: -0.2px;
}
.looper-content {
    padding-top: 3px;
}
.looper-content :deep(.looper) {
    border-top: 0;
    padding-top: 18px;
    margin-top: 0;
}
.player-error {
    font-size: 12px;
    letter-spacing: -0.5px;
    color: #aaa;
    margin: 9px 0 0;
}
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
@media (max-width: 768px) {
.audio-player {
        left: 20px;
        bottom: 20px;
        width: min(340px, calc(100vw - 165px));
        max-height: 75dvh;
        padding: 13px;
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
.tools-bar {
        flex-wrap: wrap;
        gap: 10px;
    }
.seek-line {
        font-size: 10px;
    }
.tool-tab {
        min-height: 58px;
        font-size: 10px;
    }
.tool-tab svg {
        width: 17px;
        height: 17px;
    }
.player-effects {
        gap: 20px 10px;
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
        padding: 11px;
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
.tool-tabs {
        gap: 4px;
    }
.tool-tab {
        min-height: 52px;
        padding: 8px 2px;
        font-size: 9px;
        gap: 6px;
    }
.tool-tab svg {
        width: 16px;
        height: 16px;
    }
.player-effects {
        grid-template-columns: 1fr;
    }
.mode-switch button {
        font-size: 10px;
        padding: 9px 4px;
    }
.pitch-readout {
        gap: 8px;
    }
.pitch-readout > div {
        padding: 9px;
    }
.pitch-readout strong {
        font-size: 15px;
    }
}
@media (prefers-reduced-motion: reduce) {
.mode-switch button,
.tool-tab {
        transition: none;
    }
}
</style>
