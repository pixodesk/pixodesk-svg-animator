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
            "rx": 40,
            "ry": 40,
            "stroke": "none",
            "transform": "translate(150,100)",
            "effects": {
                "fillGradient": {
                    "type": "linear",
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
                    "spreadMethod": "pad",
                    "start": [
                        0,
                        0
                    ],
                    "end": [
                        1,
                        0
                    ]
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
                    "spreadMethod": "pad",
                    "start": [
                        0,
                        0
                    ],
                    "end": [
                        1,
                        0
                    ]
                }
            }
        }
    ]
};
