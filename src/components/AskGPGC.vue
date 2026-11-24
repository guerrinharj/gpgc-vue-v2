
<template>
    <div
        class="ask-gpgc"
        :class="{ 'ask-gpgc--open': isOpen }"
        @wheel.stop
        @touchstart.stop
        @touchmove.stop
        @keydown.stop
    >
        <button
            class="ask-gpgc-toggle"
            type="button"
            :aria-expanded="isOpen"
            aria-controls="ask-gpgc-panel"
            @click="togglePanel"
        >
            <span>ASK GPGC</span>
            <span class="ask-gpgc-toggle-icon">
                {{ isOpen ? '×' : '↗' }}
            </span>
        </button>

        <div
            v-if="isOpen"
            id="ask-gpgc-panel"
            class="ask-gpgc-panel"
        >
            <div class="ask-gpgc-heading">
                <span>GPGC LISTENING MACHINE</span>
                <span>001</span>
            </div>

            <p class="ask-gpgc-intro">
                Describe what you want to hear.
                Find something from my discography.
            </p>

            <form @submit.prevent="searchMusic">
                <label
                    class="ask-gpgc-label"
                    for="ask-gpgc-query"
                >
                    WHAT ARE YOU LOOKING FOR?
                </label>

                <textarea
                    id="ask-gpgc-query"
                    v-model="query"
                    class="ask-gpgc-input"
                    placeholder="Something dark, repetitive, hypnotic..."
                    rows="4"
                    maxlength="500"
                    :disabled="loading"
                    @keydown.enter.exact.prevent="searchMusic"
                ></textarea>
]

                <button
                    class="ask-gpgc-submit"
                    type="submit"
                    :disabled="!query.trim() || loading"
                >
                    <span>
                        {{ loading ? 'SEARCHING...' : 'FIND MY SOUND' }}
                    </span>
                    <span>{{ loading ? '...' : '→' }}</span>
                </button>
            </form>

            <div
                v-if="loading"
                class="ask-gpgc-status"
                role="status"
            >
                ANALYZING YOUR REQUEST
                <span class="ask-gpgc-loading">...</span>
            </div>

            <div
                v-if="errorMessage"
                class="ask-gpgc-error"
                role="alert"
            >
                {{ errorMessage }}
            </div>

            <div
                v-if="hasSearched && !loading && !errorMessage"
                class="ask-gpgc-results"
            >
                <div class="ask-gpgc-results-heading">
                    <span>RECOMMENDATIONS</span>
                    <span>
                        {{ results.length }}
                        FOUND
                    </span>
                </div>

                <p
                    v-if="answer"
                    class="ask-gpgc-answer"
                >
                    {{ answer }}
                </p>

                <div
                    v-if="!results.length"
                    class="ask-gpgc-empty"
                >
                    No matching releases found.
                    Try another description.
                </div>

                <div
                    v-for="(result, index) in results"
                    :key="result.id || result.slug || index"
                    class="ask-gpgc-result"
                >
                    <div class="ask-gpgc-result-number">
                        {{ String(index + 1).padStart(2, '0') }}
                    </div>

                    <div class="ask-gpgc-result-content">
                        <button
                            class="ask-gpgc-result-title"
                            type="button"
                            :disabled="!result.slug"
                            @click="openRelease(result)"
                        >
                            {{ result.name }}
                            <span v-if="result.slug">↗</span>
                        </button>

                        <div
                            v-if="result.artist"
                            class="ask-gpgc-result-artist"
                        >
                            {{ result.artist }}
                        </div>

                        <p
                            v-if="result.reason"
                            class="ask-gpgc-result-reason"
                        >
                            {{ result.reason }}
                        </p>

                        <div
                            v-if="result.year"
                            class="ask-gpgc-result-year"
                        >
                            {{ result.year }}
                        </div>
                    </div>
                </div>
            </div>

            <div class="ask-gpgc-footer">
                <span>AUDIO + METADATA</span>
                <span>GPGC ©</span>
            </div>
        </div>
    </div>
</template>

<script>
import {
    ref,
    onBeforeUnmount,
} from 'vue';

import {
    useRouter,
} from 'vue-router';

const API_URL = (
    process.env.VUE_APP_MUSIC_AI_URL || ''
).replace(/\/$/, '');

const SUGGESTIONS = [
    'Dark & hypnotic',
    'Warm analog synthesizers',
    'Noisy and experimental',
    'Slow and melancholic',
    'Something cinematic',
    'Repetitive electronic music',
];

