
<template>
    <main class="spatial-page" :aria-label="sectionLabel">
        <AskGPGC />

        <section
            ref="scene"
            class="spatial-scene"
            :aria-label="`Explore ${sectionLabel}`"
            @wheel.prevent="onWheel"
            @touchstart.passive="onTouchStart"
            @touchmove.prevent="onTouchMove"
            @touchend="touchY = null"
            @pointermove="onPointerMove"
            @pointerleave="onPointerLeave"
        >
            <div ref="space" class="spatial-space">
                <template v-if="section === 'about'">
                    <div
                        v-for="(entry, index) in records"
                        :key="`about-${entry.id ?? index}`"
                        class="spatial-release spatial-paragraph"
                    >
                        <p v-html="entry.html"></p>
                    </div>
                </template>

                <template v-else>
                    <button
                        v-for="(entry, index) in records"
                        :key="`${section}-${entry.id ?? entry.slug ?? index}`"
                        class="spatial-release"
                        type="button"
                        :aria-label="`Open ${entry.name}${subtitle(entry) ? ' — ' + subtitle(entry) : ''}`"
                        @click="openEntry(entry)"
                    >
                        <strong>{{ entry.name }}</strong>

                        <span v-if="subtitle(entry)">
                            {{ subtitle(entry) }}
                        </span>
                    </button>
                </template>
            </div>
        </section>

        <div
            v-if="records.length > 1"
            class="spatial-scrollbar"
            aria-label="Catalog position"
        >
            <input
                class="spatial-scroll-range"
                type="range"
                min="0"
                :max="Math.max(0, records.length - 1)"
                step="0.01"
                :value="scrollPosition"
                aria-label="Move through catalog"
                @input="onScrollInput"
            />

            <span class="spatial-scroll-count">
                {{ Math.min(records.length, Math.round(scrollPosition) + 1) }}
                /
                {{ records.length }}
            </span>
        </div>

        <div
            class="spatial-arrows"
            aria-label="Navigate catalog"
        >
            <button
                type="button"
                aria-label="Older entry"
                @click="moveSingle(1)"
            >
                ↑
            </button>

            <button
                type="button"
                aria-label="Newer entry"
                @click="moveSingle(-1)"
            >
                ↓
            </button>
        </div>

        <div
            v-if="!loading && !records.length"
            class="spatial-empty"
            role="status"
        >
            <p>
                Nothing to display in {{ sectionLabel }}.
            </p>

            <button
                type="button"
                @click="fetchSection"
            >
                Retry
            </button>
        </div>

        <EntryModal
            v-if="section !== 'about' && modalEntry"
            :key="`${section}-${modalEntry.id ?? modalEntry.slug ?? modalEntry.name}`"
            :entry="modalEntry"
            :section="section"
            :artist-releases="artistReleases"
            :details-loading="detailsLoading"
            @close="closeEntry"
            @play-track="playTrack"
            @open-release="openLinkedRelease"
        />
    </main>
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

import {
    useRoute,
    useRouter,
} from 'vue-router';

import {
    useStore,
} from 'vuex';

import EntryModal from '@/components/EntryModal.vue';
import AskGPGC from '@/components/AskGPGC.vue';

const ABOUT_PARAGRAPHS = [
    {
        id: 'intro',
        html: `
            Hi, my name is
            <b>Gabriel Pessoa Guerra Cavalcanti</b>.
            I'm a musician, producer and web developer
            and the purpose of this site is to catalog
            and serve as a streaming player to everything
            I've done related to <b>music</b>.
        `,
    },
    {
        id: 'history',
        html: `
            As the years went by, and I got more and more
            cursed by this abstract entity called
            <b>music</b>, I've made the questionable choice
            to constantly release stuff under different
            groups, pseudonyms, aliases, featurings,
            soundtracks etc., making things harder to
            catalog.
        `,
    },
    {
        id: 'labels',
        html: `
            I've also released under different labels
            such as Future Times, PAN, Superconscious Records,
            2 Headed Deer, Confuso Editions, etc and managed
            labels such as <b>40% Foda/Maneirissimo</b>
            and my own <b>Gpgc Discos</b>.
        `,
    },
    {
        id: 'archive',
        html: `
            To clarify, not everything still exists;
            some files and links just got lost or broken,
            but they are documented here.
        `,
    },
    {
        id: 'technology',
        html: `
            This website was built with <b>Vue</b>,
            powered by a <b>Ruby on Rails API</b>.
            You can check the source code from the front
            <a href="https://github.com/guerrinharj/gpgc-vue"
               target="_blank"
               rel="noopener noreferrer">here</a>
            and the back
            <a href="https://github.com/guerrinharj/gpgc-api"
               target="_blank"
               rel="noopener noreferrer">here</a>.
        `,
    },
];

