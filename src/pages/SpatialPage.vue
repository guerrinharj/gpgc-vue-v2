<template>
    <main class="spatial-page" :aria-label="sectionLabel">
        <section
            ref="scene"
            class="spatial-scene"
            :aria-label="`Explore ${sectionLabel}`"
            @wheel.prevent="onWheel"
            @touchstart.passive="onTouchStart"
            @touchmove.prevent="onTouchMove"
            @touchend="touchY = null"
            @pointermove="onPointerMove"
            @pointerleave="pointerX = 0; pointerY = 0"
        >
            <div ref="space" class="spatial-space">
                <button
                    v-for="(entry, index) in records"
                    :key="`${section}-${entry.id ?? entry.slug ?? index}`"
                    class="spatial-release"
                    type="button"
                    :aria-label="`Open ${entry.name}${subtitle(entry) ? ' — ' + subtitle(entry) : ''}`"
                    @click="openEntry(entry)"
                >
                    <strong>{{ entry.name }}</strong>
                    <span v-if="subtitle(entry)">{{ subtitle(entry) }}</span>
                </button>
            </div>
        </section>

        <div class="spatial-arrows" aria-label="Navigate catalog">
            <button type="button" aria-label="Older entry" @click="moveSingle(1)">↑</button>
            <button type="button" aria-label="Newer entry" @click="moveSingle(-1)">↓</button>
        </div>

        <div v-if="!loading && !records.length" class="spatial-empty" role="status">
            <p>Nothing to display in {{ sectionLabel }}.</p>
            <button type="button" @click="fetchSection">Retry</button>
        </div>

        <EntryModal
            v-if="modalEntry"
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
import { computed, nextTick, onMounted, onBeforeUnmount, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useStore } from 'vuex';
import EntryModal from '@/components/EntryModal.vue';

const ABOUT = { id: 'about', name: 'About' };
const POSITIONS = [
    [.0, 0], [-.055, .032], [.05, -.028], [.016, .072],
    [-.022, -.064], [.075, .015], [-.07, .008],
];
const SECTIONS = {
    releases: { key: 'releases', action: 'fetchReleases', label: 'Releases' },
    artists: { key: 'artists', action: 'fetchArtists', label: 'Artists' },
    featurings: { key: 'featurings', action: 'fetchFeaturings', label: 'Featurings' },
    soundtracks: { key: 'soundtracks', action: 'fetchSoundtracks', label: 'Soundtracks' },
    about: { key: null, action: null, label: 'About' },
};
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

