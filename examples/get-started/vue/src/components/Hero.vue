<script setup>
import { SvgAnimationPlayer } from '@pixodesk/svg-animator-vue';
import animation from './animation.json';
</script>

<template>
  <div style="width: 300px; height: 300px">
    <SvgAnimationPlayer :document="animation" playerActionTriggers />
  </div>
</template>
