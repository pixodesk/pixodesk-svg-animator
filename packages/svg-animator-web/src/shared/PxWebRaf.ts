/*---------------------------------------------------------------------------------------
 * Copyright (c) Pixodesk LTD.
 * Licensed under the MIT License. See the LICENSE file in the project root for details.
 *---------------------------------------------------------------------------------------*/

/** The one frame scheduler the web player hands core's executor and watchers. @internal */
export const webRaf = (cb: () => void): void => { window.requestAnimationFrame(cb); };
