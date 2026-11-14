// @px-area variables
/*---------------------------------------------------------------------------------------
 * Copyright (c) Pixodesk LTD.
 * Licensed under the MIT License. See the LICENSE file in the project root for details.
 *---------------------------------------------------------------------------------------*/

/**
 * WHERE a document uses its variables, and the document with their values written in (docs/library/variables.md).
 *
 * - A binding may stand wherever a STATIC value is written: a node attribute, an item of a pair or a list, a part of a
 *   `transform` record, a `style` declaration, a player effect's setting. Never inside `animate` / `keyframes`, never
 *   in `meta`, never in the keys that name or structure a node (`type`, `id`, `children`).
 * - Resolving writes each binding's current value in its place, in a COPY that shares every untouched subtree. Every
 *   stage after it — validation, materialization, rendering — sees plain values, as before variables existed.
 */

import { PxVariableType } from '../format/PxAnimatorConstants';
import type { PxDocument, PxNode, PxVariableDefinition } from '../format/PxAnimatorTypes';
import { isBindingText, PxVariableBinding, type PxVariableReader, type PxVariableValue } from './PxFormula';

/** Node keys a binding never stands in. @internal */
const STRUCTURAL_NODE_KEYS: ReadonlySet<string> = new Set(['type', 'id', 'children', 'animate', 'meta', 'animator', 'domType']);
/** Keys of an animated value — inside them a string is a keyframe value, not a binding. */
const ANIMATED_VALUE_KEYS: ReadonlySet<string> = new Set(['keyframes', 'loop']);
const EFFECTS_KEY = 'effects';
const STYLE_KEY = 'style';
const ANIMATE_KEY = 'animate';
const META_KEY = 'meta';
const ID_KEY = 'id';
const CHILDREN_KEY = 'children';

/** The `meta` key the player marks a node with when its bound values are written straight to its element (§7) —
 *  in memory only, never written to a file. @internal */
export const PX_VARIABLE_NODE_MARK = 'pxVariableNode';

/** CSS properties a variable can be delivered to as a CSS custom property (§8): presentation properties whose value is
 *  one whole value. camelCase, as the node's keys. @internal */
export const PX_CSS_DELIVERABLE_PROPERTIES: ReadonlySet<string> = new Set([
    'fill', 'stroke', 'opacity', 'fillOpacity', 'strokeOpacity', 'strokeWidth', 'stopColor', 'stopOpacity', 'color',
]);

/** One place a document reads its variables. @public @advanced */
export interface PxBindingSite {
    /** Child indexes from the root to the node. */
    readonly nodePath: ReadonlyArray<number>;
    /** Keys from the node to the value: `['fill']`, `['transform', 'translate', 0]`, `['style', 'fill']`,
     *  `['effects', 'repeater', 'copies']`. */
    readonly keyPath: ReadonlyArray<string | number>;
    /** The text as written. */
    readonly text: string;
    /** The parsed binding; `undefined` when the text does not parse (then `error` says why). */
    readonly binding: PxVariableBinding | undefined;
    readonly error?: string;
}

/** True when a site's value can be written straight to the rendered element: on a node with no effects, outside
 *  `effects`. Everything else is rebuilt (§7). @internal */
export function isDirectWriteSite(site: PxBindingSite, node: { readonly effects?: unknown }): boolean {
    return node.effects === undefined && site.keyPath[0] !== EFFECTS_KEY;
}

/** A stable key for a node path — `""` for the root, `"0/2"` for the root's first child's third child. @internal */
export function nodeKeyOf(nodePath: ReadonlyArray<number>): string {
    return nodePath.join('/');
}

/** Every binding in the document, in tree order. @public @advanced */
export function collectBindingSites(root: PxNode): Array<PxBindingSite> {
    const sites: Array<PxBindingSite> = [];
    const walkValue = (value: unknown, nodePath: ReadonlyArray<number>, keyPath: Array<string | number>): void => {
        if (isBindingText(value)) {
            const parsed = PxVariableBinding.parse(value);
            sites.push({ nodePath, keyPath: [...keyPath], text: value, binding: parsed.binding, error: parsed.error });
            return;
        }
        if (Array.isArray(value)) {
            value.forEach((item, i) => walkValue(item, nodePath, [...keyPath, i]));
            return;
        }
        if (isRecord(value)) {
            for (const key of Object.keys(value)) {
                if (ANIMATED_VALUE_KEYS.has(key)) continue;
                walkValue(value[key], nodePath, [...keyPath, key]);
            }
        }
    };
    const walkNode = (node: PxNode, nodePath: Array<number>): void => {
        const record: Record<string, unknown> = node;
        for (const key of Object.keys(record)) {
            if (STRUCTURAL_NODE_KEYS.has(key)) continue;
            walkValue(record[key], nodePath, [key]);
        }
        node.children?.forEach((child, i) => walkNode(child, [...nodePath, i]));
    };
    walkNode(root, []);
    return sites;
}

