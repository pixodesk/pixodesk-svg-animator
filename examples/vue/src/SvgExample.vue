<script setup lang="ts">
import { PixodeskSvgCssAnimator } from '@pixodesk/svg-animator-vue';
import type { OutAction, StartOn } from '@pixodesk/svg-animator-web';
import AnimationSvg from './animation.svg';

defineProps<{
    title: string;
    description: string;
    startOn: StartOn;
    outAction?: OutAction;
}>();

const boxStyle = { width: '400px', height: '400px', border: '1px solid #ccc' };
</script>

<template>
    <div>
        <h2>{{ title }}</h2>
        <p>{{ description }}</p>
        <PixodeskSvgCssAnimator :startOn="startOn" :outAction="outAction ?? 'continue'" :style="boxStyle">
            <AnimationSvg />
        </PixodeskSvgCssAnimator>
    </div>
</template>
