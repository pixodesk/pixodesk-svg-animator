import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');

/** Short package names used in markers (`pkg=web`) and in section headings (`## @pixodesk/svg-animator-web`). */
export const PKG = { core: 'core', web: 'web', react: 'react', vue: 'vue', rn: 'rn' } as const;
export type Pkg = (typeof PKG)[keyof typeof PKG];
export const ALL_PKGS: ReadonlyArray<Pkg> = [PKG.web, PKG.react, PKG.vue, PKG.rn, PKG.core];

export const PKG_NPM_NAME: Record<Pkg, string> = {
    core: '@pixodesk/svg-animator-core',
    web: '@pixodesk/svg-animator-web',
    react: '@pixodesk/svg-animator-react',
    vue: '@pixodesk/svg-animator-vue',
    rn: '@pixodesk/svg-animator-rn',
};

/**
 * The declaration files each package ships — the source of truth for the API docs.
 *
 * The MAIN entry comes first: type text is printed against it. A package may ship further entry
 * points — `@pixodesk/svg-animator-core/internal`, which carries the `@internal` names the editor
 * and the sibling packages need (API-SURFACE-REVIEW.md §4) — and the exports of ALL of them are
 * what the package exports, so the reference may still document an internal name and the audience
 * checks still see its tag.
 */
const dts = (pkg: string, entry: string): string =>
    resolve(REPO_ROOT, `packages/svg-animator-${pkg}/dist/${entry}.d.ts`);

export const PKG_DTS: Record<Pkg, ReadonlyArray<string>> = {
    core: [dts('core', 'index'), dts('core', 'internal')],
    web: [dts('web', 'index'), dts('web', 'internal')],
    react: [dts('react', 'index')],
    vue: [dts('vue', 'index')],
    rn: [dts('rn', 'index')],
};

/** The public markdown files, relative to the repo root. Internal notes (reviews, plans, dev-docs) are not listed. */
export const DOC_FILES: ReadonlyArray<string> = [
    'README.md',
    'API-SCHEMA.md',
    'SCHEMA.md',
    'docs/format/README.md',
    'docs/library/README.md',
    'docs/library/installation.md',
    'docs/library/minification.md',
    'docs/library/playback-and-triggers.md',
    'docs/library/react-native.md',
    'docs/library/react.md',
    'docs/library/troubleshooting.md',
    'docs/library/vue.md',
    'docs/library/web-player.md',
    'packages/svg-animator-core/README.md',
    'packages/svg-animator-web/README.md',
    'packages/svg-animator-react/README.md',
    'packages/svg-animator-vue/README.md',
    'packages/svg-animator-rn/README.md',
];

export function pkgFromText(text: string): Pkg | undefined {
    const m = /svg-animator-(core|web|react|vue|rn)\b/.exec(text);
    return m ? (m[1] as Pkg) : undefined;
}
