// @px-area variables
/*---------------------------------------------------------------------------------------
 * Copyright (c) Pixodesk LTD.
 * Licensed under the MIT License. See the LICENSE file in the project root for details.
 *---------------------------------------------------------------------------------------*/

/**
 * ONE player's variables (docs/library/variables.md) — platform-free: the web
 * player, the components and React Native hold one each and render what it says.
 *
 * Who wins, per variable: the host's value → its `defaultSource` (once the player has a value for it) → the chosen
 * variant → `defaultValue`. A predefined variable (`player.pointer`): the host's value → the player's live value →
 * its predefined default.
 *
 * `set` only stores and marks: nothing is drawn until the platform's next frame, which takes the changes
 * ({@link PxVariablesRuntime.takeChanges}) — many calls between two frames cost one write, nothing queues.
 */

import { PxVariableType } from '../format/PxAnimatorConstants';
import type { PxDocument, PxNode, PxVariableDefinition } from '../format/PxAnimatorTypes';
import { getAnimatorConfig } from '../format/PxAnimatorConstants';
import { PxDocStage } from '../format/PxDocStage';
import { prepareDocument } from '../pipeline/PxPrepareDocument';
import { PxDiagnosticCode } from '../playback/PxDiagnosticCode';
import { PxDiagnosticKind, type PxDiagnostics } from '../playback/PxDiagnostics';
import { deepEquals } from '../util/PxDeepEquals';
import { isVariableName, type PxVariableValue } from './PxFormula';
import {
    collectBindingSites, cssDeliverableKey, firstKeyframeValue, isAnimatedVariableValue, isVariableValue, nodeAtPath,
    predefinedVariableOf, resolveVariableBindings, variableValueFits, viewBoxCenterOf, type PxBindingSite,
} from './PxVariableBindings';

/** The variables options every surface takes — the web player's, and the components' props. @public */
export interface PxVariablesOptions {
    /** Values from the host, by variable name — they win over the file. A predefined one may be given too
     *  (`'player.pointer'`). */
    variables?: Readonly<Record<string, PxVariableValue>>;
    /** A named set of defaults from the file's `definitions.variableVariants`; `null` or left out: the defaults. */
    variant?: string | null;
    /**
     * Deliver variables as CSS custom properties (web only), so the page's stylesheet can set them: `true` — every
     * variable under its own name (`bg` → `--bg`); a map — variable → custom property, `"*"` a pattern for the rest
     * (`{ "*": "card-*", bg: "brand-primary" }`). Without dashes; a leading `--` is dropped. With it on, the page's
     * stylesheet wins, and the value from code or the file is its fallback: `fill: var(--bg, green)`.
     */
    cssVariables?: boolean | Readonly<Record<string, string>>;
}

/** `player.variables` — read and set a player's variables. @public */
export interface PxVariablesApi {
    /** The current value — of a declared variable or a predefined one; `undefined` for an unknown name. */
    get(name: string): PxVariableValue | undefined;
    /** Gives one variable a value; it wins over the file. Shown on the next frame. */
    set(name: string, value: PxVariableValue): void;
    /** Gives the named variables values, in one frame; the others stay. */
    setVariables(values: Readonly<Record<string, PxVariableValue>>): void;
    /** The current value of every declared variable. */
    getAll(): Record<string, PxVariableValue>;
    /** The declared variables' names, in the file's order. */
    getKeys(): Array<string>;
    /** Back to what the file says — one variable, or (no name) all. */
    reset(name?: string): void;
    /** The type, default and description of every declared variable. */
    getDefinitions(): Record<string, PxVariableDefinition>;
    /** Shows a named set of defaults; `null`: back to the defaults. */
    setVariant(name: string | null): void;
    /** The variant shown, or `null`. */
    getVariant(): string | null;
    /** The variants the file has. */
    getVariantKeys(): Array<string>;
}

/** What changed since the platform's last frame. @public @advanced */
export interface PxVariableChanges {
    /** The variables whose value changed. */
    readonly names: ReadonlySet<string>;
    /** An animated default was switched on or off — the document's structure changed, it is built again. */
    readonly structural: boolean;
}

