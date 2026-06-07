/*---------------------------------------------------------------------------------------
 * Copyright (c) Pixodesk LTD.
 * Licensed under the MIT License. See the LICENSE file in the project root for details.
 *---------------------------------------------------------------------------------------*/

import { getDefs, INTERNAL_ATTRS, TEXT_ATTR, TEXT_CONTENT_ATTR, type PxAnimatedSvgDocument, type PxDefs, type PxNode } from './PxAnimatorTypes';
import { camelCaseToKebabWordIfNeeded, COLOUR_ATTR_NAMES, composeTransformParts, kebabToCamelCaseWord, toRGBA, TRANSFORM_FN_NAMES } from './PxAnimatorUtil';


const SVG_NS = 'http://www.w3.org/2000/svg';

/**
 * Tags that MUST never be created — the only real XSS surfaces in SVG:
 *   - `<script>`       — direct JS execution.
 *   - `<foreignObject>` — embeds arbitrary HTML (incl. `<script>`, `<iframe>`).
 *
 * Everything else (shape elements, gradients, patterns, markers, filters
 * including `feComponentTransfer` / `feFuncA` / `feFlood` / `feComposite` /
 * `feImage`, SMIL `<animate>` family, `<a>` hyperlinks, …) is allowed. URL
 * sanitisation in `sanitiseAttributeValue` blocks `javascript:` / external
 * refs on `href` / `src` / `mask` / `marker*`.
 */
const DISALLOWED_SVG_TAGS_LOWER = new Set([
    'script',
    'foreignobject',
]);


/**
 * URL-valued attributes that must reference an internal `#id` / `url(#id)`
 * only — never an external URL, `javascript:`, etc. Values for these names
 * are sanitised in `sanitiseAttributeValue`; non-internal refs are dropped.
 *
 * Exception: image-ref attributes (`href` / `xlink:href` / `src`) ALSO
 * accept `data:image/…` URIs — base64 raster (`image/png`, `image/jpeg`,
 * `image/gif`, `image/webp`, `image/bmp`) and `image/svg+xml` (base64 or
 * URL-encoded). Browsers render any image referenced from `<image>` in
 * SVG "secure static mode": scripts inside the referenced SVG do NOT
 * execute, external resources don't load, and interaction is disabled —
 * the same sandbox `<img src=…svg>` uses. The `image/svg+xml` form is
 * therefore safe as an image source even though a top-level SVG document
 * with the same bytes could embed scripts.
 *
 * Stored lowercased so `sanitiseAttributeValue`'s `name.toLowerCase()`
 * lookup matches regardless of input casing (`href` / `xlink:href` /
 * `clipPath` / `clip-path` all hit the same entry).
 */
const URL_VALUE_ATTRS_LOWER = new Set([
    'href',          // <use>, <image>
    'xlink:href',    // legacy <use>
    'src',           // <image>
    'filter',        // url(#filterId)
    'clippath',      // clip-path="url(#…)"
    'mask',          // url(#maskId)
    'markerstart',   // marker-start="url(#…)"
    'markermid',     // marker-mid="url(#…)"
    'markerend',     // marker-end="url(#…)"
]);

/** Attrs where a `data:image/…` URI is a legitimate value (i.e. the SVG
 *  element actually renders the bytes — `<image>`). Other URL-valued
 *  attrs ignore data URIs at the browser layer, so widening the allow-
 *  list there would be cargo-culted and noisy. */
const IMAGE_REF_ATTRS_LOWER = new Set(['href', 'xlink:href', 'src']);

/** Matches `data:image/{png|jpeg|jpg|gif|webp|bmp};base64,<payload>`.
 *  Rejects any non-base64-encoded raster form. */
const DATA_RASTER_IMAGE_RE = /^data:image\/(?:png|jpe?g|gif|webp|bmp);base64,/i;

