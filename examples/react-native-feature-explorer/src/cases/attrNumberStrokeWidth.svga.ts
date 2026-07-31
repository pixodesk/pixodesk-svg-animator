/*---------------------------------------------------------------------------------------
 * Copyright (c) Pixodesk LTD.
 * Licensed under the MIT License. See the LICENSE file in the project root for details.
 *---------------------------------------------------------------------------------------*/

import type { SvgaCaseJson } from '../caseTypes';

export const attrNumberStrokeWidth: SvgaCaseJson = {
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
            "fill": "none",
            "height": 44,
            "stroke": "#cc334d",
            "transform": "translate(128,78)",
            "width": 44,
            "animate": {
                "strokeWidth": {
                    "keyframes": [
                        {
                            "time": 0,
                            "value": 1
                        },
                        {
                            "time": 1000,
                            "value": 16
                        }
                    ]
                }
            }
        },
        {
            "type": "rect",
            "fill": "none",
            "height": 44,
            "stroke": "#1a66cc",
            "strokeWidth": 4,
            "transform": "translate(28,78)",
            "width": 44
        }
    ]
};
