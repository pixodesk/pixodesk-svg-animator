/*---------------------------------------------------------------------------------------
 * Copyright (c) Pixodesk LTD.
 * Licensed under the MIT License. See the LICENSE file in the project root for details.
 *---------------------------------------------------------------------------------------*/

import type { SvgaCaseJson } from '../caseTypes';

export const attrGradientEndpointsRadialAnim: SvgaCaseJson = {
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
                        -30,
                        -30
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
                    "animate": {
                        "gradientFx": {
                            "keyframes": [
                                {
                                    "time": 0,
                                    "value": -30
                                },
                                {
                                    "time": 1000,
                                    "value": 30
                                }
                            ]
                        },
                        "gradientFy": {
                            "keyframes": [
                                {
                                    "time": 0,
                                    "value": -30
                                },
                                {
                                    "time": 1000,
                                    "value": 30
                                }
                            ]
                        }
                    },
                    "gradientUnits": "userSpaceOnUse",
                    "spreadMethod": "pad"
                }
            }
        }
    ]
};