const POSITIONS = [
    [0, 0],
    [-0.055, 0.032],
    [0.05, -0.028],
    [0.016, 0.072],
    [-0.022, -0.064],
    [0.075, 0.015],
    [-0.07, 0.008],
];

const SECTIONS = {
    releases: {
        key: 'releases',
        action: 'fetchReleases',
        label: 'Releases',
    },
    artists: {
        key: 'artists',
        action: 'fetchArtists',
        label: 'Artists',
    },
    featurings: {
        key: 'featurings',
        action: 'fetchFeaturings',
        label: 'Featurings',
    },
    soundtracks: {
        key: 'soundtracks',
        action: 'fetchSoundtracks',
        label: 'Soundtracks',
    },
    about: {
        key: null,
        action: null,
        label: 'About',
    },
};

const clamp = (value, min, max) => {
    return Math.min(max, Math.max(min, value));
};

const SPATIAL = {
    depthSpacing: 8000,
    exitDepth: 1760,

    zoomStrength: 8,
    zoomExponent: 1.35,
    opacityExponent: 0.7,

    horizontalThrow: 50,
    throwMultiplier: 7,
    incomingSpread: 2.5,

    exitRotation: 16,
    exitTilt: 22,
    exitSkew: 5,

    // Ajustes exclusivos do About.
    about: {
        depthSpacing: 4100,
        exitDepth: 1500,
        zoomStrength: 2.5,
        horizontalThrow: 110,
        throwMultiplier: 3,
        incomingSpread: 0.6,
        exitRotation: 5,
        exitTilt: 7,
        exitSkew: 1,
    },
};

