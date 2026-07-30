/**
 * Demo of @pixodesk/svg-animator-rn — the JSON animator documents below are the
 * same wire format the web player consumes. Switch back to the hand-written
 * reanimated experiment by importing './App' in index.js.
 */
import { StatusBar } from 'expo-status-bar';
import { useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { PixodeskSvgAnimator, type RnAnimatorApi } from '@pixodesk/svg-animator-rn';
import type { PxAnimatedSvgDocument } from '@pixodesk/svg-animator-core';

// -- Sample documents ---------------------------------------------------------

/** Static tree — no animation; exercises the renderer only. */
const staticDoc: PxAnimatedSvgDocument = {
    type: 'svg', viewBox: '0 0 300 200',
    children: [
        { type: 'rect', x: 20, y: 20, width: 80, height: 60, rx: 8, fill: '#6366f1' },
        { type: 'circle', cx: 180, cy: 50, r: 30, fill: '#10b981', stroke: '#fff', 'stroke-width': 2 },
        { type: 'path', d: 'M 20 150 C 100 100 200 190 280 130', stroke: '#f59e0b', 'stroke-width': 4, fill: 'none' },
        {
            type: 'g', transform: 'translate(240,140)',
            children: [{ type: 'ellipse', cx: 0, cy: 0, rx: 30, ry: 18, fill: '#ec489988' }],
        },
    ],
};

/** Transforms + colour + opacity + geometry — the core animated-attr set. */
const animatedDoc: PxAnimatedSvgDocument = {
    type: 'svg', viewBox: '0 0 300 300',
    animator: {
        mode: 'frames', duration: 2000, iterations: 'infinite', direction: 'alternate',
        trigger: { startOn: 'load' },
    },
    children: [
        {
            type: 'circle', id: 'ball', cx: 60, cy: 60, r: 25, fill: '#0087ff',
            animate: {
                cy: { keyframes: [{ time: 0, value: 60 }, { time: 2000, value: 240 }] },
                r: { keyframes: [{ time: 0, value: 25 }, { time: 2000, value: 40 }] },
                fill: { keyframes: [{ time: 0, value: '#0087ff' }, { time: 2000, value: '#ec4899' }] },
            },
        },
        {
            type: 'g', id: 'spinner',
            animate: {
                translate: { keyframes: [{ time: 0, value: [200, 80] }, { time: 2000, value: [200, 220] }] },
            },
            children: [{
                type: 'g', id: 'spinnerInner',
                animate: {
                    rotate: { keyframes: [{ time: 0, value: 0 }, { time: 2000, value: 180 }] },
                },
                children: [{ type: 'rect', x: -25, y: -25, width: 50, height: 50, rx: 6, fill: '#ff6b35' }],
            }],
        },
        {
            type: 'rect', id: 'fader', x: 30, y: 130, width: 60, height: 40, fill: '#10b981',
            animate: {
                opacity: { keyframes: [{ time: 0, value: 1 }, { time: 2000, value: 0.15 }] },
            },
        },
    ],
};

/** Motion along a curved path with auto-orient — materialised by core sampling. */
const motionPathDoc: PxAnimatedSvgDocument = {
    type: 'svg', viewBox: '0 0 300 200',
    animator: { mode: 'frames', duration: 3000, iterations: 'infinite', trigger: { startOn: 'load' } },
    children: [
        { type: 'path', d: 'M 30 150 C 100 30 200 30 270 150', stroke: '#0087ff44', 'stroke-width': 2, fill: 'none' },
        {
            type: 'g', id: 'rider',
            animate: {
                transform: {
                    autoOrient: true,
                    keyframes: [
                        { time: 0, value: { translate: [30, 150] }, tangentOut: [46, -80] },
                        { time: 3000, value: { translate: [270, 150] }, tangentIn: [-46, -80] },
                    ],
                },
            },
            children: [{ type: 'rect', x: -14, y: -14, width: 28, height: 28, rx: 4, fill: '#ffd166' }],
        },
    ],
};

const DEMOS: Array<{ name: string; doc: PxAnimatedSvgDocument; autoplay: boolean }> = [
    { name: 'Animated', doc: animatedDoc, autoplay: true },
    { name: 'Motion path', doc: motionPathDoc, autoplay: true },
    { name: 'Static', doc: staticDoc, autoplay: false },
];

export default function AppPlayer() {
    const [demo, setDemo] = useState(0);
    const api = useRef<RnAnimatorApi | null>(null);
    const current = DEMOS[demo];

    return (
        <View style={styles.container}>
            <Text style={styles.title}>Pixodesk Animator RN</Text>
            <Text style={styles.subtitle}>@pixodesk/svg-animator-rn · reanimated-driven</Text>

            <View style={styles.tabRow}>
                {DEMOS.map((d, i) => (
                    <Pressable key={d.name} style={[styles.tab, i === demo && styles.tabActive]} onPress={() => setDemo(i)}>
                        <Text style={styles.tabText}>{d.name}</Text>
                    </Pressable>
                ))}
            </View>

            <View style={styles.svgContainer}>
                <PixodeskSvgAnimator
                    key={demo}
                    doc={current.doc}
                    autoplay={current.autoplay}
                    apiRef={api}
                />
            </View>

            <View style={styles.buttonRow}>
                <Pressable style={styles.button} onPress={() => api.current?.play()}>
                    <Text style={styles.buttonText}>Play</Text>
                </Pressable>
                <Pressable style={styles.button} onPress={() => api.current?.pause()}>
                    <Text style={styles.buttonText}>Pause</Text>
                </Pressable>
                <Pressable style={styles.button} onPress={() => api.current?.cancel()}>
                    <Text style={styles.buttonText}>Reset</Text>
                </Pressable>
                <Pressable style={styles.button} onPress={() => api.current?.setCurrentTime(1000)}>
                    <Text style={styles.buttonText}>Seek 1s</Text>
                </Pressable>
            </View>

            <StatusBar style="light" />
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#1a1a2e', alignItems: 'center', justifyContent: 'center', paddingTop: 50 },
    title: { fontSize: 26, fontWeight: 'bold', color: '#fff', marginBottom: 4 },
    subtitle: { fontSize: 13, color: '#888', marginBottom: 16 },
    tabRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
    tab: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 16, backgroundColor: '#16213e' },
    tabActive: { backgroundColor: '#0087ff' },
    tabText: { color: '#fff', fontSize: 13 },
    svgContainer: { width: 320, height: 320, backgroundColor: '#16213e', borderRadius: 20, padding: 10 },
    buttonRow: { flexDirection: 'row', gap: 10, marginTop: 20 },
    button: { backgroundColor: '#0087ff', paddingHorizontal: 18, paddingVertical: 10, borderRadius: 20 },
    buttonText: { color: '#fff', fontSize: 14, fontWeight: '600' },
});
