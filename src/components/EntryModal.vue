
<template>
    <div
        class="entry-overlay"
        role="presentation"
        @click.self="$emit('close')"
    >
        <section
            ref="dialog"
            class="entry-dialog"
            :class="{ 'release-dialog': section === 'releases' }"
            role="dialog"
            aria-modal="true"
            aria-labelledby="entry-heading"
            tabindex="-1"
        >
            <button
                class="entry-close"
                type="button"
                aria-label="Close"
                @click="$emit('close')"
            >
                ×
            </button>

            <template v-if="section === 'releases'">
                <div
                    class="entry-layout"
                    :class="{ 'no-cover': !covers.length }"
                >
                    <div
                        v-if="covers.length"
                        class="entry-cover-column"
                    >
                        <div class="entry-cover">
                            <img
                                :src="covers[coverIndex]"
                                :alt="`${entry.name} cover`"
                            />
                        </div>

                        <div
                            v-if="covers.length > 1"
                            class="cover-controls"
                        >
                            <button
                                type="button"
                                aria-label="Previous cover"
                                @click="changeCover(-1)"
                            >
                                ←
                            </button>

                            <span>
                                {{ coverIndex + 1 }} / {{ covers.length }}
                            </span>

                            <button
                                type="button"
                                aria-label="Next cover"
                                @click="changeCover(1)"
                            >
                                →
                            </button>
                        </div>

                        <div class="cover-links">
                            <button
                                v-if="playableTracks.length"
                                type="button"
                                @click="play(playableTracks[0])"
                            >
                                Play
                            </button>

                            <a
                                v-if="validUrl(entry.download_link)"
                                :href="entry.download_link"
                                target="_blank"
                                rel="noopener noreferrer"
                            >
                                Download
                            </a>
                        </div>
                    </div>

                    <div class="entry-content">
                        <h1 id="entry-heading">
                            {{ entry.name }}
                        </h1>

                        <h2>{{ entry.artist_name }}</h2>

                        <div
                            v-if="tracks.length"
                            class="entry-tracks"
                        >
                            <button
                                v-for="(track, index) in tracks"
                                :key="track.id ?? index"
                                type="button"
                                :disabled="!validUrl(track.url)"
                                @click="play(track)"
                            >
                                {{ index + 1 }}.
                                <b>
                                    {{ track.name || track.title || 'Untitled' }}
                                </b>
                            </button>
                        </div>

                        <p
                            v-else-if="detailsLoading"
                            class="entry-muted"
                        >
                            Loading tracks…
                        </p>

                        <p
                            v-else
                            class="entry-muted"
                        >
                            Tracklist unavailable.
                        </p>

                        <div class="entry-meta">
                            <p v-if="entry.release_type">
                                <b>Type:</b>
                                {{ entry.release_type }}
                            </p>

                            <p v-if="entry.release_date">
                                <b>Release date:</b>
                                {{ entry.release_date }}
                            </p>

                            <p v-if="entry.label">
                                <b>Label:</b>
                                {{ asText(entry.label) }}
                            </p>

                            <p v-if="entry.format">
                                <b>Format:</b>
                                {{ asText(entry.format) }}
                            </p>

                            <p
                                v-for="(note, index) in notes"
                                :key="index"
                            >
                                {{ note }}
                            </p>

                            <p
                                v-for="([credit, person], index) in credits"
                                :key="index"
                            >
                                <b>{{ credit }}:</b>
                                {{ asText(person) }}
                            </p>

                            <p
                                v-for="([platform, link], index) in links"
                                :key="index"
                            >
                                <a
                                    :href="link"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                >
                                    {{ platform }}
                                </a>
                            </p>

                            <p
                                v-if="isAuthenticated && entry.slug"
                            >
                                <router-link
                                    :to="`/update-release/${entry.slug}`"
                                >
                                    Edit release
                                </router-link>
                            </p>
                        </div>
                    </div>
                </div>
            </template>

            <template v-else-if="section === 'artists'">
                <h1 id="entry-heading">
                    {{ entry.name }}
                </h1>

                <h2>
                    {{ entry.group ? 'Group' : 'Solo' }}
                </h2>

                <p
                    v-if="detailsLoading"
                    class="entry-muted"
                >
                    Loading releases…
                </p>

                <div v-else class="entry-list">
                    <button
                        v-for="release in sortedArtistReleases"
                        :key="release.id ?? release.slug"
                        type="button"
                        @click="$emit('open-release', release)"
                    >
                        <strong>{{ release.name }}</strong>

                        <span v-if="release.release_type">
                            {{ release.release_type }}
                        </span>
                    </button>

                    <p
                        v-if="!sortedArtistReleases.length"
                        class="entry-muted"
                    >
                        No releases listed.
                    </p>
                </div>

                <p
                    v-if="isAuthenticated && entry.slug"
                    class="entry-admin"
                >
                    <router-link
                        :to="`/update-artist/${entry.slug}`"
                    >
                        Edit artist
                    </router-link>
                </p>
            </template>

            <template v-else-if="section === 'featurings'">
                <h1 id="entry-heading">
                    {{ entry.name }}
                </h1>

                <h2>{{ entry.artist }}</h2>

                <div class="entry-meta">
                    <p v-if="entry.credit">
                        <b>Credit:</b>
                        {{ asText(entry.credit) }}
                    </p>

                    <p v-if="entry.release_date">
                        <b>Release date:</b>
                        {{ entry.release_date }}
                    </p>

                    <p v-if="validUrl(entry.url)">
                        <a
                            :href="entry.url"
                            target="_blank"
                            rel="noopener noreferrer"
                        >
                            Open release
                        </a>
                    </p>

                    <p v-if="isAuthenticated && entry.slug">
                        <router-link
                            :to="`/update-featuring/${entry.slug}`"
                        >
                            Edit featuring
                        </router-link>
                    </p>
                </div>
            </template>

            <template v-else-if="section === 'soundtracks'">
                <h1 id="entry-heading">
                    {{ entry.name }}
                </h1>

                <h2>{{ entry.company }}</h2>

                <div class="entry-meta">
                    <p v-if="entry.year">
                        <b>Year:</b>
                        {{ entry.year }}
                    </p>

                    <p v-if="validUrl(entry.url)">
                        <a
                            :href="entry.url"
                            target="_blank"
                            rel="noopener noreferrer"
                        >
                            Open soundtrack
                        </a>
                    </p>

                    <p v-if="isAuthenticated && entry.slug">
                        <router-link
                            :to="`/update-soundtrack/${entry.slug}`"
                        >
                            Edit soundtrack
                        </router-link>
                    </p>
                </div>
            </template>

            <template v-else>
                <h1 id="entry-heading">About</h1>

                <div class="about-copy">
                    <p>
                        Hi, my name is
                        <b>Gabriel Pessoa Guerra Cavalcanti</b>.
                        I'm a musician, producer and web developer
                        and the purpose of this site is to catalog
                        and serve as a streaming player to everything
                        I've done related to <b>music</b>.
                    </p>

                    <p>
                        As the years went by, and I got more and more
                        cursed by this abstract entity called
                        <b>music</b>, I've made the questionable choice
                        to constantly release stuff under different
                        groups, pseudonyms, aliases, featurings,
                        soundtracks etc., making things harder to
                        catalog. I've also released under different
                        labels such as Future Times, PAN,
                        Superconscious Records, 2 Headed Deer,
                        Confuso Editions, etc and managed labels
                        such as <b>40% Foda/Maneirissimo</b>
                        and my own <b>Gpgc Discos</b>.
                    </p>

                    <p>
                        To clarify, not everything still exists;
                        some files and links just got lost or broken,
                        but they are documented here.
                    </p>

                    <p>
                        This website was built with <b>Vue</b>,
                        powered by a <b>Ruby on Rails API</b>.
                        You can check the source code from the front
                        <a
                            href="https://github.com/guerrinharj/gpgc-vue"
                            target="_blank"
                            rel="noopener noreferrer"
                        >here</a>
                        and the back
                        <a
                            href="https://github.com/guerrinharj/gpgc-api"
                            target="_blank"
                            rel="noopener noreferrer"
                        >here</a>.
                    </p>
                </div>
            </template>
        </section>
    </div>
