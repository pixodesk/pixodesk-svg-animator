/**
 * Pixodesk SVG Animator — React Native Preview Player.
 *
 * Mirrors the web preview player (`examples/preview-player`): sample picker,
 * transport (play / pause / stop / restart / finish), a scrubbable timeline,
 * loop override, playback rate and a light/dark theme toggle. Instead of the
 * web version's drag-and-drop, the documents are embedded (see `samples.ts`).
 */
import { PixodeskSvgAnimator, type RnAnimatorApi } from '@pixodesk/svg-animator-rn';
import type { PxAnimatedSvgDocument } from '@pixodesk/svg-animator-core';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
    Pressable, ScrollView, StyleSheet, Text, useColorScheme, View,
} from 'react-native';
import { SAMPLES } from './samples';
import { SeekBar } from './SeekBar';

type LoopMode = 'auto' | 'loop' | 'no-loop';
const RATES = [0.25, 0.5, 1, 2, 4];

/** Applies the loop override on top of the sample's own animator config. */
function withLoop(doc: PxAnimatedSvgDocument, mode: LoopMode): PxAnimatedSvgDocument {
    if (mode === 'auto') return doc;
    return {
        ...doc,
        animator: { ...doc.animator, iterations: mode === 'loop' ? 'infinite' : 1 },
    };
}

export default function App() {
    const scheme = useColorScheme();
    const [dark, setDark] = useState(scheme !== 'light');
    const t = dark ? darkTheme : lightTheme;

    const [sampleIdx, setSampleIdx] = useState(0);
    const [loopMode, setLoopMode] = useState<LoopMode>('auto');
    const [rate, setRate] = useState(1);
    const [playing, setPlaying] = useState(false);
    const [timeMs, setTimeMs] = useState(0);

    const api = useRef<RnAnimatorApi | null>(null);
    const sample = SAMPLES[sampleIdx];
    const doc = useMemo(() => withLoop(sample.doc, loopMode), [sample, loopMode]);

    // The animator's duration drives the timeline. `iterations` is expressed by
    // the driver (withRepeat), so the scrubbable range is one iteration.
    const duration = doc.animator?.duration ?? 1000;

    // Poll the playhead for the timeline read-out. The value lives in a
    // reanimated SharedValue on the UI thread; 20 Hz is plenty for a label and
    // keeps the JS thread idle.
    useEffect(() => {
        const id = setInterval(() => {
            const now = api.current?.getCurrentTime();
            if (typeof now === 'number') setTimeMs(now);
            const p = api.current?.isPlaying() ?? false;
            setPlaying(prev => (prev === p ? prev : p));
        }, 50);
        return () => clearInterval(id);
    }, []);

    // Re-apply the rate whenever it changes or the document is rebuilt.
    useEffect(() => { api.current?.setPlaybackRate(rate); }, [rate, doc]);

    const call = (fn: (a: RnAnimatorApi) => void) => () => { if (api.current) fn(api.current); };

    return (
        <View style={[styles.root, { backgroundColor: t.bg }]}>
            <ScrollView contentContainerStyle={styles.scroll}>

                <View style={styles.titleRow}>
                    <View style={styles.titleTexts}>
                        <Text style={[styles.title, { color: t.fg }]}>Pixodesk SVG Animator</Text>
                        <Text style={[styles.subtitle, { color: t.dim }]}>React Native Preview Player</Text>
                    </View>
                    <Pressable
                        style={[styles.themeBtn, { borderColor: t.border }]}
                        onPress={() => setDark(d => !d)}
                    >
                        <Text style={{ color: t.fg }}>{dark ? '🌙 Dark' : '☀️ Light'}</Text>
                    </Pressable>
                </View>

                {/* -- Sample picker ------------------------------------------ */}
                <Text style={[styles.legend, { color: t.dim }]}>Example</Text>
                <View style={styles.chipRow}>
                    {SAMPLES.map((s, i) => (
                        <Pressable
                            key={s.name}
                            onPress={() => { setSampleIdx(i); setTimeMs(0); }}
                            style={[
                                styles.chip,
                                { borderColor: t.border, backgroundColor: i === sampleIdx ? t.accent : t.card },
                            ]}
                        >
                            <Text style={{ color: i === sampleIdx ? '#fff' : t.fg, fontSize: 13 }}>{s.name}</Text>
                        </Pressable>
                    ))}
                </View>
                <Text style={[styles.note, { color: t.dim }]}>{sample.note}</Text>

                {/* -- Stage --------------------------------------------------- */}
                <View style={[styles.stage, { backgroundColor: t.card, borderColor: t.border }]}>
                    <PixodeskSvgAnimator
                        key={sampleIdx + '|' + loopMode}
                        doc={doc}
                        autoplay
                        apiRef={api}
                    />
                </View>

                {/* -- Transport ----------------------------------------------- */}
                <View style={styles.transport}>
                    {([
                        ['▶ Play', call(a => a.play())],
                        ['❚❚ Pause', call(a => a.pause())],
                        ['◼ Stop', call(a => a.cancel())],
                        ['↺ Restart', call(a => { a.cancel(); a.play(); })],
                        ['⤓ Finish', call(a => a.finish())],
                    ] as Array<[string, () => void]>).map(([label, onPress]) => (
                        <Pressable
                            key={label}
                            onPress={onPress}
                            style={[styles.btn, { backgroundColor: t.card, borderColor: t.border }]}
                        >
                            <Text style={{ color: t.fg, fontSize: 13 }}>{label}</Text>
                        </Pressable>
                    ))}
                </View>

                {/* -- Timeline ------------------------------------------------ */}
                <SeekBar
                    value={timeMs}
                    max={duration}
                    accent={t.accent}
                    track={t.border}
                    onScrubStart={call(a => a.pause())}
                    onSeek={(v) => { setTimeMs(v); api.current?.setCurrentTime(v); }}
                />
                <View style={styles.timeRow}>
                    <Text style={[styles.mono, { color: t.dim }]}>
                        {Math.round(timeMs)} / {Math.round(duration)} ms
                    </Text>
                    <Text style={[styles.mono, { color: playing ? t.accent : t.dim }]}>
                        {playing ? 'playing' : 'idle'}
                    </Text>
                </View>

                {/* -- Loop ---------------------------------------------------- */}
                <Text style={[styles.legend, { color: t.dim }]}>Loop</Text>
                <View style={styles.chipRow}>
                    {(['auto', 'loop', 'no-loop'] as Array<LoopMode>).map(m => (
                        <Pressable
                            key={m}
                            onPress={() => setLoopMode(m)}
                            style={[
                                styles.chip,
                                { borderColor: t.border, backgroundColor: m === loopMode ? t.accent : t.card },
                            ]}
                        >
                            <Text style={{ color: m === loopMode ? '#fff' : t.fg, fontSize: 13 }}>
                                {m === 'auto' ? 'Auto (from JSON)' : m === 'loop' ? 'Loop' : 'No loop'}
                            </Text>
                        </Pressable>
                    ))}
                </View>

                {/* -- Rate ---------------------------------------------------- */}
                <Text style={[styles.legend, { color: t.dim }]}>Rate</Text>
                <View style={styles.chipRow}>
                    {RATES.map(r => (
                        <Pressable
                            key={r}
                            onPress={() => setRate(r)}
                            style={[
                                styles.chip,
                                { borderColor: t.border, backgroundColor: r === rate ? t.accent : t.card },
                            ]}
                        >
                            <Text style={{ color: r === rate ? '#fff' : t.fg, fontSize: 13 }}>{r}×</Text>
                        </Pressable>
                    ))}
                </View>

                <Text style={[styles.footer, { color: t.dim }]}>
                    Documents are the same wire format as the web player. Playback is driven
                    natively on the UI thread by react-native-reanimated.
                </Text>
            </ScrollView>
            <StatusBar style={dark ? 'light' : 'dark'} />
        </View>
    );
}

