# Next.js — `@pixodesk/svg-animator-react`

[← React](./react.md) · [Contents](../../README.md#documentation) · Next: [Vue →](./vue.md)

The [React component](./react.md) in a Next.js app.

The component renders real SVG markup on the server and starts the animator in an effect on
the client, so it works in the App Router — mark the file that uses it as a client component:

```tsx
'use client';
import { PixodeskSvgAnimator } from '@pixodesk/svg-animator-react';
import animation from './animation.json';

export default function Hero() {
  return <PixodeskSvgAnimator doc={animation} autoplay />;
}
```

JSON imports work out of the box in Next.js; for a CSS-flavor SVG use `@svgr/webpack`.

[← React](./react.md) · [Contents](../../README.md#documentation) · Next: [Vue →](./vue.md)
