/*---------------------------------------------------------------------------------------
 * Copyright (c) Pixodesk LTD.
 * Licensed under the MIT License. See the LICENSE file in the project root for details.
 *---------------------------------------------------------------------------------------*/

/** The global the `<script>` builds define: one `Pixodesk` namespace for the brand's browser libraries. @public @advanced */
export const PX_PLAYER_GLOBAL = 'Pixodesk.SvgAnimator';

/** The full `<script>` build's member that renders a document into a container (`createSvgAnimationPlayer`). @public @advanced */
export const PX_PLAYER_CREATE = 'create';

/** The member every `<script>` build has that binds a pre-rendered SVG already on the page (`bindSvgAnimationPlayer`) —
 *  what an SVG + JS export calls. @public @advanced */
export const PX_PLAYER_BIND = 'bind';
