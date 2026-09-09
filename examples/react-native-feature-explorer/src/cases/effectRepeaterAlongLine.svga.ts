/*---------------------------------------------------------------------------------------
 * Copyright (c) Pixodesk LTD.
 * Licensed under the MIT License. See the LICENSE file in the project root for details.
 *---------------------------------------------------------------------------------------*/

import type { SvgaCaseJson } from '../caseTypes';

export const effectRepeaterAlongLine: SvgaCaseJson = {
    "type": "svg",
    "fill": "none",
    "viewBox": "0 0 200 200",
    "animator": {
        "timeline": {
            "mode": "auto",
            "duration": 1000,
            "trigger": {
                "startOn": "load",
                "outAction": "pause"
            },
            "direction": "normal"
        }
    },
    "children": [
        {
            "type": "ellipse",
            "fill": "#e66633",
            "rx": 9,
            "ry": 9,
            "stroke": "none",
            "transform": "translate(40,100)",
            "effects": {
                "repeater": {
                    "copies": 5,
                    "translate": [
                        30,
                        0
                    ]
                }
            }
        }
    ]
};