const CSS_PATTERN_KEY = '*';
const CSS_NAME_SLOT = '*';

/** One player's variables — see the module comment. @public @advanced */
export class PxVariablesRuntime {

    /** The public `variables` API. */
    readonly api: PxVariablesApi;
    /** Every binding in the document. */
    readonly sites: ReadonlyArray<PxBindingSite>;

    private readonly source: PxDocument;
    private readonly definitions = new Map<string, PxVariableDefinition>();
    private readonly variants = new Map<string, ReadonlyMap<string, unknown>>();
    private readonly host = new Map<string, PxVariableValue>();
    private readonly live = new Map<string, PxVariableValue>();
    private readonly viewBoxCenter: [number, number];
    private readonly cssProperties = new Map<string, string>();
    private readonly used = new Set<string>();
    private variant: string | null = null;

    private readonly pendingNames = new Set<string>();
    private pendingStructural = false;
    private requestFlush: (() => void) | undefined;

    constructor(document: PxDocument, options: PxVariablesOptions | undefined, private readonly diag: PxDiagnostics | undefined) {
        // the version-migrated document: bindings are found on the current wire spelling
        this.source = prepareDocument(document, { stage: PxDocStage.current });
        this.sites = collectBindingSites(this.source);
        this.viewBoxCenter = viewBoxCenterOf(this.source);

        const defs = getAnimatorConfig(this.source)?.definitions;
        for (const [name, definition] of Object.entries(defs?.variables ?? {})) {
            if (isVariableName(name)) this.definitions.set(name, definition);
        }
        for (const [name, values] of Object.entries(defs?.variableVariants ?? {})) {
            this.variants.set(name, new Map(Object.entries(values)));
        }

        for (const site of this.sites) {
            if (!site.binding) {
                diag?.warn(PxDiagnosticKind.document, PxDiagnosticCode.variableBindingInvalid, site.text, site.error);
                continue;
            }
            for (const name of site.binding.names) {
                if (!this.isKnown(name)) diag?.warn(PxDiagnosticKind.document, PxDiagnosticCode.variableUnknown, name);
                this.used.add(name);
            }
        }
        for (const definition of this.definitions.values()) {
            if (definition.defaultSource !== undefined) this.used.add(definition.defaultSource);
        }

        this.setupCss(options?.cssVariables);
        if (options?.variant !== undefined && options.variant !== null) this.applyVariant(options.variant);
        for (const [name, value] of Object.entries(options?.variables ?? {})) this.applyHostValue(name, value);
        this.pendingNames.clear();
        this.pendingStructural = false;

        const runtime = this;
        this.api = {
            get: name => runtime.valueOf(name),
            set: (name, value) => runtime.mutate([name], () => runtime.applyHostValue(name, value)),
            setVariables: values => {
                const names = Object.keys(values);
                runtime.mutate(names, () => { for (const name of names) runtime.applyHostValue(name, values[name]); });
            },
            getAll: () => {
                const all: Record<string, PxVariableValue> = {};
                for (const name of runtime.definitions.keys()) {
                    const value = runtime.valueOf(name);
                    if (value !== undefined) all[name] = value;
                }
                return all;
            },
            getKeys: () => [...runtime.definitions.keys()],
            reset: name => {
                if (name === undefined) runtime.mutate([...runtime.host.keys()], () => runtime.host.clear());
                else runtime.mutate([name], () => runtime.host.delete(name));
            },
            getDefinitions: () => {
                const all: Record<string, PxVariableDefinition> = {};
                for (const [name, definition] of runtime.definitions) all[name] = { ...definition };
                return all;
            },
            setVariant: name => runtime.mutate([...runtime.definitions.keys()], () => runtime.applyVariant(name)),
            getVariant: () => runtime.variant,
            getVariantKeys: () => [...runtime.variants.keys()],
        };
    }

    // ── values ───────────────────────────────────────────────────────────────────────────────────

