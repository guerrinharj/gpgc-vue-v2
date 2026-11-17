<template>
    <div id="app" :class="{ 'spatial-app': isSpatialRoute, 'admin-app': !isSpatialRoute }">
        <NavBar />
        <CreateBar />
        <router-view />
        <PlayerBar />
    </div>
</template>

<script>
import { computed } from 'vue';
import { useRoute } from 'vue-router';
import NavBar from '@/components/NavBar.vue';
import CreateBar from '@/components/CreateBar.vue';
import PlayerBar from '@/components/PlayerBar.vue';

export default {
    name: 'App',
    components: { NavBar, CreateBar, PlayerBar },
    setup() {
        const route = useRoute();
        const isSpatialRoute = computed(() => Boolean(route.meta.spatial));
        return { isSpatialRoute };
    },
};
</script>

<style>
*, *::before, *::after { box-sizing: border-box; }
html, body, #app { margin: 0; width: 100%; min-height: 100%; background: #000; color: #fff; }
html { font-family: 'Helvetica Neue', Helvetica, sans-serif; letter-spacing: -2px; -webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale; }
body { margin: 0; }
#app.spatial-app { height: 100dvh; overflow: hidden; position: relative; }
#app.admin-app { min-height: 100dvh; padding: 84px 4vw 170px; }
button { all: unset; cursor: pointer; font-family: inherit; }
button:focus-visible, a:focus-visible, input:focus-visible { outline: 1px solid #fff; outline-offset: 5px; }
a { color: inherit; text-decoration: none; }
a:hover, button:hover { text-decoration: underline; }
h1, h2, h3, p { margin-top: 0; }
#app.spatial-app .create-bar { position: absolute; top: 14px; left: 16px; z-index: 20; margin: 0; transform: none; flex-wrap: wrap; }
#app.spatial-app .create-bar button { font-size: 12px; border-color: #666; padding: 4px 8px; }
@media (max-width: 700px) { #app.admin-app { padding: 74px 20px 190px; } }
</style>