/** Matches `data:image/svg+xml[;params],<payload>` — base64
 *  (`;base64,`), `;utf8,` / `;charset=UTF-8,`, and bare `,` (URL-encoded)
 *  forms. Safe because the browser sandboxes any SVG referenced from an
 *  image source (no scripts, no external loads, no interaction). */
const DATA_SVG_IMAGE_RE = /^data:image\/svg\+xml(?:;[^,]*)?,/i;


/**
 * Attribute-name predicate: anything `name` matching this is dropped at
 * `setAttribute` time. The list is intentionally small — SVG's real
 * security surface is event handlers; every other concerning attribute
 * (URL refs, fill/stroke `url(…)`) is value-sanitised below, not name-
 * blocked. Adding entries here is a structural decision, not whack-a-mole.
 */
function isDangerousAttrName(nameLower: string): boolean {
    // Event handlers — `onclick`, `onload`, `onerror`, `onmouseover`,
    // `onfocus`, `onfocusin`, SMIL `onbegin`/`onend`/`onrepeat`, … and any
    // future one. No legitimate SVG attribute starts with `on`, so this
    // prefix is a safe blanket block.
    if (nameLower.startsWith('on')) return true;
    return false;
}


/**
 * Returns the value to pass to `setAttribute`, or `undefined` to drop the
 * attribute entirely. Dropping leaves the DOM clean — the caller skips
 * `setAttribute` when this returns `undefined`.
 *
 * Three layers:
 *   1. Drop dangerous names (`on*` event handlers).
 *   2. Restrict `url(…)` in `fill` / `stroke` / `stop-color` to
 *      internal `url(#id)` references.
 *   3. Restrict URL-valued attrs (`href`, `src`, `filter`, `clip-path`,
 *      `mask`, `marker*`) to internal `#id` / `url(#id)`. Image-ref
 *      attrs (`href` / `xlink:href` / `src`) additionally accept
 *      `data:image/…` URIs — base64 raster (png/jpeg/gif/webp/bmp) and
 *      `image/svg+xml` (sandboxed by the browser when used as an image
 *      source). Blocks `javascript:` and external URLs.
 * Everything else passes through.
 */
