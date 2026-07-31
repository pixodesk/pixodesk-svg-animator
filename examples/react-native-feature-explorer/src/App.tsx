/**
 * Pixodesk SVG Animator — React Native Feature Explorer.
 *
 * Scrolls the editor's whole feature-fixture suite (118 cases in 16 sections),
 * grouped and ordered exactly as in the editor's explorer. Uses a `SectionList`,
 * so only on-screen rows are mounted, and only rows actually visible are
 * *playing* — see `visibleIds` below.
 */
import { PixodeskSvgAnimator, type RnAnimatorApi } from '@pixodesk/svg-animator-rn';
import { StatusBar } from 'expo-status-bar';
import { memo, useCallback, useMemo, useRef, useState } from 'react';
import {
    Pressable, SectionList, StyleSheet, Text, TextInput, useColorScheme, View,
    type ViewToken,
} from 'react-native';
import { CASE_COUNT, CASE_SECTIONS, type ExplorerCase } from './catalog';

/**
 * Bumped on every player fix so it is obvious on-device which build is running
 * — the phone caches aggressively and "did my fix ship?" is otherwise guesswork.
 *
 *  #1  transform emitted as a matrix instead of an SVG string
 *  #2  animated transform sent as the native `matrix` prop (not `transform`)
 *  #3  that rename made platform-aware — web still needs `transform`
 *  #4  matrix VALUES also gated on platform (they were breaking web)
 */
const BUILD = 4;

type Theme = typeof darkTheme;

/** Strips the inline markdown the editor authors descriptions in. */
function plain(md: string): string {
    return md.replace(/\*\*(.+?)\*\*/g, '$1').replace(/`(.+?)`/g, '$1');
}

// ---------------------------------------------------------------------------
// One case row
// ---------------------------------------------------------------------------

const CaseRow = memo(function CaseRow({
    item, visible, playing, loop, t,
}: {
    item: ExplorerCase;
    /** On screen right now — off-screen rows are rendered static to save work. */
    visible: boolean;
    /** Global play/pause toggle. */
    playing: boolean;
    /** Override the fixtures' one-shot timing so cases stay visible. */
    loop: boolean;
    t: Theme;
}) {
    const api = useRef<RnAnimatorApi | null>(null);
    const active = visible && playing;

    return (
        <View style={[styles.row, { borderColor: t.border, backgroundColor: t.card }]}>
            <View style={styles.rowHead}>
                <Text style={[styles.caseId, { color: t.fg }]} numberOfLines={1}>{item.id}</Text>
                <Pressable
                    hitSlop={8}
                    onPress={() => { api.current?.cancel(); api.current?.play(); }}
                >
                    <Text style={[styles.replay, { color: t.accent }]}>↺</Text>
                </Pressable>
            </View>

            {!!item.description && (
                <Text style={[styles.caseDesc, { color: t.dim }]}>{plain(item.description)}</Text>
            )}

            <View style={[styles.stage, { backgroundColor: t.stage, borderColor: t.border }]}>
                <PixodeskSvgAnimator
                    // Remounting on `active` restarts cleanly when a row scrolls
                    // back into view, and leaves off-screen rows completely idle.
                    key={(active ? 'play' : 'idle') + (loop ? '-loop' : '')}
                    doc={item.doc as any}
                    autoplay={active}
                    // The fixtures are authored one-shot (1s, no iterations), which
                    // is right for the editor's frame-by-frame inspection but means
                    // a row would be finished before you scrolled to it.
                    iterations={loop ? 'infinite' : undefined}
                    apiRef={api}
                />
            </View>
        </View>
    );
});

// ---------------------------------------------------------------------------
// App
// ---------------------------------------------------------------------------