export default {
    name: 'SpatialPage',

    components: {
        EntryModal,
        AskGPGC,
    },

    props: {
        section: {
            type: String,
            required: true,
        },
    },

    setup(props) {
        const store = useStore();
        const route = useRoute();
        const router = useRouter();

        const scene = ref(null);
        const space = ref(null);

        const loading = ref(false);
        const modalEntry = ref(null);
        const artistReleases = ref([]);
        const detailsLoading = ref(false);

        const touchY = ref(null);
        const scrollPosition = ref(0);

        const sectionLabel = computed(() => {
            return SECTIONS[props.section]?.label || 'Releases';
        });

        const records = computed(() => {
            if (props.section === 'about') {
                return ABOUT_PARAGRAPHS;
            }

            const values =
                store.state[SECTIONS[props.section]?.key];

            return Array.isArray(values) ? values : [];
        });

        const subtitle = entry => {
            if (props.section === 'releases') {
                return entry.artist_name || entry.artist || '';
            }

            if (props.section === 'featurings') {
                return entry.artist || entry.artist_name || '';
            }

            if (props.section === 'soundtracks') {
                return entry.company || '';
            }

            return '';
        };

        let current = 0;
        let destination = 0;

        let pointerX = 0;
        let pointerY = 0;

        let lastFrame = 0;
        let requestId = 0;
        let detailRequest = 0;

        const motionReduced = window
            .matchMedia('(prefers-reduced-motion: reduce)')
            .matches;

        const visualSeed = index => {
            const random = value => {
                const x =
                    Math.sin(value * 127.1 + 78.233) *
                    43758.5453;

                return x - Math.floor(x);
            };

            return [
                random(index + 1),
                random(index + 21),
                random(index + 41),
            ];
        };

        function move(position) {
            if (modalEntry.value) {
                return;
            }

            destination = clamp(
                position,
                0,
                Math.max(0, records.value.length - 1)
            );

            scrollPosition.value = destination;
        }

        function moveSingle(direction) {
            move(Math.round(destination) + direction);
        }

        function onScrollInput(event) {
            move(Number(event.target.value));
        }

        function onWheel(event) {
            if (
                modalEntry.value ||
                records.value.length < 2
            ) {
                return;
            }

            const delta =
                event.deltaMode === 1
                    ? event.deltaY * 16
                    : event.deltaMode === 2
                        ? event.deltaY * scene.value.clientHeight
                        : event.deltaY;

            const amount = delta / 240;

            move(destination - amount);
        }

        function onTouchStart(event) {
            touchY.value =
                event.touches[0]?.clientY ?? null;
        }

        function onTouchMove(event) {
            if (
                touchY.value == null ||
                modalEntry.value
            ) {
                return;
            }

            const next = event.touches[0]?.clientY;

            if (next == null) {
                return;
            }

            const difference = next - touchY.value;

            move(destination + difference / 220);

            touchY.value = next;
        }

        function onPointerMove(event) {
            if (
                !scene.value ||
                event.pointerType === 'touch'
            ) {
                return;
            }

            const box = scene.value.getBoundingClientRect();

            pointerX =
                ((event.clientX - box.left) / box.width - 0.5) * 2;

            pointerY =
                ((event.clientY - box.top) / box.height - 0.5) * 2;
        }

        function onPointerLeave() {
            pointerX = 0;
            pointerY = 0;
        }

        function onKeyDown(event) {
            if (
                modalEntry.value ||
                /^(INPUT|TEXTAREA|BUTTON|A)$/.test(
                    document.activeElement?.tagName || ''
                )
            ) {
                return;
            }

            if (
                event.key === 'ArrowUp' ||
                event.key === 'PageUp'
            ) {
                event.preventDefault();
                moveSingle(1);
            } else if (
                event.key === 'ArrowDown' ||
                event.key === 'PageDown'
            ) {
                event.preventDefault();
                moveSingle(-1);
            }
        }

        function animate(time) {
            if (!scene.value || !space.value) {
                return;
            }

            const delta = Math.min(
                60,
                time - (lastFrame || time)
            );

            lastFrame = time;

            current +=
                (destination - current) *
                Math.min(0.18, delta * 0.012);

            if (
                Math.abs(destination - current) < 0.0008
            ) {
                current = destination;
            }

            const width = scene.value.clientWidth;
            const height = scene.value.clientHeight;
            const buttons = space.value.children;

            const isAbout = props.section === 'about';

            const config = isAbout
                ? {
                    ...SPATIAL,
                    ...SPATIAL.about,
                }
                : SPATIAL;

            for (
                let index = 0;
                index < buttons.length;
                index += 1
            ) {
                const element = buttons[index];

                const depth = index - current;
                const distance = Math.abs(depth);

                if (
                    depth < -1.35 ||
                    depth > 1.5
                ) {
                    element.style.visibility = 'hidden';
                    element.style.pointerEvents = 'none';
                    element.tabIndex = -1;

                    element.setAttribute(
                        'aria-hidden',
                        'true'
                    );

                    continue;
                }

                const exitProgress = clamp(
                    -depth / 1.35,
                    0,
                    1
                );

                const enterProgress = clamp(
                    depth / 1.5,
                    0,
                    1
                );

                const side = index % 2 === 0 ? -1 : 1;

                const horizontalDrift = depth < 0
                    ? (
                        side *
                        config.horizontalThrow *
                        Math.pow(exitProgress, 0.9) *
                        config.throwMultiplier
                    )
                    : (
                        -side *
                        config.horizontalThrow *
                        Math.pow(enterProgress, 1.1) *
                        config.incomingSpread
                    );

                const opacity = depth < 0
                    ? Math.pow(
                        1 - exitProgress,
                        config.opacityExponent
                    )
                    : Math.pow(
                        Math.max(0, 1 - enterProgress),
                        2
                    );

                const interactive = isAbout
                    ? opacity > 0.35 &&
                        Math.abs(depth) < 0.38
                    : opacity > 0.35 &&
                        Math.abs(depth) < 0.38;

                const position =
                    POSITIONS[index % POSITIONS.length];

                const seed = visualSeed(index);

                const floatX = motionReduced
                    ? 0
                    : Math.sin(
                        time *
                            (0.00020 + seed[0] * 0.00013) +
                            seed[1] * 6.28
                    ) * (5 + seed[2] * 6);

                const floatY = motionReduced
                    ? 0
                    : Math.cos(
                        time *
                            (0.00023 + seed[1] * 0.00014) +
                            seed[0] * 6.28
                    ) * (7 + seed[2] * 7);

                const x =
                    position[0] * Math.min(width, 1000) +
                    floatX +
                    pointerX * 4 +
                    horizontalDrift;

                const y =
                    position[1] * Math.min(height, 750) +
                    floatY +
                    pointerY * 3;

                const rotationBase = motionReduced
                    ? 0
                    : Math.sin(
                        time * 0.00017 +
                        seed[0] * 6.28
                    ) * (2 + seed[1] * 3);

                const rotation =
                    rotationBase +
                    side *
                    exitProgress *
                    config.exitRotation;

                const tiltBase = motionReduced
                    ? 0
                    : Math.cos(
                        time * 0.00015 +
                        seed[1] * 6.28
                    ) * (2 + seed[2] * 4);

                const tilt =
                    tiltBase +
                    side *
                    exitProgress *
                    config.exitTilt;

                const skewBase = motionReduced
                    ? 0
                    : Math.sin(
                        time * 0.00012 +
                        seed[2] * 6.28
                    ) * (1 + seed[0] * 2);

                const skew =
                    skewBase +
                    side *
                    exitProgress *
                    config.exitSkew;

                const z = depth < 0
                    ? exitProgress * config.exitDepth
                    : -depth * config.depthSpacing;

                const visualScale = depth < 0
                    ? 1 +
                        config.zoomStrength *
                        Math.pow(
                            exitProgress,
                            config.zoomExponent
                        )
                    : 1 -
                        Math.min(distance, 1.5) *
                        0.1;

                // Fonte renderizada em 4x para maior nitidez.
                const renderScale = 0.25;

                const scale =
                    visualScale * renderScale;

                element.style.visibility = 'visible';

                element.style.opacity =
                    opacity.toFixed(4);

                element.style.pointerEvents =
                    interactive ? 'auto' : 'none';

                element.tabIndex =
                    interactive && !isAbout ? 0 : -1;

                element.setAttribute(
                    'aria-hidden',
                    opacity > 0.05 ? 'false' : 'true'
                );

                element.style.zIndex = String(
                    depth < 0
                        ? 2000 +
                            Math.round(exitProgress * 100)
                        : 1000 -
                            Math.round(distance * 50) -
                            index
                );

                element.style.transform = `
                    translate(-50%, -50%)
                    translate3d(
                        ${x.toFixed(1)}px,
                        ${y.toFixed(1)}px,
                        ${z.toFixed(1)}px
                    )
                    scale(${scale.toFixed(3)})
                    rotate(${rotation.toFixed(2)}deg)
                    rotateY(${tilt.toFixed(2)}deg)
                    skewX(${skew.toFixed(2)}deg)
                `;
            }

            requestId = requestAnimationFrame(animate);
        }

        function resetPosition() {
            current = 0;
            destination = 0;
            scrollPosition.value = 0;
        }

        async function fetchSection() {
            const action =
                SECTIONS[props.section]?.action;

            if (!action) {
                return;
            }

            loading.value = true;

            try {
                await store.dispatch(action);
            } catch (error) {
                console.warn('Catalog fetch:', error);
            } finally {
                loading.value = false;
            }
        }

        function openEntry(entry) {
            if (props.section === 'about') {
                return;
            }

            if (!entry.slug) {
                modalEntry.value = entry;
            } else {
                router.push(
                    `/${props.section}/${encodeURIComponent(entry.slug)}`
                );
            }
        }

        function closeEntry() {
            detailRequest += 1;

            modalEntry.value = null;
            artistReleases.value = [];

            if (route.params.slug) {
                router.push(`/${props.section}`);
            }
        }

        function openLinkedRelease(release) {
            if (!release?.slug) {
                return;
            }

            router.push(
                `/releases/${encodeURIComponent(release.slug)}`
            );
        }

        function playTrack({ track, entry }) {
            const tracks = (entry.tracks || [])
                .filter(item => item?.url);

            if (!tracks.length) {
                return;
            }

            const playlist = tracks.map(item => ({
                ...item,
                artist:
                    entry.artist_name ||
                    entry.artist ||
                    '',
                release: entry.name,
                releaseSlug: entry.slug,
            }));

            const selectedTrack = playlist.find(
                item => item.url === track.url
            );

            if (selectedTrack) {
                store.dispatch('playTrack', {
                    track: selectedTrack,
                    playlist,
                });
            }

            closeEntry();
        }

        async function resolveDeepLink() {
            if (props.section === 'about') {
                modalEntry.value = null;
                return;
            }

            const slug = String(route.params.slug || '');
            const token = ++detailRequest;

            artistReleases.value = [];
            detailsLoading.value = false;

            if (!slug) {
                modalEntry.value = null;
                return;
            }

            const entry = records.value.find(
                item => String(item.slug) === slug
            );

            modalEntry.value = entry || null;

            if (props.section === 'releases') {
                if (
                    !entry ||
                    !entry.tracks?.length ||
                    !entry.cover?.length
                ) {
                    detailsLoading.value = true;

                    try {
                        await store.dispatch(
                            'fetchRelease',
                            slug
                        );

                        const detail =
                            store.state.selectedRelease;

                        if (
                            detailRequest === token &&
                            detail?.slug === slug
                        ) {
                            modalEntry.value = detail;
                        }
                    } catch (error) {
                        console.warn(
                            'Release details:',
                            error
                        );
                    } finally {
                        if (detailRequest === token) {
                            detailsLoading.value = false;
                        }
                    }
                }
            } else if (
                props.section === 'artists'
            ) {
                detailsLoading.value = true;

                try {
                    const result = await store.dispatch(
                        'fetchArtistReleases',
                        slug
                    );

                    if (detailRequest === token) {
                        artistReleases.value =
                            Array.isArray(result)
                                ? result
                                : [];
                    }
                } catch (error) {
                    console.warn(
                        'Artist releases:',
                        error
                    );
                } finally {
                    if (detailRequest === token) {
                        detailsLoading.value = false;
                    }
                }
            }
        }

        watch(
            () => props.section,
            async () => {
                detailRequest += 1;
                modalEntry.value = null;

                resetPosition();

                await fetchSection();
                await nextTick();

                resolveDeepLink();
            }
        );

        watch(
            () => route.params.slug,
            () => resolveDeepLink()
        );

        watch(
            records,
            () => {
                resetPosition();

                nextTick(() => {
                    resolveDeepLink();
                });
            }
        );

        onMounted(async () => {
            window.addEventListener(
                'keydown',
                onKeyDown
            );

            requestId = requestAnimationFrame(animate);

            if (props.section !== 'about') {
                await fetchSection();
            }

            resolveDeepLink();
        });

        onBeforeUnmount(() => {
            detailRequest += 1;

            cancelAnimationFrame(requestId);

            window.removeEventListener(
                'keydown',
                onKeyDown
            );
        });

        return {
            sectionLabel,
            records,
            subtitle,
            scene,
            space,
            loading,
            modalEntry,
            artistReleases,
            detailsLoading,
            touchY,
            scrollPosition,
            onWheel,
            onTouchStart,
            onTouchMove,
            onPointerMove,
            onPointerLeave,
            onScrollInput,
            moveSingle,
            openEntry,
            closeEntry,
            openLinkedRelease,
            playTrack,
            fetchSection,
        };
    },
};
</script>