    /** The current value of a name (animated defaults: their first keyframe's value). */
    valueOf(name: string): PxVariableValue | undefined {
        const hosted = this.host.get(name);
        if (hosted !== undefined) return hosted;
        const definition = this.definitions.get(name);
        if (definition) {
            const sourced = definition.defaultSource !== undefined ? this.live.get(definition.defaultSource) : undefined;
            if (sourced !== undefined) return sourced;
            const fileValue = this.fileValueOf(name, definition);
            if (isAnimatedVariableValue(fileValue)) return firstKeyframeValue(fileValue);
            return isVariableValue(fileValue) ? fileValue : undefined;
        }
        const predefined = predefinedVariableOf(name);
        if (!predefined) return undefined;
        return this.live.get(name) ?? predefined.defaultValue(this.viewBoxCenter);
    }

    /** The animated default when that is the variable's current value, else `undefined`. */
    animatedValueOf(name: string): Record<string, unknown> | undefined {
        if (this.host.has(name)) return undefined;
        const definition = this.definitions.get(name);
        if (!definition) return undefined;
        if (definition.defaultSource !== undefined && this.live.has(definition.defaultSource)) return undefined;
        const fileValue = this.fileValueOf(name, definition);
        return isAnimatedVariableValue(fileValue) ? fileValue : undefined;
    }

    /** The custom property a variable is delivered to as CSS, or `undefined` (code delivery). */
    cssPropertyOf(name: string): string | undefined {
        return this.cssProperties.get(name);
    }

    /** True when a site's value travels as a CSS custom property (§8). */
    isCssSite(site: PxBindingSite): boolean {
        const binding = site.binding;
        if (!binding || binding.isFormula) return false;
        return this.cssPropertyOf(binding.names[0]) !== undefined && cssDeliverableKey(site.keyPath) !== undefined;
    }

    /** True when the document reads a name — through a binding or a `defaultSource`. */
    uses(name: string): boolean {
        return this.used.has(name);
    }

    /** True when the document reads any name starting with `prefix`. */
    usesAnyOf(prefix: string): boolean {
        for (const name of this.used) if (name.startsWith(prefix)) return true;
        return false;
    }

    /** True when the document has bindings or declares variables. */
    hasVariables(): boolean {
        return this.sites.length > 0 || this.definitions.size > 0;
    }

    // ── the document ─────────────────────────────────────────────────────────────────────────────

    /** The document with every binding's current value written in — `markDirectWriteNodes`: the nodes whose bound
     *  values the player writes straight to their element are marked, so it finds them after materialization. */
    resolvedDocument(markDirectWriteNodes: boolean): PxDocument {
        return resolveVariableBindings(this.source, this.sites, {
            read: name => this.valueOf(name),
            cssPropertyOf: name => this.cssPropertyOf(name),
            animatedValueOf: name => this.animatedValueOf(name),
            markDirectWriteNodes,
        });
    }

    /** The source (version-migrated) node at a path. */
    sourceNodeAt(nodePath: ReadonlyArray<number>): PxNode | undefined {
        return nodeAtPath(this.source, nodePath);
    }

    /** The sites that read any of the names. */
    sitesReading(names: ReadonlySet<string>): Array<PxBindingSite> {
        return this.sites.filter(site => site.binding?.names.some(name => names.has(name)));
    }

    // ── the player's sources ─────────────────────────────────────────────────────────────────────

    /** The player's live value of a predefined variable (the pointer moved, the playback advanced). */
    setPredefined(name: string, value: PxVariableValue): void {
        if (deepEquals(this.live.get(name), value)) return;
        this.mutate([name], () => this.live.set(name, value));
    }

    // ── the platform's frame ─────────────────────────────────────────────────────────────────────

    /** The platform asks to be told when there is something to draw; returns the detach. Pending changes ask at once. */
    attach(requestFlush: () => void): () => void {
        this.requestFlush = requestFlush;
        if (this.pendingNames.size || this.pendingStructural) requestFlush();
        return () => { if (this.requestFlush === requestFlush) this.requestFlush = undefined; };
    }

    /** What changed since the last call — the platform's frame takes it and draws. */
    takeChanges(): PxVariableChanges {
        const changes: PxVariableChanges = { names: new Set(this.pendingNames), structural: this.pendingStructural };
        this.pendingNames.clear();
        this.pendingStructural = false;
        return changes;
    }

    // ── internals ────────────────────────────────────────────────────────────────────────────────

