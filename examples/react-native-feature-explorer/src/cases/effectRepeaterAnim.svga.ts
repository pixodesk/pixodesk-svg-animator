/*---------------------------------------------------------------------------------------
 * Copyright (c) Pixodesk LTD.
 * Licensed under the MIT License. See the LICENSE file in the project root for details.
 *---------------------------------------------------------------------------------------*/

import type { SvgaCaseJson } from '../caseTypes';

export const effectRepeaterAnim: SvgaCaseJson = {
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
            "type": "ellipse",
            "fill": "#33b399",
            "rx": 6,
            "ry": 6,
            "stroke": "none",
            "transform": "translate(120,100)",
            "effects": {
                "repeater": {
                    "copies": 4,
                    "translate": {
                        "loop": {
                            "alternate": true
                        },
                        "keyframes": [
                            {
                                "time": 0,
                                "value": [
                                    12,
                                    0
                                ]
                            },
                            {
                                "time": 1000,
                                "value": [
                                    22,
                                    0
                                ]
                            }
                        ]
                    }
                }
            }
        },
        {
            "type": "ellipse",
            "fill": "#998033",
            "rx": 6,
            "ry": 6,
            "stroke": "none",
            "transform": "translate(20,100)",
            "effects": {
                "repeater": {
                    "copies": 4,
                    "translate": [
                        18,
                        0
                    ]
                }
            }
        }
    ]
};