export default {
    name: 'AskGPGC',

    setup() {
        const router = useRouter();

        const isOpen = ref(false);
        const query = ref('');
        const loading = ref(false);
        const hasSearched = ref(false);

        const results = ref([]);
        const answer = ref('');
        const errorMessage = ref('');

        const suggestions = SUGGESTIONS;

        let controller = null;

        function cancelSearch() {
            if (controller) {
                controller.abort();
                controller = null;
            }

            loading.value = false;
        }

        function togglePanel() {
            isOpen.value = !isOpen.value;

            if (!isOpen.value) {
                cancelSearch();
            }
        }


        function normalizeResult(item) {
            const release = item.release || item;

            return {
                id: release.id || item.release_id || null,
                name:
                    release.name ||
                    release.title ||
                    'Untitled Release',
                slug: release.slug || null,
                artist:
                    release.artist_name ||
                    release.artist?.name ||
                    release.artist ||
                    '',
                year: release.year || null,
                reason:
                    item.reason ||
                    item.explanation ||
                    '',
            };
        }

        async function searchMusic() {
            const text = query.value.trim();

            if (!text || loading.value) {
                return;
            }

            cancelSearch();

            results.value = [];
            answer.value = '';
            errorMessage.value = '';
            hasSearched.value = false;
            loading.value = true;

            if (!API_URL) {
                errorMessage.value =
                    'Music intelligence API is not configured yet.';

                loading.value = false;
                return;
            }

            const request = new AbortController();
            controller = request;

            try {
                const response = await fetch(
                    `${API_URL}/search`,
                    {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({
                            query: text,
                            limit: 5,
                        }),
                        signal: request.signal,
                    }
                );

                if (!response.ok) {
                    throw new Error(
                        `Search failed (${response.status})`
                    );
                }

                const data = await response.json();

                if (
                    !data ||
                    !Array.isArray(data.results)
                ) {
                    throw new Error(
                        'Invalid response from music API.'
                    );
                }

                results.value = data.results.map(
                    normalizeResult
                );

                answer.value =
                    typeof data.answer === 'string'
                        ? data.answer
                        : '';

                hasSearched.value = true;
            } catch (error) {
                if (error.name === 'AbortError') {
                    return;
                }

                console.error(
                    'Music intelligence search:',
                    error
                );

                errorMessage.value =
                    'Unable to search the discography right now.';
            } finally {
                if (controller === request) {
                    controller = null;
                    loading.value = false;
                }
            }
        }

        function openRelease(result) {
            if (!result.slug) {
                return;
            }

            isOpen.value = false;

            router.push({
                path: `/releases/${encodeURIComponent(
                    result.slug
                )}`,
            });
        }

        onBeforeUnmount(() => {
            cancelSearch();
        });

        return {
            isOpen,
            query,
            loading,
            hasSearched,
            results,
            answer,
            errorMessage,
            suggestions,
            togglePanel,
            searchMusic,
            openRelease,
        };
    },
};
</script>

<style scoped>
.ask-gpgc {
    position: absolute;
    top: 24px;
    left: 24px;
    z-index: 100;
    width: min(350px, calc(100vw - 8vh));
    color: #fff;
    font-family: inherit;
    pointer-events: none;
}

.ask-gpgc-toggle {
    display: inline-flex;
    align-items: center;
    justify-content: space-between;
    gap: 24px;
    padding: 8px 0;
    border: none;
    background: transparent;
    color: #fff;
    font-family: inherit;
    font-size: 15px;
    font-weight: 700;
    letter-spacing: -0.6px;
    cursor: pointer;
    pointer-events: auto;
}

.ask-gpgc-toggle-icon {
    font-size: 20px;
    font-weight: 400;
    line-height: 1;
}

.ask-gpgc-toggle:hover {
    opacity: 0.6;
}

.ask-gpgc-panel {
    margin-top: 12px;
    padding: 22px;
    border: 1px solid #fff;
    background: #000;
    max-height: min(75vh, 720px);
    overflow-y: auto;
    overscroll-behavior: contain;
    pointer-events: auto;
    scrollbar-width: thin;
    scrollbar-color: #777 #000;
    animation: ask-gpgc-enter 180ms ease-out;
}

.ask-gpgc-heading,
.ask-gpgc-results-heading,
.ask-gpgc-footer {
    display: flex;
    justify-content: space-between;
    gap: 12px;
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.5px;
}

.ask-gpgc-intro {
    margin: 28px 0;
    font-size: 23px;
    font-weight: 400;
    line-height: 1.15;
    letter-spacing: -1.1px;
}

.ask-gpgc-label {
    display: block;
    margin-bottom: 10px;
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.4px;
}

