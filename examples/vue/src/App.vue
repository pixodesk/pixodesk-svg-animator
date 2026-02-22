<script setup lang="ts">
import ModeExample from './ModeExample.vue';
import ModeExampleSwitchable from './ModeExampleSwitchable.vue';
import SvgExample from './SvgExample.vue';
</script>

<template>
    <div>
        <h1>Pixodesk Animator Vue Examples</h1>
        <h2>JSON</h2>
        <div style="padding: 20px; display: flex; flex-direction: row; flex-wrap: wrap; gap: 32px">
            <ModeExample mode="autoplay" />
            <ModeExample mode="declarative" />
            <ModeExample mode="imperative" />
            <ModeExample mode="controlled" />
            <ModeExampleSwitchable />
        </div>
        <h2>SVG + CSS-animation + vite-svg-loader</h2>
        <div style="padding: 20px; display: flex; flex-direction: row; flex-wrap: wrap; gap: 32px">
            <SvgExample title="SVG: load" description="Starts playing immediately on mount." startOn="load" />
            <SvgExample title="SVG: hover → pause" description="Plays on hover, pauses when mouse leaves." startOn="mouseOver" outAction="pause" />
            <SvgExample title="SVG: hover → reset" description="Plays on hover, resets to start when mouse leaves." startOn="mouseOver" outAction="reset" />
            <SvgExample title="SVG: click toggle" description="Click to play, click again to pause." startOn="click" outAction="pause" />
            <SvgExample title="SVG: scroll" description="Plays when scrolled into view, resets when scrolled out." startOn="scrollIntoView" outAction="reset" />
        </div>
    </div>
</template>