const darkTheme = { bg: '#12121c', card: '#1c1c2b', fg: '#f2f2f7', dim: '#8b8ba0', border: '#33334a', accent: '#0087ff' };
const lightTheme = { bg: '#f4f5f9', card: '#ffffff', fg: '#14141c', dim: '#6b6b7d', border: '#d7d9e3', accent: '#0069cc' };

const styles = StyleSheet.create({
    root: { flex: 1 },
    scroll: { padding: 16, paddingTop: 60, paddingBottom: 40, gap: 8 },
    titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    titleTexts: { flexShrink: 1 },
    title: { fontSize: 20, fontWeight: '700' },
    subtitle: { fontSize: 12, marginTop: 2 },
    themeBtn: { borderWidth: 1, borderRadius: 16, paddingHorizontal: 12, paddingVertical: 6 },
    legend: { fontSize: 11, textTransform: 'uppercase', letterSpacing: 1, marginTop: 10 },
    chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
    chip: { borderWidth: 1, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 7 },
    note: { fontSize: 12, fontStyle: 'italic', marginTop: 2 },
    stage: {
        borderWidth: 1, borderRadius: 16, marginTop: 8, padding: 8,
        aspectRatio: 1, alignItems: 'stretch', justifyContent: 'center',
    },
    transport: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 12 },
    btn: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8 },
    timeRow: { flexDirection: 'row', justifyContent: 'space-between' },
    mono: { fontSize: 12, fontVariant: ['tabular-nums'] },
    footer: { fontSize: 11, marginTop: 18, lineHeight: 16 },
});