function sanitiseAttributeValue(name: string, value: any): any | undefined {
    const nameLower = name.toLowerCase();

    if (isDangerousAttrName(nameLower)) {
        console.warn('Attribute blocked (event handler / dangerous): ', nameLower);
        return undefined;
    }

    if (nameLower === 'fill' || nameLower === 'stroke' || nameLower === 'stopcolor') {
        const str = String(value);
        if (str.includes('url(') && !/^url\(#[^)]+\)$/.test(str)) {
            console.warn('Attribute "' + nameLower + '" blocked: url() must be internal url(#id), got:', value);
            return undefined;
        }
        return value;
    }

    if (URL_VALUE_ATTRS_LOWER.has(nameLower)) {
        const str = String(value);
        if (str.startsWith('#')) return value;                  // internal fragment ref
        if (/^url\(#[^)]+\)$/.test(str)) return value;           // internal `url(#id)`
        // Image-ref attrs accept `data:image/…` URIs — raster bytes are
        // inert, and SVG referenced via an image source is sandboxed by
        // the browser (no script execution).
        if (IMAGE_REF_ATTRS_LOWER.has(nameLower) && (DATA_RASTER_IMAGE_RE.test(str) || DATA_SVG_IMAGE_RE.test(str))) return value;
        console.warn('Attribute "' + nameLower + '" blocked: must be #id, url(#id), or data:image/… URI, got:', value);
        return undefined;
    }

    return value;
}

function createElement(
    tagName: string,
    normalisedProps: { [k: string]: string },
    style: Record<string, string | number> | undefined,
    children: Array<Element> | undefined,
    textContent?: string
): SVGElement | null {
    if (DISALLOWED_SVG_TAGS_LOWER.has(tagName.toLowerCase())) {
        console.warn('SVG tag blocked (dangerous): ', tagName);
        return null;
    }

    const element = document.createElementNS(SVG_NS, tagName);

    for (const propName in normalisedProps) {
        // `sanitiseAttributeValue` returns `undefined` to mean "do not emit"
        // (whitelist miss, blocked dangerous value, …). Browsers coerce
        // `undefined` to the literal string `"undefined"` at `setAttribute`,
        // which is exactly the bug we keep hitting — skip instead.
        const sanitised = sanitiseAttributeValue(propName, normalisedProps[propName]);
        if (sanitised === undefined) continue;
        element.setAttribute(camelCaseToKebabWordIfNeeded(propName), sanitised);
    }

    // Apply style properties directly (avoids kebab-case issues)
    if (style) {
        for (const styleProp in style) {
            (element as any).style[styleProp] = String(style[styleProp]);
        }
    }

    if (children) {
        for (const child of children) {
            element.appendChild(child);
        }
    }

    if (textContent) element.textContent = textContent;

    return element;
}


/** FIXME - do we need this?
 * Resolves a style reference to an actual style object.
 */
function resolveStyle(
    style: string | Record<string, string | number> | undefined,
    defs?: PxDefs
): Record<string, string | number> | undefined {
    if (!style) return undefined;

    if (typeof style === 'string') {
        // Look up named style in defs
        return defs?.styles?.[style];
    }

    return style;
}


export function getNormalizedProps(props: Record<string, any>) {
    const propsCopy: Record<string, any> = {};

    // Process regular attributes
    for (const rawKey of Object.keys(props)) {
        // Wire-format inputs may use kebab-case SVG attribute names (e.g.
        // `stroke-width`); normalise to camelCase up-front so the whitelist
        // (camelCase) and the `camelCaseToKebabWordIfNeeded` re-conversion
        // at write time both work. `kebabToCamelCaseWord` is a no-op for
        // keys with no `-`, leaving camelCase inputs untouched.
        const key = kebabToCamelCaseWord(rawKey);
        if (INTERNAL_ATTRS.has(key)) continue;
        if (key === 'style') continue;

        let value = props[rawKey];

        if (COLOUR_ATTR_NAMES.has(key) && Array.isArray(value)) {
            propsCopy[key] = toRGBA(value);
        } else if (
            key === 'transform' && value !== null && typeof value === 'object' &&
            !Array.isArray(value) && value.value && typeof value.value === 'object'
        ) {
            // Unified transform structured-static form: { value: PxTransformParts }.
            // Compose into an SVG transform string (no units — SVG transform attribute).
            propsCopy['transform'] = composeTransformParts(value.value, { withUnits: false });
        } else if (TRANSFORM_FN_NAMES.has(key)) {
            if (Array.isArray(value)) {
                if (key === 'translate') value = value.map((v: number) => v + 'px');
                value = value.join(',');
            }
            if (key === 'rotate') value = value + 'deg';
            propsCopy['transform'] = key + '(' + value + ')';
        } else if (value !== undefined && value !== null) {
            propsCopy[key] = String(value);
        }
    }

    return propsCopy;
}

/**
 * Renders a PxNode tree to DOM elements.
 */
export function renderNode(node: PxNode, defs?: PxDefs): Element | null {
    if (!node) return null;

    const { type, children, style, ...props } = node;

    // Extract defs from root svg node
    const nodeDefs = getDefs(node as PxAnimatedSvgDocument) || defs;

    // Resolve style reference
    const resolvedStyle = resolveStyle(style, nodeDefs);

    // Process children
    let childElements: Array<Element> | undefined;
    if (children) {
        for (const ch of children) {
            const child = renderNode(ch, nodeDefs);
            if (child) {
                if (!childElements) childElements = [];
                childElements.push(child);
            }
        }
    }

    return createElement(
        type || 'g',
        getNormalizedProps(props),
        resolvedStyle,
        childElements,
        props[TEXT_ATTR] || props[TEXT_CONTENT_ATTR]
    );
}