<style scoped>
.spatial-page {
    position: absolute;
    inset: 0;
    background: #000;
    overflow: hidden;
}

.spatial-scene {
    position: absolute;
    inset: 0;
    perspective: 950px;
    perspective-origin: 50% 50%;
    background: #000;
    overflow: hidden;
    touch-action: none;
}

.spatial-space {
    position: absolute;
    inset: 0;
    transform-style: preserve-3d;
}

.spatial-release {
    position: absolute;
    left: 50%;
    top: 48.5%;
    width: max-content;
    max-width: none;
    min-height: 86px;
    padding: 1.1rem 1rem;
    margin: 0;
    transform-origin: center;
    color: #fff;
    text-align: center;
    font-size: 96px;
    line-height: 0.98;
    letter-spacing: -8px;
    white-space: nowrap;
    overflow-wrap: normal;
    word-break: normal;
    backface-visibility: hidden;
    transform-style: preserve-3d;
    -webkit-font-smoothing: antialiased;
    text-rendering: geometricPrecision;
    visibility: hidden;
    opacity: 0;
    will-change: transform, opacity;
}

.spatial-release strong,
.spatial-release span {
    display: block;
}

.spatial-release strong {
    font-weight: 700;
}

.spatial-release span {
    font-weight: 400;
    margin-top: 0.08rem;
}