export default {
    name: 'SpatialPage',
    components: { EntryModal },
    props: {
        section: { type: String, required: true },
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
        const sectionLabel = computed(() => SECTIONS[props.section]?.label || 'Releases');
        const records = computed(() => {
            if (props.section === 'about') return [ABOUT];
            const values = store.state[SECTIONS[props.section]?.key];
            return Array.isArray(values) ? values : [];
        });
        const subtitle = entry => {
            if (props.section === 'releases') return entry.artist_name || entry.artist || '';
            if (props.section === 'featurings') return entry.artist || entry.artist_name || '';
            if (props.section === 'soundtracks') return entry.company || '';
            return '';
        };

        let current = 0;
        let destination = 0;
        let pointerX = 0;
        let pointerY = 0;
        let lastFrame = 0;
        let requestId = 0;
        let wheelTotal = 0;
        let lastWheel = 0;
        let detailRequest = 0;
        const touchY = ref(null);

        function move(position) {
            if (modalEntry.value) return;
            destination = clamp(position, 0, Math.max(0, records.value.length - 1));
        }
        function moveSingle(direction) { move(Math.round(destination) + direction); }
        function onWheel(event) {
            if (modalEntry.value || !records.value.length) return;
            wheelTotal += event.deltaY;
            const now = performance.now();
            if (Math.abs(wheelTotal) > 45 && now - lastWheel > 250) {
                // Up = older; down = newer, including releases from the same year.
                moveSingle(wheelTotal < 0 ? 1 : -1);
                wheelTotal = 0;
                lastWheel = now;
            }
        }
        function onTouchStart(event) { touchY.value = event.touches[0]?.clientY ?? null; }
        function onTouchMove(event) {
            if (touchY.value == null || modalEntry.value) return;
            const next = event.touches[0]?.clientY;
            if (next == null) return;
            if (Math.abs(next - touchY.value) > 75) {
                moveSingle(next < touchY.value ? 1 : -1);
                touchY.value = next;
            }
        }
        function onPointerMove(event) {
            if (!scene.value || event.pointerType === 'touch') return;
            const box = scene.value.getBoundingClientRect();
            pointerX = ((event.clientX - box.left) / box.width - .5) * 2;
            pointerY = ((event.clientY - box.top) / box.height - .5) * 2;
        }
        function onKeyDown(event) {
            if (modalEntry.value || /^(INPUT|TEXTAREA|BUTTON|A)$/.test(document.activeElement?.tagName || '')) return;
            if (event.key === 'ArrowUp' || event.key === 'PageUp') {
                event.preventDefault(); moveSingle(1);
            } else if (event.key === 'ArrowDown' || event.key === 'PageDown') {
                event.preventDefault(); moveSingle(-1);
            }
        }
        function animate(time) {
            if (!scene.value || !space.value) return;
            const delta = Math.min(60, time - (lastFrame || time));
            lastFrame = time;
            current += (destination - current) * Math.min(.18, delta * .012);
            if (Math.abs(destination - current) < .0008) current = destination;
            const width = scene.value.clientWidth;
            const height = scene.value.clientHeight;
            const buttons = space.value.children;
            for (let index = 0; index < buttons.length; index += 1) {
                const element = buttons[index];
                const depth = index - current;
                const distance = Math.abs(depth);
                if (distance >= 1.22) {
                    element.style.visibility = 'hidden';
                    element.style.pointerEvents = 'none';
                    element.tabIndex = -1;
                    element.setAttribute('aria-hidden', 'true');
                    continue;
                }
                const opacity = Math.pow(Math.max(0, 1 - distance / 1.22), 2.1);
                const interactive = opacity > .35;
                const p = POSITIONS[index % POSITIONS.length];
                const x = p[0] * Math.min(width, 1000) + Math.sin(time * .00039 + index * .9) * 2.6 + pointerX * 4;
                const y = p[1] * Math.min(height, 750) + Math.sin(time * .00043 + index * 1.7) * 4.5 + pointerY * 3;
                const z = -depth * 390;
                const scale = 1 - Math.min(distance, 1.22) * .12;
                element.style.visibility = 'visible';
                element.style.opacity = opacity.toFixed(4);
                element.style.pointerEvents = interactive ? 'auto' : 'none';
                element.tabIndex = interactive ? 0 : -1;
                element.setAttribute('aria-hidden', interactive ? 'false' : 'true');
                element.style.zIndex = String(1000 - Math.round(distance * 50) - index);
                element.style.transform = `translate(-50%, -50%) translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, ${z.toFixed(1)}px) scale(${scale.toFixed(3)})`;
            }
            requestId = requestAnimationFrame(animate);
        }
        function resetPosition() {
            current = 0;
            destination = 0;
            wheelTotal = 0;
            lastWheel = 0;
        }
        async function fetchSection() {
            const action = SECTIONS[props.section]?.action;
            if (!action) return;
            loading.value = true;
            try { await store.dispatch(action); }
            catch (error) { console.warn('Catalog fetch:', error); }
            finally { loading.value = false; }
        }
        function openEntry(entry) {
            if (props.section === 'about' || !entry.slug) {
                modalEntry.value = entry;
            } else {
                router.push(`/${props.section}/${encodeURIComponent(entry.slug)}`);
            }
        }
        function closeEntry() {
            detailRequest += 1;
            modalEntry.value = null;
            artistReleases.value = [];
            if (route.params.slug) router.push(`/${props.section}`);
        }
        function openLinkedRelease(release) {
            if (!release?.slug) return;
            router.push(`/releases/${encodeURIComponent(release.slug)}`);
        }
        function playTrack({ track, entry }) {
            const tracks = (entry.tracks || []).filter(item => item?.url);
            if (!tracks.length) return;
            const playlist = tracks.map(item => ({
                ...item,
                artist: entry.artist_name || entry.artist || '',
                release: entry.name,
                releaseSlug: entry.slug,
            }));
            const selectedTrack = playlist.find(item => item.url === track.url);
            if (selectedTrack) store.dispatch('playTrack', { track: selectedTrack, playlist });
            closeEntry();
        }
        async function resolveDeepLink() {
            const slug = String(route.params.slug || '');
            const token = ++detailRequest;
            artistReleases.value = [];
            detailsLoading.value = false;
            if (!slug) { modalEntry.value = null; return; }
            const entry = records.value.find(item => String(item.slug) === slug);
            modalEntry.value = entry || null;
            if (props.section === 'releases') {
                if (!entry || !entry.tracks?.length || !entry.cover?.length) {
                    detailsLoading.value = true;
                    await store.dispatch('fetchRelease', slug);
                    const detail = store.state.selectedRelease;
                    if (detailRequest === token && detail?.slug === slug) modalEntry.value = detail;
                    if (detailRequest === token) detailsLoading.value = false;
                }
            } else if (props.section === 'artists') {
                detailsLoading.value = true;
                try {
                    const result = await store.dispatch('fetchArtistReleases', slug);
                    if (detailRequest === token) artistReleases.value = Array.isArray(result) ? result : [];
                } catch (error) { console.warn('Artist releases:', error); }
                finally { if (detailRequest === token) detailsLoading.value = false; }
            }
        }

        watch(() => props.section, async () => {
            detailRequest += 1;
            modalEntry.value = null;
            resetPosition();
            await fetchSection();
            await nextTick();
            resolveDeepLink();
        });
        watch(() => route.params.slug, () => resolveDeepLink());
        watch(records, () => { resetPosition(); nextTick(() => resolveDeepLink()); });

        onMounted(async () => {
            window.addEventListener('keydown', onKeyDown);
            requestId = requestAnimationFrame(animate);
            if (props.section === 'about') resolveDeepLink();
            else await fetchSection();
            resolveDeepLink();
        });
        onBeforeUnmount(() => {
            detailRequest += 1;
            cancelAnimationFrame(requestId);
            window.removeEventListener('keydown', onKeyDown);
        });

        return {
            sectionLabel, records, subtitle, scene, space, loading, modalEntry,
            artistReleases, detailsLoading, touchY, onWheel, onTouchStart,
            onTouchMove, onPointerMove, moveSingle, openEntry, closeEntry,
            openLinkedRelease, playTrack, fetchSection,
        };
    },
};
</script>