/** The node at a path, in a document (`undefined` when the path leads nowhere). @internal */
export function nodeAtPath(root: PxNode, nodePath: ReadonlyArray<number>): PxNode | undefined {
    let node: PxNode | undefined = root;
    for (const index of nodePath) node = node?.children?.[index];
    return node;
}

/** What {@link resolveVariableBindings} needs to know besides the current values. @internal */
export interface PxResolveBindingsOptions {
    /** The current value of a name. */
    readonly read: PxVariableReader;
    /** The custom property a variable is delivered to as CSS (`'--bg'`), or `undefined` for code delivery (§8). */
    readonly cssPropertyOf?: (name: string) => string | undefined;
    /** The animated default of a variable when that is its current value (§5) — `{ keyframes, … }`. */
    readonly animatedValueOf?: (name: string) => Record<string, unknown> | undefined;
    /** Mark the nodes whose bound values are written straight to their element: an `id` (when absent) and
     *  `meta.pxVariableNode` — so the player finds the rendered element after materialization (§7). */
    readonly markDirectWriteNodes?: boolean;
}

/**
 * The document with every binding replaced by its current value — a copy that shares every untouched subtree; the
 * original is never mutated. A binding whose value is `undefined` (an unknown name, a formula over a non-number) leaves
 * its place ABSENT: the attribute reads as if it were not written. @internal
 */
