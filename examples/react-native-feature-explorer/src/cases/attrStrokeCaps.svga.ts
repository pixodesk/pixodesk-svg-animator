/*---------------------------------------------------------------------------------------
 * Copyright (c) Pixodesk LTD.
 * Licensed under the MIT License. See the LICENSE file in the project root for details.
 *---------------------------------------------------------------------------------------*/

import type { SvgaCaseJson } from '../caseTypes';

export const attrStrokeCaps: SvgaCaseJson = {
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
            "type": "path",
            "d": "M34,62L66,62",
            "fill": "none",
            "stroke": "#333a44",
            "strokeWidth": 14
        },
        {
            "type": "path",
            "d": "M94,62L126,62",
            "fill": "none",
            "stroke": "#333a44",
            "strokeLinecap": "round",
            "strokeWidth": 14
        },
        {
            "type": "path",
            "d": "M154,62L186,62",
            "fill": "none",
            "stroke": "#333a44",
            "strokeLinecap": "square",
            "strokeWidth": 14
        },
        {
            "type": "path",
            "d": "M32,150L50,118L68,150",
            "fill": "none",
            "stroke": "#333a44",
            "strokeWidth": 14
        },
        {
            "type": "path",
            "d": "M92,150L110,118L128,150",
            "fill": "none",
            "stroke": "#333a44",
            "strokeLinejoin": "round",
            "strokeWidth": 14
        },
        {
            "type": "path",
            "d": "M152,150L170,118L188,150",
            "fill": "none",
            "stroke": "#333a44",
            "strokeLinejoin": "bevel",
            "strokeWidth": 14
        }
    ]
};