<style scoped>
.spatial-page { position: absolute; inset: 0; background: #000; overflow: hidden; }
.spatial-scene {
    position: absolute; inset: 0; perspective: 950px; perspective-origin: 50% 50%;
    background: #000; overflow: hidden; touch-action: none;
}
.spatial-space { position: absolute; inset: 0; transform-style: preserve-3d; }
.spatial-release {
    position: absolute; left: 50%; top: 48.5%; width: min(420px, 72vw);
    min-height: 86px; padding: 1.1rem 1rem; margin: 0;
    transform-origin: center; color: #fff; text-align: center;
    font-size: 24px; line-height: .98; letter-spacing: -2px;
    backface-visibility: hidden; visibility: hidden; opacity: 0; will-change: transform, opacity;
    overflow-wrap: normal; white-space: normal;
}
.spatial-release strong, .spatial-release span { display: block; }
.spatial-release strong { font-weight: 700; }
.spatial-release span { font-weight: 400; margin-top: .08rem; }
.spatial-release:hover strong { text-decoration: underline; }
.spatial-arrows {
    position: absolute; z-index: 10; right: 24px; bottom: 128px;
    display: flex; flex-direction: column; align-items: flex-end; gap: .35rem;
}
.spatial-arrows button { font-size: 18px; font-weight: 400; line-height: 1; letter-spacing: 0; }
.spatial-empty { position: absolute; top: 44%; left: 50%; transform: translate(-50%, -50%); text-align: center; font-size: 18px; letter-spacing: -.7px; }
.spatial-empty p { margin-bottom: 12px; }
.spatial-empty button { text-decoration: underline; }
@media (max-width: 768px) {
    .spatial-release { top: 44%; width: min(340px, 84vw); font-size: 20px; padding: .8rem; }
    .spatial-arrows { right: 16px; bottom: 106px; }
    .spatial-arrows button { font-size: 16px; }
}
@media (prefers-reduced-motion: reduce) {
    .spatial-release { will-change: auto; }
}
</style>
