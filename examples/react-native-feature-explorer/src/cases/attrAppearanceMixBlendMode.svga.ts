/*---------------------------------------------------------------------------------------
 * Copyright (c) Pixodesk LTD.
 * Licensed under the MIT License. See the LICENSE file in the project root for details.
 *---------------------------------------------------------------------------------------*/

import type { SvgaCaseJson } from '../caseTypes';

export const attrAppearanceMixBlendMode: SvgaCaseJson = {
    "type": "svg",
    "fill": "none",
    "viewBox": "0 0 200 200",
    "animator": {
        "duration": 1000,
        "mode": "auto",
        "direction": "normal",
        "timeline": "time",
        "trigger": {
            "startOn": "load",
            "outAction": "pause"
        }
    },
    "children": [
        {
            "type": "rect",
            "fill": "#ffb300",
            "height": 54,
            "stroke": "none",
            "transform": "translate(6,6)",
            "width": 54
        },
        {
            "type": "ellipse",
            "fill": "#2962ff",
            "mixBlendMode": "multiply",
            "rx": 32,
            "ry": 32,
            "stroke": "none",
            "transform": "translate(50,50)"
        },
        {
            "type": "rect",
            "fill": "#ffb300",
            "height": 54,
            "stroke": "none",
            "transform": "translate(106,6)",
            "width": 54
        },
        {
            "type": "ellipse",
            "fill": "#2962ff",
            "mixBlendMode": "screen",
            "rx": 32,
            "ry": 32,
            "stroke": "none",
            "transform": "translate(150,50)"
        },
        {
            "type": "rect",
            "fill": "#ffb300",
            "height": 54,
            "stroke": "none",
            "transform": "translate(6,106)",
            "width": 54
        },
        {
            "type": "ellipse",
            "fill": "#2962ff",
            "mixBlendMode": "overlay",
            "rx": 32,
            "ry": 32,
            "stroke": "none",
            "transform": "translate(50,150)"
        },
        {
            "type": "rect",
            "fill": "#ffb300",
            "height": 54,
            "stroke": "none",
            "transform": "translate(106,106)",
            "width": 54
        },
        {
            "type": "ellipse",
            "fill": "#2962ff",
            "mixBlendMode": "difference",
            "rx": 32,
            "ry": 32,
            "stroke": "none",
            "transform": "translate(150,150)"
        }
    ]
};
