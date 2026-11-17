<template>
    <nav class="spatial-nav" aria-label="Main navigation">
        <ul>
            <li><router-link to="/artists">Artists</router-link></li>
            <li><router-link to="/releases">Releases</router-link></li>
            <li><router-link to="/featurings">Featurings</router-link></li>
            <li><router-link to="/soundtracks">Soundtracks</router-link></li>
            <li><router-link to="/about">About</router-link></li>
        </ul>
    </nav>
</template>

<script>
export default { name: 'NavBar' };
</script>

<style scoped>
.spatial-nav { position: fixed; z-index: 30; bottom: 22px; right: 24px; color: #fff; text-align: right; }
.spatial-nav ul { display: flex; flex-direction: column; align-items: flex-end; justify-content: flex-end; gap: 4px; padding: 0; margin: 0; list-style: none; }
.spatial-nav a { font-size: 16px; font-weight: 600; letter-spacing: -1.2px; line-height: .92; display: block; color: #fff; }
.spatial-nav a.router-link-active { text-decoration: underline; }
@media (max-width: 768px) {
    .spatial-nav { right: 16px; bottom: 16px; }
    .spatial-nav ul { gap: 4px; }
    .spatial-nav a { font-size: 14px; letter-spacing: -1px; }
}
</style>
