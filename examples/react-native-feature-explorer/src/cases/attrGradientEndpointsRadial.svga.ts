/*---------------------------------------------------------------------------------------
 * Copyright (c) Pixodesk LTD.
 * Licensed under the MIT License. See the LICENSE file in the project root for details.
 *---------------------------------------------------------------------------------------*/

import type { SvgaCaseJson } from '../caseTypes';

export const attrGradientEndpointsRadial: SvgaCaseJson = {
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
            "rx": 64,
            "ry": 64,
            "stroke": "none",
            "transform": "translate(100,100)",
            "effects": {
                "fillGradient": {
                    "type": "radial",
                    "c": [
                        0,
                        0
                    ],
                    "fp": [
                        -24,
                        -24
                    ],
                    "r": 56,
                    "stops": [
                        {
                            "offset": 0,
                            "color": "#ff0000"
                        },
                        {
                            "offset": 0.5,
                            "color": "#ffff00"
                        },
                        {
                            "offset": 1,
                            "color": "#0000ff"
                        }
                    ],
                    "gradientUnits": "userSpaceOnUse",
                    "spreadMethod": "pad"
                }
            }
        }
    ]
};
