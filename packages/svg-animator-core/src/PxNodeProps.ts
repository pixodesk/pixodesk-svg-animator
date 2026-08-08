/*---------------------------------------------------------------------------------------
 * Copyright (c) Pixodesk LTD.
 * Licensed under the MIT License. See the LICENSE file in the project root for details.
 *---------------------------------------------------------------------------------------*/

import { type PxDefs } from './PxAnimatorTypes';
import { INTERNAL_ATTRS } from './PxAnimatorConstants';
import { COLOUR_ATTR_NAMES, composeTransformParts, kebabToCamelCaseWord, toRGBA, TRANSFORM_FN_NAMES } from './PxAnimatorUtil';


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
export const DISALLOWED_SVG_TAGS_LOWER = new Set([
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

/** CSS-only properties that are NOT SVG presentation attributes — the browser
 *  ignores them via `setAttribute`, so they must be applied through `element.style`.
 *  Keyed camelCase to match the normalised prop names (`element.style.mixBlendMode`). */
export const CSS_ONLY_STYLE_PROPS = new Set<string>(['mixBlendMode', 'isolation']);

/** Matches `data:image/{png|jpeg|jpg|gif|webp|bmp};base64,<payload>`.
 *  Rejects any non-base64-encoded raster form. */
const DATA_RASTER_IMAGE_RE = /^data:image\/(?:png|jpe?g|gif|webp|bmp);base64,/i;

/** Matches `data:image/svg+xml[;params],<payload>` — base64
 *  (`;base64,`), `;utf8,` / `;charset=UTF-8,`, and bare `,` (URL-encoded)
 *  forms. Safe because the browser sandboxes any SVG referenced from an
 *  image source (no scripts, no external loads, no interaction). */
const DATA_SVG_IMAGE_RE = /^data:image\/svg\+xml(?:;[^,]*)?,/i;

/** Content-sniff fallback for `data:image/*;base64,…` URIs whose declared
 *  subtype isn't a known raster type — e.g. `data:image/undefined;base64,<png>`,
 *  which some Lottie exporters emit. The browser (and lottie-web) render these by
 *  sniffing the leading bytes; we mirror that by matching the base64 payload
 *  against common raster magic numbers (PNG `\x89PNG`, JPEG `\xFF\xD8\xFF`, GIF
 *  `GIF8`, WebP/RIFF, BMP `BM`). Accepting on real image bytes keeps the
 *  sanitiser's safety guarantee — raster bytes are inert — without trusting the
 *  (here bogus) subtype, so the image renders instead of being dropped. */
const DATA_IMAGE_BASE64_PAYLOAD_RE = /^data:image\/[^;,]*;base64,([A-Za-z0-9+/]{8})/i;
const BASE64_RASTER_MAGICS = ['iVBORw0K', '/9j/', 'R0lGOD', 'UklGR', 'Qk'];
function isContentSniffedRasterImage(str: string): boolean {
    const m = DATA_IMAGE_BASE64_PAYLOAD_RE.exec(str);
    return !!m && BASE64_RASTER_MAGICS.some(magic => m[1].startsWith(magic));
}


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
export function sanitiseAttributeValue(name: string, value: any): any | undefined {
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
        if (IMAGE_REF_ATTRS_LOWER.has(nameLower) && (DATA_RASTER_IMAGE_RE.test(str) || DATA_SVG_IMAGE_RE.test(str) || isContentSniffedRasterImage(str))) return value;
        console.warn('Attribute "' + nameLower + '" blocked: must be #id, url(#id), or data:image/… URI, got:', value);
        return undefined;
    }

    return value;
}

/** FIXME - do we need this?
 * Resolves a style reference to an actual style object.
 */
export function resolveStyle(
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
            !Array.isArray(value) && !value.keyframes && !value.kfs
        ) {
            // Unified transform static record — bare `{translate, rotate, …}`
            // (canonical) or the legacy `{value: PxTransformParts}` wrapper.
            // Compose into an SVG transform string (no units — SVG transform attribute).
            const parts = value.value && typeof value.value === 'object' ? value.value : value;
            propsCopy['transform'] = composeTransformParts(parts, { withUnits: false });
        } else if (TRANSFORM_FN_NAMES.has(key)) {
            if (Array.isArray(value)) {
                if (key === 'translate') value = value.map((v: number) => v + 'px');
                value = value.join(',');
            }
            if (key === 'rotate') value = value + 'deg';
            propsCopy['transform'] = key + '(' + value + ')';
        } else if (Array.isArray(value)) {
            // Raw-array STATIC form of number-list attributes — `strokeDasharray: [16, 16]`
            // (the wire's canonical static shape; the string form "16,16" is also accepted
            // and passes through the String() branch below). SVG list attributes take the
            // comma-separated string. Colour arrays were already handled above.
            propsCopy[key] = value.join(',');
        } else if (value !== undefined && value !== null) {
            propsCopy[key] = String(value);
        }
    }

    return propsCopy;
}

