<script setup>
import { PixodeskSvgAnimator } from '@pixodesk/svg-animator-vue';
import animation from './animation.json';
</script>

<template>
  <div style="width: 300px; height: 300px">
    <PixodeskSvgAnimator :doc="animation" autoplay />
  </div>
</template>