</template>

<script>
import {
    computed,
    nextTick,
    onMounted,
    onBeforeUnmount,
    ref,
} from 'vue';

import {
    useStore,
} from 'vuex';

export default {
    name: 'EntryModal',

    props: {
        entry: {
            type: Object,
            required: true,
        },

        section: {
            type: String,
            required: true,
        },

        artistReleases: {
            type: Array,
            default: () => [],
        },

        detailsLoading: {
            type: Boolean,
            default: false,
        },
    },

    emits: [
        'close',
        'play-track',
        'open-release',
    ],

    setup(props, { emit }) {
        const store = useStore();

        const dialog = ref(null);
        const coverIndex = ref(0);

        const isAuthenticated = computed(() => {
            return store.getters.isAuthenticated;
        });

        const covers = computed(() => {
            const images = Array.isArray(props.entry.cover)
                ? props.entry.cover
                : [props.entry.cover];

            return images.filter(image => {
                return (
                    typeof image === 'string' &&
                    image.trim()
                );
            });
        });

        const tracks = computed(() => {
            return Array.isArray(props.entry.tracks)
                ? props.entry.tracks
                : [];
        });

        const validUrl = link => {
            return (
                typeof link === 'string' &&
                /^https?:\/\//i.test(link)
            );
        };

        const playableTracks = computed(() => {
            return tracks.value.filter(track => {
                return validUrl(track.url);
            });
        });

        const notes = computed(() => {
            if (!props.entry.notes) {
                return [];
            }

            return Array.isArray(props.entry.notes)
                ? props.entry.notes
                : [props.entry.notes];
        });

        const credits = computed(() => {
            if (
                props.entry.credits &&
                typeof props.entry.credits === 'object' &&
                !Array.isArray(props.entry.credits)
            ) {
                return Object.entries(props.entry.credits);
            }

            return [];
        });

        const links = computed(() => {
            if (
                props.entry.links &&
                typeof props.entry.links === 'object' &&
                !Array.isArray(props.entry.links)
            ) {
                return Object.entries(props.entry.links)
                    .filter(([, link]) => validUrl(link));
            }

            return [];
        });

        const sortedArtistReleases = computed(() => {
            return [...props.artistReleases].sort((a, b) => {
                return (
                    new Date(b.release_date || 0) -
                    new Date(a.release_date || 0)
                );
            });
        });

        const asText = data => {
            return Array.isArray(data)
                ? data.join(', ')
                : String(data ?? '');
        };

        const changeCover = by => {
            coverIndex.value = (
                coverIndex.value +
                by +
                covers.value.length
            ) % covers.value.length;
        };

        const play = track => {
            emit('play-track', {
                track,
                entry: props.entry,
            });
        };

        const onKey = event => {
            if (event.key === 'Escape') {
                emit('close');
            }
        };

        onMounted(() => {
            document.addEventListener('keydown', onKey);

            nextTick(() => {
                dialog.value?.focus();
            });
        });

        onBeforeUnmount(() => {
            document.removeEventListener('keydown', onKey);
        });

        return {
            dialog,
            coverIndex,
            covers,
            tracks,
            playableTracks,
            notes,
            credits,
            links,
            sortedArtistReleases,
            isAuthenticated,
            asText,
            validUrl,
            changeCover,
            play,
        };
    },
};
</script>