export function resolveVariableBindings(doc: PxDocument, sites: ReadonlyArray<PxBindingSite>, options: PxResolveBindingsOptions): PxDocument {
    if (sites.length === 0) return doc;
    const copy = new CopyAlongPaths(doc);
    for (const site of sites) {
        const node = copy.nodeAt(site.nodePath);
        if (!node) continue;
        const name = site.binding && !site.binding.isFormula ? site.binding.names[0] : undefined;

        // an animated default: the whole attribute (or effect setting) becomes that animation
        const animated = name !== undefined ? options.animatedValueOf?.(name) : undefined;
        if (animated && site.keyPath.length === 1) {
            const key = String(site.keyPath[0]);
            const animate = copy.own(isRecord(node[ANIMATE_KEY]) ? node[ANIMATE_KEY] : {});
            animate[key] = animated;
            node[ANIMATE_KEY] = animate;
            const first = firstKeyframeValue(animated);
            if (first === undefined) delete node[key];
            else node[key] = first;
            continue;
        }
        if (animated && site.keyPath[0] === EFFECTS_KEY) {
            copy.setAt(node, site.keyPath, animated);
            continue;
        }

        const value = site.binding?.evaluate(options.read);

        // CSS delivery: `fill: var(--bg, value)` in the style, the attribute itself dropped
        const cssProperty = name !== undefined ? options.cssPropertyOf?.(name) : undefined;
        const cssKey = cssDeliverableKey(site.keyPath);
        if (cssProperty !== undefined && cssKey !== undefined) {
            const style = copy.own(isRecord(node[STYLE_KEY]) ? node[STYLE_KEY] : {});
            style[cssKey] = cssVarValue(cssProperty, value);
            node[STYLE_KEY] = style;
            if (site.keyPath[0] !== STYLE_KEY) delete node[cssKey];
            continue;
        }

        if (value === undefined) copy.deleteAt(node, site.keyPath);
        else copy.setAt(node, site.keyPath, value);

        if (options.markDirectWriteNodes && isDirectWriteSite(site, node)) {
            if (typeof node[ID_KEY] !== 'string' || !node[ID_KEY]) node[ID_KEY] = 'pxv-' + (nodeKeyOf(site.nodePath).replace(/\//g, '-') || 'root');
            const meta = copy.own(isRecord(node[META_KEY]) ? node[META_KEY] : {});
            meta[PX_VARIABLE_NODE_MARK] = nodeKeyOf(site.nodePath);
            node[META_KEY] = meta;
        }
    }
    return copy.root;
}

/** The node key a site lives at when it can be delivered as CSS: a whole top-level attribute, or a whole `style`
 *  declaration, of a property CSS can carry. @internal */
export function cssDeliverableKey(keyPath: ReadonlyArray<string | number>): string | undefined {
    if (keyPath.length === 1 && PX_CSS_DELIVERABLE_PROPERTIES.has(String(keyPath[0]))) return String(keyPath[0]);
    if (keyPath.length === 2 && keyPath[0] === STYLE_KEY && PX_CSS_DELIVERABLE_PROPERTIES.has(String(keyPath[1]))) return String(keyPath[1]);
    return undefined;
}

/** `var(--bg, #2a7fff)` — the value from code (or the file) as the fallback the page's CSS can override. @internal */
export function cssVarValue(cssProperty: string, fallback: PxVariableValue | undefined): string {
    return fallback === undefined ? 'var(' + cssProperty + ')' : 'var(' + cssProperty + ', ' + String(fallback) + ')';
}

/** The first keyframe's value of an animated value. @internal */
export function firstKeyframeValue(animated: Record<string, unknown>): PxVariableValue | undefined {
    const keyframes = animated['keyframes'];
    if (!Array.isArray(keyframes) || keyframes.length === 0) return undefined;
    const first: unknown = keyframes[0];
    const value = isRecord(first) ? first['value'] : undefined;
    return isVariableValue(value) ? value : undefined;
}

/** True for a value a variable can hold at all (any type). @internal */
export function isVariableValue(value: unknown): value is PxVariableValue {
    return typeof value === 'number' || typeof value === 'string' || typeof value === 'boolean'
        || (Array.isArray(value) && value.every(item => typeof item === 'number'));
}

/** True when `value` fits a variable of `type`. A vector has 2 numbers (3 kept open for a later 3D vector). @public */
export function variableValueFits(type: PxVariableType, value: unknown): boolean {
    switch (type) {
        case PxVariableType.number: return typeof value === 'number' && Number.isFinite(value);
        case PxVariableType.vector: return Array.isArray(value) && (value.length === 2 || value.length === 3) && value.every(isFiniteNumber);
        case PxVariableType.numberList: return Array.isArray(value) && value.every(isFiniteNumber);
        case PxVariableType.boolean: return typeof value === 'boolean';
        case PxVariableType.color:
        case PxVariableType.string:
        case PxVariableType.image:
        case PxVariableType.path: return typeof value === 'string';
    }
}

/** True when a `defaultValue` (or a variant's value) is animated: `{ keyframes: […] }`. @internal */
export function isAnimatedVariableValue(value: unknown): value is Record<string, unknown> {
    return isRecord(value) && Array.isArray(value['keyframes']);
}

/** True when a declaration's default — plain or animated — fits its type. @internal */
export function variableDefaultFits(definition: PxVariableDefinition): boolean {
    const value = definition.defaultValue;
    if (isAnimatedVariableValue(value)) {
        const keyframes = value['keyframes'];
        return Array.isArray(keyframes) && keyframes.every(kf => isRecord(kf) && variableValueFits(definition.type, kf['value']));
    }
    return variableValueFits(definition.type, value);
}

function isFiniteNumber(value: unknown): boolean {
    return typeof value === 'number' && Number.isFinite(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

// ── PREDEFINED VARIABLES ─────────────────────────────────────────────────────────────────────────

/** The variables the player provides (§5): every name starts with `player.`, so none can collide with a declared one
 *  (a declared name has no dot). @public */
export const PxPredefinedVariable = {
    pointer:                  'player.pointer',
    pointerX:                 'player.pointer.x',
    pointerY:                 'player.pointer.y',
    pointerOver:              'player.pointer.over',
    pointerDown:              'player.pointer.down',
    playbackCurrentTime:      'player.playback.currentTime',
    playbackCurrentProgress:  'player.playback.currentProgress',
    playbackIterationProgress: 'player.playback.iterationProgress',
    prefersReducedMotion:     'player.prefers.reducedMotion',
    prefersColorScheme:       'player.prefers.colorScheme',
} as const;
export type PxPredefinedVariable = typeof PxPredefinedVariable[keyof typeof PxPredefinedVariable];

/** The prefix every predefined name starts with. @internal */
export const PX_PREDEFINED_PREFIX = 'player.';

/** One predefined variable: its type and its value before the player first sets it. @internal */
export interface PxPredefinedDefinition {
    readonly name: PxPredefinedVariable;
    readonly type: PxVariableType;
    /** The default — the pointer's is the centre of the `viewBox`. */
    readonly defaultValue: (viewBoxCenter: [number, number]) => PxVariableValue;
}

/** The table of predefined variables. @internal */
export const PX_PREDEFINED_VARIABLES: ReadonlyArray<PxPredefinedDefinition> = [
    { name: PxPredefinedVariable.pointer, type: PxVariableType.vector, defaultValue: c => [c[0], c[1]] },
    { name: PxPredefinedVariable.pointerX, type: PxVariableType.number, defaultValue: c => c[0] },
    { name: PxPredefinedVariable.pointerY, type: PxVariableType.number, defaultValue: c => c[1] },
    { name: PxPredefinedVariable.pointerOver, type: PxVariableType.boolean, defaultValue: () => false },
    { name: PxPredefinedVariable.pointerDown, type: PxVariableType.boolean, defaultValue: () => false },
    { name: PxPredefinedVariable.playbackCurrentTime, type: PxVariableType.number, defaultValue: () => 0 },
    { name: PxPredefinedVariable.playbackCurrentProgress, type: PxVariableType.number, defaultValue: () => 0 },
    { name: PxPredefinedVariable.playbackIterationProgress, type: PxVariableType.number, defaultValue: () => 0 },
    { name: PxPredefinedVariable.prefersReducedMotion, type: PxVariableType.boolean, defaultValue: () => false },
    { name: PxPredefinedVariable.prefersColorScheme, type: PxVariableType.string, defaultValue: () => 'light' },
];

/** The predefined definition of a name, or `undefined`. @internal */
export function predefinedVariableOf(name: string): PxPredefinedDefinition | undefined {
    return PX_PREDEFINED_VARIABLES.find(p => p.name === name);
}

/** True when a name is one of the player's (`player.…`). @public @advanced */
export function isPredefinedVariableName(name: string): boolean {
    return predefinedVariableOf(name) !== undefined;
}

/** The centre of a document's `viewBox` (`[0, 0]` without one) — the pointer's default. @internal */
export function viewBoxCenterOf(root: PxNode): [number, number] {
    const viewBox = root['viewBox'];
    const parts = typeof viewBox === 'string' ? viewBox.trim().split(/[\s,]+/).map(Number)
        : Array.isArray(viewBox) ? viewBox.map(Number) : [];
    if (parts.length !== 4 || parts.some(n => !Number.isFinite(n))) return [0, 0];
    return [parts[0] + parts[2] / 2, parts[1] + parts[3] / 2];
}

// ── COPY ALONG PATHS ─────────────────────────────────────────────────────────────────────────────

/** Copies only the objects on the paths it writes — every other subtree stays shared with the original. A copy is
 *  made once per object (the set below is local to one resolution, not a cache). */
class CopyAlongPaths {
    readonly root: PxDocument;
    private readonly owned = new Set<object>();

    constructor(doc: PxDocument) {
        this.root = this.own(doc);
    }

    own<T extends object>(obj: T): T {
        if (this.owned.has(obj)) return obj;
        const copy: T = Array.isArray(obj) ? Object.assign([], obj) : { ...obj };
        this.owned.add(copy);
        return copy;
    }

    nodeAt(nodePath: ReadonlyArray<number>): Record<string, unknown> | undefined {
        let node: Record<string, unknown> = this.root;
        for (const index of nodePath) {
            const children = node[CHILDREN_KEY];
            if (!Array.isArray(children)) return undefined;
            const ownedChildren: Array<unknown> = this.own(children);
            node[CHILDREN_KEY] = ownedChildren;
            const child: unknown = ownedChildren[index];
            if (!isRecord(child)) return undefined;
            const ownedChild = this.own(child);
            ownedChildren[index] = ownedChild;
            node = ownedChild;
        }
        return node;
    }

    setAt(node: Record<string, unknown>, keyPath: ReadonlyArray<string | number>, value: unknown): void {
        const parent = this.parentOf(node, keyPath);
        if (parent) writeKey(parent, keyPath[keyPath.length - 1], value);
    }

    /** Removes the value. An ITEM is not removed from its list (that would shift the others): the whole top-level
     *  attribute goes, so the place reads as if it were not written. */
    deleteAt(node: Record<string, unknown>, keyPath: ReadonlyArray<string | number>): void {
        if (keyPath.some(k => typeof k === 'number')) {
            delete node[String(keyPath[0])];
            return;
        }
        const parent = this.parentOf(node, keyPath);
        if (parent && !Array.isArray(parent)) delete parent[String(keyPath[keyPath.length - 1])];
    }

    private parentOf(node: Record<string, unknown>, keyPath: ReadonlyArray<string | number>): Record<string, unknown> | Array<unknown> | undefined {
        let cur: Record<string, unknown> | Array<unknown> = node;
        for (let i = 0; i < keyPath.length - 1; i++) {
            const key = keyPath[i];
            const next: unknown = Array.isArray(cur) ? cur[Number(key)] : cur[String(key)];
            if (!(isRecord(next) || Array.isArray(next))) return undefined;
            const owned: Record<string, unknown> | Array<unknown> = this.own(next);
            writeKey(cur, key, owned);
            cur = owned;
        }
        return cur;
    }
}

function writeKey(target: Record<string, unknown> | Array<unknown>, key: string | number, value: unknown): void {
    if (Array.isArray(target)) target[Number(key)] = value;
    else target[String(key)] = value;
}

