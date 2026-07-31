/*---------------------------------------------------------------------------------------
 * Copyright (c) Pixodesk LTD.
 * Licensed under the MIT License. See the LICENSE file in the project root for details.
 *---------------------------------------------------------------------------------------*/

import type { SvgaCaseJson } from '../caseTypes';

export const effectRepeaterCombined: SvgaCaseJson = {
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
            "fill": "#cc4d80",
            "height": 15,
            "stroke": "none",
            "transform": "translate(100,100)",
            "width": 15,
            "effects": {
                "repeater": {
                    "copies": 12,
                    "translate": [
                        5,
                        0
                    ],
                    "rotate": 30,
                    "scale": [
                        88,
                        88
                    ]
                }
            }
        }
    ]
};
