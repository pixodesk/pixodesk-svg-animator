/*---------------------------------------------------------------------------------------
 * Copyright (c) Pixodesk LTD.
 * Licensed under the MIT License. See the LICENSE file in the project root for details.
 *---------------------------------------------------------------------------------------*/

import type { SvgaCaseJson } from '../caseTypes';

export const attrNumberDashoffset: SvgaCaseJson = {
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
            "type": "rect",
            "fill": "none",
            "height": 40,
            "stroke": "#cc334d",
            "strokeDasharray": "6,3",
            "strokeWidth": 3,
            "transform": "translate(122,80)",
            "width": 56,
            "animate": {
                "strokeDashoffset": {
                    "keyframes": [
                        {
                            "time": 0,
                            "value": 0
                        },
                        {
                            "time": 1000,
                            "value": 15
                        }
                    ]
                }
            }
        },
        {
            "type": "rect",
            "fill": "none",
            "height": 40,
            "stroke": "#1a66cc",
            "strokeDasharray": "6,3",
            "strokeDashoffset": 6,
            "strokeWidth": 3,
            "transform": "translate(22,80)",
            "width": 56
        }
    ]
};