/* HOVER — TRIÂNGULOS APONTANDO PARA FORA */

.spatial-release:not(.spatial-paragraph) strong {
    position: relative;
    display: inline-block;
    text-decoration: none;
}

.spatial-release:not(.spatial-paragraph) strong::before,
.spatial-release:not(.spatial-paragraph) strong::after {
    content: "";
    position: absolute;
    top: 50%;
    width: 0;
    height: 0;
    opacity: 0;
    pointer-events: none;

    border-top: 0.13em solid transparent;
    border-bottom: 0.13em solid transparent;

    transition:
        opacity 0.2s ease,
        transform 0.2s ease;
}

/* ESQUERDA — APONTA PARA FORA */

.spatial-release strong::before {
    right: calc(100% + 0.3em);
    border-left: 0.2em solid white;
    transform: translate(12px, -50%);
}

/* DIREITA — APONTA PARA FORA */

.spatial-release strong::after {
    left: calc(100% + 0.3em);
    border-right: 0.2em solid white;
    transform: translate(-12px, -50%);
}

/* HOVER */

.spatial-release:hover strong::before,
.spatial-release:hover strong::after,
.spatial-release:focus-visible strong::before,
.spatial-release:focus-visible strong::after {
    opacity: 1;
    transform: translate(0, -50%);
}

