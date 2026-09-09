/*---------------------------------------------------------------------------------------
 * Copyright (c) Pixodesk LTD.
 * Licensed under the MIT License. See the LICENSE file in the project root for details.
 *---------------------------------------------------------------------------------------*/

import type { SvgaCaseJson } from '../caseTypes';

export const attrGradientEndpoints: SvgaCaseJson = {
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
            "rx": 35,
            "ry": 35,
            "stroke": "none",
            "transform": "translate(150,100)",
            "effects": {
                "fillGradient": {
                    "type": "radial",
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
                    "spreadMethod": "pad",
                    "center": [
                        0,
                        0
                    ],
                    "radius": 30,
                    "focal": [
                        -13,
                        -13
                    ]
                }
            }
        },
        {
            "type": "ellipse",
            "rx": 35,
            "ry": 35,
            "stroke": "none",
            "transform": "translate(50,100)",
            "effects": {
                "fillGradient": {
                    "type": "linear",
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
                    "spreadMethod": "pad",
                    "start": [
                        -25,
                        -25
                    ],
                    "end": [
                        25,
                        25
                    ]
                }
            }
        }
    ]
};