.ask-gpgc-input {
    display: block;
    width: 100%;
    min-height: 112px;
    padding: 12px;
    border: 1px solid #777;
    border-radius: 0;
    outline: none;
    background: #000;
    color: #fff;
    font-family: inherit;
    font-size: 16px;
    line-height: 1.4;
    letter-spacing: -0.4px;
    resize: vertical;
    box-sizing: border-box;
}

.ask-gpgc-input:focus {
    border-color: #fff;
}

.ask-gpgc-input::placeholder {
    color: #777;
}

.ask-gpgc-suggestions {
    display: flex;
    flex-wrap: wrap;
    gap: 7px;
    margin: 14px 0 24px;
}

.ask-gpgc-suggestion {
    padding: 7px 9px;
    border: 1px solid #555;
    border-radius: 0;
    background: transparent;
    color: #bbb;
    font-family: inherit;
    font-size: 11px;
    line-height: 1.3;
    cursor: pointer;
}

.ask-gpgc-suggestion:hover {
    border-color: #fff;
    background: #fff;
    color: #000;
}

.ask-gpgc-submit {
    display: inline-flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    width: fit-content;
    margin-top: 10px;
    padding: 6px 10px;
    border: 1px solid #fff;
    border-radius: 0;
    background: #fff;
    color: #000;
    font-family: inherit;
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0;
    cursor: pointer;
}

.ask-gpgc-submit:hover:not(:disabled) {
    background: #000;
    color: #fff;
}

.ask-gpgc-submit:disabled {
    opacity: 0.45;
    cursor: not-allowed;
}

.ask-gpgc-status,
.ask-gpgc-error,
.ask-gpgc-empty {
    margin-top: 24px;
    font-size: 12px;
    line-height: 1.5;
}

.ask-gpgc-error {
    color: #ccc;
}

.ask-gpgc-loading {
    display: inline-block;
    animation: ask-gpgc-pulse 1s infinite alternate;
}

.ask-gpgc-results {
    margin-top: 30px;
    border-top: 1px solid #777;
    padding-top: 14px;
}

.ask-gpgc-answer {
    margin: 20px 0;
    font-size: 14px;
    line-height: 1.5;
    letter-spacing: -0.2px;
}

.ask-gpgc-result {
    display: flex;
    gap: 14px;
    padding: 18px 0;
    border-bottom: 1px solid #444;
}

.ask-gpgc-result-number {
    flex: 0 0 22px;
    color: #888;
    font-size: 11px;
}

.ask-gpgc-result-content {
    min-width: 0;
    flex: 1;
}

.ask-gpgc-result-title {
    display: flex;
    align-items: baseline;
    gap: 8px;
    padding: 0;
    border: none;
    background: transparent;
    color: #fff;
    font-family: inherit;
    font-size: 20px;
    font-weight: 700;
    line-height: 1.1;
    letter-spacing: -0.8px;
    text-align: left;
    cursor: pointer;
}

.ask-gpgc-result-title:hover:not(:disabled) {
    opacity: 0.6;
}

.ask-gpgc-result-title:disabled {
    cursor: default;
}

.ask-gpgc-result-artist {
    margin-top: 5px;
    color: #aaa;
    font-size: 12px;
    letter-spacing: 0;
}

.ask-gpgc-result-reason {
    margin: 12px 0 0;
    color: #ccc;
    font-size: 12px;
    line-height: 1.5;
    letter-spacing: 0;
}

.ask-gpgc-result-year {
    margin-top: 8px;
    color: #888;
    font-size: 10px;
}

.ask-gpgc-footer {
    margin-top: 30px;
    padding-top: 12px;
    border-top: 1px solid #555;
    color: #888;
    font-size: 9px;
}

@keyframes ask-gpgc-enter {
    from {
        opacity: 0;
        transform: translateY(-8px);
    }

    to {
        opacity: 1;
        transform: translateY(0);
    }
}

@keyframes ask-gpgc-pulse {
    from {
        opacity: 0.2;
    }

    to {
        opacity: 1;
    }
}

@media (max-width: 768px) {
    .ask-gpgc {
        top: calc(16px + env(safe-area-inset-top, 0px));
        left: 16px;
        width: min(350px, calc(100vw - 8vh));
    }

    .ask-gpgc-toggle {
        font-size: 14px;
    }

    .ask-gpgc-panel {
        padding: 16px;
        max-height: 70dvh;
    }

    .ask-gpgc-intro {
        font-size: 21px;
    }
}

@media (prefers-reduced-motion: reduce) {
    .ask-gpgc-panel,
    .ask-gpgc-loading {
        animation: none;
    }
}
</style>