@media (prefers-reduced-motion: reduce) {
    .spatial-release strong::before,
    .spatial-release strong::after {
        transition: none;
    }
}

/* ABOUT — PARÁGRAFOS ESPACIAIS */

.spatial-paragraph {
    width: 2600px;
    max-width: none;
    padding: 30px 50px;
    white-space: normal;
    overflow-wrap: normal;
    word-break: normal;
    text-align: left;
    font-size: 76px;
    line-height: 1.38;
    letter-spacing: -3px;
    font-weight: 400;
}

.spatial-paragraph p {
    margin: 0;
}

.spatial-paragraph :deep(b) {
    font-weight: 700;
}

.spatial-paragraph :deep(a) {
    color: inherit;
    pointer-events: auto;
}

/* SCROLLBAR */

.spatial-scrollbar {
    position: absolute;
    z-index: 12;
    right: 55px;
    top: 18%;
    bottom: 23%;
    width: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
}

.spatial-scroll-range {
    position: absolute;
    width: min(43vh, 360px);
    height: 2px;
    transform: rotate(90deg);
    appearance: none;
    -webkit-appearance: none;
    background: #555;
    outline: none;
    cursor: ns-resize;
    accent-color: white;
}

.spatial-scroll-range::-webkit-slider-thumb {
    appearance: none;
    width: 11px;
    height: 11px;
    background: white;
    border-radius: 50%;
}

.spatial-scroll-range::-moz-range-thumb {
    width: 11px;
    height: 11px;
    background: white;
    border: none;
    border-radius: 50%;
}

.spatial-scroll-count {
    position: absolute;
    bottom: -20px;
    font-size: 11px;
    letter-spacing: -0.3px;
    white-space: nowrap;
    color: #999;
    font-variant-numeric: tabular-nums;
}

.spatial-arrows {
    position: absolute;
    z-index: 10;
    right: 24px;
    bottom: 128px;
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 0.35rem;
}

.spatial-arrows button {
    font-size: 18px;
    font-weight: 400;
    line-height: 1;
    letter-spacing: 0;
}

.spatial-empty {
    position: absolute;
    top: 44%;
    left: 50%;
    transform: translate(-50%, -50%);
    text-align: center;
    font-size: 18px;
    letter-spacing: -0.7px;
}

.spatial-empty p {
    margin-bottom: 12px;
}

/* MOBILE */

@media (max-width: 768px) {
    .spatial-release {
        top: 44%;
        width: max-content;
        max-width: none;
        font-size: 80px;
        letter-spacing: -8px;
        padding: 0.8rem;
        white-space: nowrap;
    }

    .spatial-paragraph {
        top: 40%;
        width: min(1280px, 340vw);
        max-width: none;
        padding: 20px 35px;
        font-size: 64px;
        line-height: 1.38;
        letter-spacing: -2.5px;
        white-space: normal;
    }

    .spatial-scrollbar {
        right: 24px;
        top: calc(32px + env(safe-area-inset-top, 0px));
        bottom: auto;
        width: 24px;
        height: 120px;
    }

    .spatial-scroll-range {
        width: 120px;
        height: 2px;
        transform: rotate(90deg);
        transform-origin: center;
    }

    .spatial-scroll-count {
        bottom: -22px;
        font-size: 10px;
        letter-spacing: 0;
    }

    .spatial-arrows {
        right: 20px;
        top: calc(192px + env(safe-area-inset-top, 0px));
        bottom: auto;
        gap: 8px;
    }

    .spatial-arrows button {
        font-size: 16px;
    }
}

@media (prefers-reduced-motion: reduce) {
    .spatial-release {
        will-change: auto;
    }
}
</style>