<style scoped>
.entry-overlay {
    position: fixed;
    inset: 0;
    z-index: 100;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 26px;
    background: #000e;
}

.entry-dialog {
    position: relative;
    overflow-y: auto;
    max-height: 91dvh;
    width: min(820px, 100%);
    background: #000;
    color: #fff;
    border: 1px solid #fff;
    padding: 50px 43px 40px;
    text-align: left;
    outline: 0;
}

.entry-close {
    position: absolute;
    top: 8px;
    right: 17px;
    font-size: 35px;
    font-weight: 300;
    line-height: 1;
    letter-spacing: 0;
}

.entry-layout {
    display: grid;
    grid-template-columns:
        minmax(0, 1fr)
        minmax(0, 1.12fr);
    gap: 33px;
    align-items: start;
}

.entry-layout.no-cover {
    display: block;
}

.entry-cover {
    aspect-ratio: 1;
    width: 100%;
}

.entry-cover img {
    display: block;
    width: 100%;
    height: 100%;
    object-fit: contain;
}

.cover-controls {
    display: flex;
    justify-content: center;
    align-items: center;
    gap: 20px;
    padding-top: 12px;
    font-size: 13px;
    letter-spacing: -0.4px;
}

.cover-controls button {
    font-size: 20px;
}

.cover-links {
    display: flex;
    flex-wrap: wrap;
    gap: 13px;
    margin: 16px 0 0;
    font-size: 18px;
    letter-spacing: -1px;
}

