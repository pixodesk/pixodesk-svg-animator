/*---------------------------------------------------------------------------------------
 * Copyright (c) Pixodesk LTD.
 * Licensed under the MIT License. See the LICENSE file in the project root for details.
 *---------------------------------------------------------------------------------------*/

import { Component, type ErrorInfo, type ReactNode } from 'react';

export interface PxRnErrorBoundaryProps {
    children: ReactNode;
    /** Rendered instead of the children once something has thrown. */
    fallback?: (error: Error) => ReactNode;
    onError?: (error: Error, info?: string) => void;
}

interface State {
    error: Error | null;
}

/**
 * Keeps one bad animation from taking down the screen around it.
 *
 * A throw anywhere in the rendered SVG tree — an unsupported prop shape, a
 * react-native-svg internal, a reanimated attachment failure — otherwise
 * unmounts the whole React tree above it. Here it is contained to this one
 * animation, reported through `onError`, and replaced by `fallback`.
 *
 * NOTE the limit: this catches JavaScript errors only. A crash INSIDE the
 * native renderer (see `openClosedTextPathTargets` for a real example) never
 * reaches JavaScript and cannot be caught here — those have to be avoided
 * rather than handled.
 */
export class PxRnErrorBoundary extends Component<PxRnErrorBoundaryProps, State> {
    override state: State = { error: null };

    static getDerivedStateFromError(error: Error): State {
        return { error };
    }

    override componentDidCatch(error: Error, info: ErrorInfo): void {
        this.props.onError?.(error, info?.componentStack ?? undefined);
        console.warn('[PixodeskSvgAnimator] render failed:', error?.message ?? error);
    }

    override componentDidUpdate(prev: PxRnErrorBoundaryProps): void {
        // A new document deserves a fresh attempt — otherwise the boundary
        // would stay latched on the failure for the rest of its life.
        if (this.state.error && prev.children !== this.props.children) {
            this.setState({ error: null });
        }
    }

    override render(): ReactNode {
        const { error } = this.state;
        if (error) return this.props.fallback ? this.props.fallback(error) : null;
        return this.props.children;
    }
}