export default function App() {
    const scheme = useColorScheme();
    const [dark, setDark] = useState(scheme !== 'light');
    const t: Theme = dark ? darkTheme : lightTheme;

    const [playing, setPlaying] = useState(true);
    const [loop, setLoop] = useState(true);
    const [query, setQuery] = useState('');
    const [visibleIds, setVisibleIds] = useState<Set<string>>(new Set());
    // Viewability reporting is not guaranteed on every platform (notably
    // react-native-web). Until it has reported at least once, treat every
    // MOUNTED row as visible — virtualisation already keeps that set small, so
    // the fallback can never mean "118 animations at once".
    const [viewabilityReady, setViewabilityReady] = useState(false);

    const sections = useMemo(() => {
        const q = query.trim().toLowerCase();
        if (!q) return CASE_SECTIONS;
        return CASE_SECTIONS
            .map(s => ({ ...s, data: s.data.filter(c => c.id.toLowerCase().includes(q)) }))
            .filter(s => s.data.length > 0);
    }, [query]);

    const shownCount = useMemo(
        () => sections.reduce((n, s) => n + s.data.length, 0), [sections]);

    // Only rows the user can actually see are allowed to animate. Without this
    // every mounted row (the list keeps a window either side) would drive its
    // own timeline.
    const onViewableItemsChanged = useRef(({ viewableItems }: { viewableItems: Array<ViewToken> }) => {
        setViewabilityReady(true);
        setVisibleIds(new Set(viewableItems.map(v => (v.item as ExplorerCase).id)));
    }).current;
    const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 40 }).current;

    const renderItem = useCallback(({ item }: { item: ExplorerCase }) => (
        <CaseRow
            item={item}
            visible={!viewabilityReady || visibleIds.has(item.id)}
            playing={playing}
            loop={loop}
            t={t}
        />
    ), [visibleIds, viewabilityReady, playing, loop, t]);

    return (
        <View style={[styles.root, { backgroundColor: t.bg }]}>
            <View style={[styles.header, { borderColor: t.border }]}>
                <View style={styles.titleRow}>
                    <View style={{ flexShrink: 1 }}>
                        <Text style={[styles.title, { color: t.fg }]}>Feature Explorer #{BUILD}</Text>
                        <Text style={[styles.subtitle, { color: t.dim }]}>
                            {shownCount} of {CASE_COUNT} cases · {sections.length} sections
                        </Text>
                    </View>
                    <View style={styles.headerBtns}>
                        <Pressable
                            style={[styles.btn, { borderColor: t.border, backgroundColor: playing ? t.accent : t.card }]}
                            onPress={() => setPlaying(p => !p)}
                        >
                            <Text style={{ color: playing ? '#fff' : t.fg, fontSize: 13 }}>
                                {playing ? '❚❚ Pause all' : '▶ Play all'}
                            </Text>
                        </Pressable>
                        <Pressable
                            style={[styles.btn, { borderColor: t.border, backgroundColor: loop ? t.accent : t.card }]}
                            onPress={() => setLoop(l => !l)}
                        >
                            <Text style={{ color: loop ? '#fff' : t.fg, fontSize: 13 }}>↻ Loop</Text>
                        </Pressable>
                        <Pressable
                            style={[styles.btn, { borderColor: t.border, backgroundColor: t.card }]}
                            onPress={() => setDark(d => !d)}
                        >
                            <Text style={{ color: t.fg, fontSize: 13 }}>{dark ? '🌙' : '☀️'}</Text>
                        </Pressable>
                    </View>
                </View>

                <TextInput
                    value={query}
                    onChangeText={setQuery}
                    placeholder="Filter, e.g. gradient, transform, effect.trim…"
                    placeholderTextColor={t.dim}
                    autoCapitalize="none"
                    autoCorrect={false}
                    style={[styles.search, { color: t.fg, borderColor: t.border, backgroundColor: t.card }]}
                />
            </View>

            <SectionList
                sections={sections}
                keyExtractor={item => item.id}
                renderItem={renderItem}
                renderSectionHeader={({ section }) => (
                    <View style={[styles.sectionHead, { backgroundColor: t.bg, borderColor: t.border }]}>
                        <Text style={[styles.sectionTitle, { color: t.accent }]}>{section.title}</Text>
                        <Text style={[styles.sectionCount, { color: t.dim }]}>{section.data.length}</Text>
                    </View>
                )}
                stickySectionHeadersEnabled
                onViewableItemsChanged={onViewableItemsChanged}
                viewabilityConfig={viewabilityConfig}
                // Virtualisation: keep the mounted window tight so a hundred
                // animators never exist at once.
                initialNumToRender={3}
                maxToRenderPerBatch={4}
                windowSize={5}
                removeClippedSubviews
                contentContainerStyle={styles.listContent}
                ListEmptyComponent={
                    <Text style={[styles.empty, { color: t.dim }]}>No cases match “{query}”.</Text>
                }
            />
            <StatusBar style={dark ? 'light' : 'dark'} />
        </View>
    );
}

const darkTheme = { bg: '#12121c', card: '#1c1c2b', stage: '#ffffff', fg: '#f2f2f7', dim: '#8b8ba0', border: '#33334a', accent: '#0087ff' };
const lightTheme = { bg: '#f4f5f9', card: '#ffffff', stage: '#ffffff', fg: '#14141c', dim: '#6b6b7d', border: '#d7d9e3', accent: '#0069cc' };

const styles = StyleSheet.create({
    root: { flex: 1 },
    header: { paddingTop: 56, paddingHorizontal: 14, paddingBottom: 10, borderBottomWidth: 1, gap: 10 },
    titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
    title: { fontSize: 20, fontWeight: '700' },
    subtitle: { fontSize: 12, marginTop: 2 },
    headerBtns: { flexDirection: 'row', gap: 6 },
    btn: { borderWidth: 1, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 7 },
    search: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, fontSize: 14 },

    listContent: { padding: 12, paddingBottom: 40, gap: 12 },
    sectionHead: {
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
        paddingVertical: 8, marginHorizontal: -12, paddingHorizontal: 12, borderBottomWidth: 1,
    },
    sectionTitle: { fontSize: 13, fontWeight: '700', letterSpacing: 0.4 },
    sectionCount: { fontSize: 12 },

    row: { borderWidth: 1, borderRadius: 14, padding: 10, gap: 6 },
    rowHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
    caseId: { fontSize: 13, fontWeight: '600', flexShrink: 1 },
    replay: { fontSize: 18, paddingHorizontal: 4 },
    caseDesc: { fontSize: 11, lineHeight: 15 },
    stage: { borderWidth: 1, borderRadius: 10, aspectRatio: 1.6, overflow: 'hidden' },

    empty: { textAlign: 'center', paddingVertical: 40, fontSize: 13 },
});