.cover-links button,
.cover-links a {
    text-decoration: underline;
}

.entry-dialog h1 {
    font-size: clamp(30px, 4.2vw, 52px);
    font-weight: 700;
    line-height: 1.04;
    letter-spacing: -2px;
    margin: 0;
    text-decoration: underline;
    overflow-wrap: anywhere;
}

.entry-dialog h2 {
    font-size: clamp(22px, 3vw, 32px);
    font-weight: 400;
    line-height: 1.07;
    letter-spacing: -2px;
    margin: 9px 0 24px;
    overflow-wrap: anywhere;
}

.entry-tracks {
    display: flex;
    flex-direction: column;
    gap: 0;
    margin: 22px 0 28px;
}

.entry-tracks button {
    text-align: left;
    width: 100%;
    padding: 10px 0;
    border-bottom: 1px solid #555;
    font-size: 20px;
    line-height: 1.14;
    letter-spacing: -1px;
}

.entry-tracks button b {
    font-weight: 600;
}

.entry-tracks button:disabled {
    opacity: 0.55;
    cursor: default;
}

.entry-meta {
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin-top: 22px;
    font-size: 16px;
    line-height: 1.35;
    letter-spacing: -1px;
}

.entry-meta p {
    margin: 0;
}

.entry-meta a,
.about-copy a,
.entry-admin a {
    text-decoration: underline;
}

.entry-muted {
    font-size: 16px;
    letter-spacing: -0.7px;
    color: #aaa;
}

.entry-list {
    display: flex;
    flex-direction: column;
    margin-top: 25px;
}

.entry-list button {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    gap: 14px;
    border-bottom: 1px solid #555;
    width: 100%;
    padding: 13px 0;
    text-align: left;
    font-size: 22px;
    letter-spacing: -1px;
}

.entry-list span {
    font-size: 12px;
    color: #aaa;
    letter-spacing: -0.4px;
}

.entry-admin {
    margin-top: 25px;
    font-size: 15px;
    letter-spacing: -0.5px;
}

.about-copy {
    max-width: 700px;
    line-height: 1.7;
    letter-spacing: -1px;
    font-size: 18px;
}

.about-copy p {
    margin: 18px 0;
}

/* MOBILE */

@media (max-width: 700px) {
    .entry-overlay {
        padding: 14px;
    }

    .entry-dialog {
        padding: 49px 21px 27px;
    }

    /* Remove somente a borda do modal de releases */
    .entry-dialog.release-dialog {
        border: none;
    }

    .entry-layout {
        grid-template-columns: 1fr;
        gap: 22px;
    }

    .entry-cover {
        max-width: 330px;
    }

    .entry-dialog h1 {
        font-size: 31px;
    }

    .entry-dialog h2 {
        font-size: 24px;
    }

    .entry-tracks button {
        font-size: 18px;
    }

    .about-copy {
        font-size: 16px;
    }
}
</style>
