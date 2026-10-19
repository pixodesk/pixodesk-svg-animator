<script setup>
import { SvgAnimator } from '@pixodesk/svg-animator-vue';
import animation from './animation.json';
</script>

<template>
  <div style="width: 300px; height: 300px">
    <SvgAnimator :doc="animation" playAsSaved />
  </div>
</template>
