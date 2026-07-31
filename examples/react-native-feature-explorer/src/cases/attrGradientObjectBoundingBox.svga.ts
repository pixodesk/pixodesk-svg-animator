/*---------------------------------------------------------------------------------------
 * Copyright (c) Pixodesk LTD.
 * Licensed under the MIT License. See the LICENSE file in the project root for details.
 *---------------------------------------------------------------------------------------*/

import type { SvgaCaseJson } from '../caseTypes';

export const attrGradientObjectBoundingBox: SvgaCaseJson = {
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
            "rx": 40,
            "ry": 40,
            "stroke": "none",
            "transform": "translate(150,100)",
            "effects": {
                "fillGradient": {
                    "type": "linear",
                    "p1": [
                        0,
                        0
                    ],
                    "p2": [
                        1,
                        0
                    ],
                    "stops": {
                        "keyframes": [
                            {
                                "time": 0,
                                "value": [
                                    {
                                        "offset": 0,
                                        "color": "#2659e6"
                                    },
                                    {
                                        "offset": 0.5,
                                        "color": "#9933cc"
                                    },
                                    {
                                        "offset": 1,
                                        "color": "#e63359"
                                    }
                                ],
                                "easing": [
                                    0.5,
                                    0,
                                    0.5,
                                    1
                                ]
                            },
                            {
                                "time": 1000,
                                "value": [
                                    {
                                        "offset": 0,
                                        "color": "#0000ff"
                                    },
                                    {
                                        "offset": 0.5,
                                        "color": "#ff00ff"
                                    },
                                    {
                                        "offset": 1,
                                        "color": "#00ffff"
                                    }
                                ]
                            }
                        ]
                    },
                    "gradientUnits": "objectBoundingBox",
                    "spreadMethod": "pad"
                }
            }
        },
        {
            "type": "ellipse",
            "rx": 40,
            "ry": 40,
            "stroke": "none",
            "transform": "translate(50,100)",
            "effects": {
                "fillGradient": {
                    "type": "linear",
                    "p1": [
                        0,
                        0
                    ],
                    "p2": [
                        1,
                        0
                    ],
                    "stops": [
                        {
                            "offset": 0,
                            "color": "#2659e6"
                        },
                        {
                            "offset": 0.5,
                            "color": "#9933cc"
                        },
                        {
                            "offset": 1,
                            "color": "#e63359"
                        }
                    ],
                    "gradientUnits": "objectBoundingBox",
                    "spreadMethod": "pad"
                }
            }
        }
    ]
};
