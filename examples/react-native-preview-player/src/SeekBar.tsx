/**
 * Touch seek bar. Written with PanResponder rather than
 * `@react-native-community/slider` so the example has zero native
 * dependencies beyond the player's own peers.
 */
import { useRef, useState } from 'react';
import { PanResponder, StyleSheet, View } from 'react-native';

export function SeekBar({
    value, max, onSeek, onScrubStart, accent, track,
}: {
    /** Current position, same unit as `max`. */
    value: number;
    max: number;
    /** Fires continuously while dragging and on tap. */
    onSeek: (value: number) => void;
    /** Fires once when a drag/tap begins (used to pause playback). */
    onScrubStart?: () => void;
    accent: string;
    track: string;
}) {
    const [width, setWidth] = useState(0);

    // Refs so the gesture handlers — created once — always read fresh values.
    const viewRef = useRef<View | null>(null);
    const originXRef = useRef(0);   // container's x in page coordinates
    const widthRef = useRef(0);
    const maxRef = useRef(max);
    const onSeekRef = useRef(onSeek);
    const onScrubStartRef = useRef(onScrubStart);
    widthRef.current = width;
    maxRef.current = max;
    onSeekRef.current = onSeek;
    onScrubStartRef.current = onScrubStart;

    /** Converts an absolute page x into a value and emits it. */
    const emitPageX = (pageX: number) => {
        const w = widthRef.current;
        if (w <= 0) return;
        const ratio = Math.max(0, Math.min(1, (pageX - originXRef.current) / w));
        onSeekRef.current(ratio * maxRef.current);
    };

    const responder = useRef(
        PanResponder.create({
            onStartShouldSetPanResponder: () => true,
            onMoveShouldSetPanResponder: () => true,
            onPanResponderGrant: (e) => {
                onScrubStartRef.current?.();
                emitPageX(e.nativeEvent.pageX);
            },
            // `moveX` is the touch's absolute x — stable regardless of which
            // subview is under the finger (locationX is not, because the filled
            // track grows and shrinks beneath it).
            onPanResponderMove: (_e, gesture) => emitPageX(gesture.moveX),
        })
    ).current;

    const measure = () => {
        viewRef.current?.measureInWindow((x, _y, w) => {
            originXRef.current = x;
            if (w > 0) setWidth(w);
        });
    };

    const pct = max > 0 ? Math.max(0, Math.min(1, value / max)) : 0;

    return (
        <View ref={viewRef} style={styles.hitArea} onLayout={measure} {...responder.panHandlers}>
            <View style={[styles.track, { backgroundColor: track }]} pointerEvents="none">
                <View style={[styles.fill, { backgroundColor: accent, width: pct * width }]} />
            </View>
            <View
                pointerEvents="none"
                style={[styles.knob, { backgroundColor: accent, left: Math.max(0, pct * width - 9) }]}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    hitArea: { height: 34, justifyContent: 'center' },
    track: { height: 6, borderRadius: 3, overflow: 'hidden' },
    fill: { height: 6, borderRadius: 3 },
    knob: {
        position: 'absolute', width: 18, height: 18, borderRadius: 9,
        borderWidth: 2, borderColor: '#ffffff',
    },
});