    private isKnown(name: string): boolean {
        return this.definitions.has(name) || predefinedVariableOf(name) !== undefined;
    }

    private typeOf(name: string): PxVariableType | undefined {
        return this.definitions.get(name)?.type ?? predefinedVariableOf(name)?.type;
    }

    /** The chosen variant's value, else the declared default. */
    private fileValueOf(name: string, definition: PxVariableDefinition): unknown {
        const fromVariant = this.variant !== null ? this.variants.get(this.variant)?.get(name) : undefined;
        return fromVariant !== undefined ? fromVariant : definition.defaultValue;
    }

    private applyHostValue(name: string, value: PxVariableValue): void {
        const type = this.typeOf(name);
        if (type === undefined) {
            this.diag?.warn(PxDiagnosticKind.usage, PxDiagnosticCode.variableUnknown, name);
            return;
        }
        if (!variableValueFits(type, value)) {
            this.diag?.warn(PxDiagnosticKind.usage, PxDiagnosticCode.variableTypeMismatch, name, type, value);
            return;
        }
        this.host.set(name, value);
    }

    private applyVariant(name: string | null): void {
        if (name !== null && !this.variants.has(name)) {
            this.diag?.warn(PxDiagnosticKind.usage, PxDiagnosticCode.variantUnknown, name);
            return;
        }
        this.variant = name;
    }

    /** Runs a change and marks what it changed: the names given, the declared variables that follow them as their
     *  `defaultSource`, and whether an animated default switched (structure). */
    private mutate(names: ReadonlyArray<string>, change: () => void): void {
        const affected = new Set(names);
        for (const [name, definition] of this.definitions) {
            if (definition.defaultSource !== undefined && affected.has(definition.defaultSource)) affected.add(name);
        }
        const before = new Map<string, { value: PxVariableValue | undefined; animated: boolean }>();
        for (const name of affected) before.set(name, { value: this.valueOf(name), animated: this.animatedValueOf(name) !== undefined });
        change();
        let changed = false;
        for (const name of affected) {
            const was = before.get(name);
            const animated = this.animatedValueOf(name) !== undefined;
            if (was?.animated !== animated) { this.pendingStructural = true; changed = true; }
            if (!deepEquals(was?.value, this.valueOf(name))) { this.pendingNames.add(name); changed = true; }
        }
        if (changed) this.requestFlush?.();
    }

    private setupCss(cssVariables: PxVariablesOptions['cssVariables']): void {
        if (!cssVariables) return;
        const entries = cssVariables === true ? new Map([[CSS_PATTERN_KEY, CSS_NAME_SLOT]]) : new Map(Object.entries(cssVariables));
        const pattern = entries.get(CSS_PATTERN_KEY);
        for (const name of this.definitions.keys()) {
            const named = entries.get(name);
            const property = named !== undefined ? named : pattern !== undefined ? pattern.split(CSS_NAME_SLOT).join(name) : undefined;
            if (property !== undefined && property !== '') this.cssProperties.set(name, '--' + property.replace(/^--/, ''));
        }
    }
}

/**
 * A component's `variables` prop → the runtime, declaratively — ONE rule for React, Vue and React Native: a changed
 * value is set (in one `setVariables`), a name that left the prop goes back to what the file says (`reset`). The
 * compare is per name, so a parent re-rendering with the same values costs nothing.
 * @public @advanced
 */
export function applyVariablesProp(
    api: PxVariablesApi,
    prev: Readonly<Record<string, PxVariableValue>> | undefined,
    next: Readonly<Record<string, PxVariableValue>> | undefined,
): void {
    const before = prev ?? {};
    const after = next ?? {};
    const changed: Record<string, PxVariableValue> = {};
    let any = false;
    for (const [name, value] of Object.entries(after)) {
        const had = Object.prototype.hasOwnProperty.call(before, name) ? before[name] : undefined;
        if (!deepEquals(had, value)) { changed[name] = value; any = true; }
    }
    if (any) api.setVariables(changed);
    for (const name of Object.keys(before)) {
        if (!Object.prototype.hasOwnProperty.call(after, name)) api.reset(name);
    }
}
