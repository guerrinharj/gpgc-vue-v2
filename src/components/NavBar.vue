
<template>
    <nav class="spatial-nav" aria-label="Main navigation">
        <ul>
            <li>
                <router-link to="/artists">
                    Artists
                </router-link>
            </li>

            <li>
                <router-link to="/releases">
                    Releases
                </router-link>
            </li>

            <li>
                <router-link to="/featurings">
                    Featurings
                </router-link>
            </li>

            <li>
                <router-link to="/soundtracks">
                    Soundtracks
                </router-link>
            </li>

            <li>
                <router-link to="/about">
                    About
                </router-link>
            </li>
        </ul>
    </nav>
</template>

<script>
export default {
    name: 'NavBar',
};
</script>

<style scoped>
.spatial-nav {
    position: fixed;
    z-index: 30;
    bottom: 22px;
    right: 24px;
    color: #fff;
    text-align: right;
}

.spatial-nav ul {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    justify-content: flex-end;
    gap: 4px;
    padding: 0;
    margin: 0;
    list-style: none;
}

.spatial-nav a {
    display: block;
    color: #fff;
    font-size: 16px;
    font-weight: 600;
    letter-spacing: -1.2px;
    line-height: 0.92;
    text-decoration: none;
}

.spatial-nav a.router-link-active {
    text-decoration: underline;
}

@media (max-width: 768px) {
    .spatial-nav {
        right: 12px;
        bottom: 14px;
    }

    .spatial-nav ul {
        gap: 3px;
    }

    .spatial-nav a {
        font-size: 14px !important;
        font-weight: 600;
        letter-spacing: -0.7px;
        line-height: 1;
    }
}
</style>
