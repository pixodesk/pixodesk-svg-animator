/*---------------------------------------------------------------------------------------
 * Copyright (c) Pixodesk LTD.
 * Licensed under the MIT License. See the LICENSE file in the project root for details.
 *---------------------------------------------------------------------------------------*/

import { Component, type ErrorInfo, type ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

interface Props {
    children: ReactNode;
}

interface State {
    error: Error | null;
    stack?: string;
}

/**
 * Last line of defence: shows the failure ON THE DEVICE.
 *
 * Without this, a throw during render takes the whole app down — a white screen
 * in production, and a red box that says nothing useful once the dev server has
 * disconnected. Here the message and component stack stay on screen, selectable,
 * with a button to try again.
 */
export class AppErrorBoundary extends Component<Props, State> {
    override state: State = { error: null };

    static getDerivedStateFromError(error: Error): State {
        return { error };
    }

    override componentDidCatch(error: Error, info: ErrorInfo): void {
        this.setState({ stack: info?.componentStack ?? undefined });
        console.error('[FeatureExplorer] fatal render error:', error);
    }

    override render(): ReactNode {
        const { error, stack } = this.state;
        if (!error) return this.props.children;

        return (
            <View style={styles.root}>
                <Text style={styles.title}>The explorer could not render</Text>
                <Text style={styles.message} selectable>{String(error?.message ?? error)}</Text>
                <Pressable
                    style={styles.button}
                    onPress={() => this.setState({ error: null, stack: undefined })}
                >
                    <Text style={styles.buttonText}>Try again</Text>
                </Pressable>
                {!!stack && (
                    <ScrollView style={styles.stackBox}>
                        <Text style={styles.stack} selectable>{stack}</Text>
                    </ScrollView>
                )}
            </View>
        );
    }
}

const styles = StyleSheet.create({
    root: { flex: 1, backgroundColor: '#12121c', padding: 20, paddingTop: 80, gap: 14 },
    title: { color: '#ff6b6b', fontSize: 18, fontWeight: '700' },
    message: { color: '#f2f2f7', fontSize: 14, lineHeight: 20 },
    button: { alignSelf: 'flex-start', borderRadius: 14, paddingHorizontal: 16, paddingVertical: 9, backgroundColor: '#0087ff' },
    buttonText: { color: '#fff', fontSize: 14, fontWeight: '600' },
    stackBox: { flex: 1, borderRadius: 10, borderWidth: 1, borderColor: '#33334a', padding: 10 },
    stack: { color: '#8b8ba0', fontSize: 11, lineHeight: 16 },
});
