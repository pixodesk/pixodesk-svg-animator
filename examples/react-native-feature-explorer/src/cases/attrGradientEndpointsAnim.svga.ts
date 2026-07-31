/*---------------------------------------------------------------------------------------
 * Copyright (c) Pixodesk LTD.
 * Licensed under the MIT License. See the LICENSE file in the project root for details.
 *---------------------------------------------------------------------------------------*/

import type { SvgaCaseJson } from '../caseTypes';

export const attrGradientEndpointsAnim: SvgaCaseJson = {
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
            "rx": 35,
            "ry": 35,
            "stroke": "none",
            "transform": "translate(150,100)",
            "effects": {
                "fillGradient": {
                    "type": "radial",
                    "c": [
                        0,
                        0
                    ],
                    "fp": [
                        -18,
                        -18
                    ],
                    "r": 30,
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
                                    "value": -18
                                },
                                {
                                    "time": 1000,
                                    "value": 18
                                }
                            ]
                        },
                        "gradientFy": {
                            "keyframes": [
                                {
                                    "time": 0,
                                    "value": -18
                                },
                                {
                                    "time": 1000,
                                    "value": 18
                                }
                            ]
                        }
                    },
                    "gradientUnits": "userSpaceOnUse",
                    "spreadMethod": "pad"
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
                    "p1": [
                        -25,
                        -25
                    ],
                    "p2": [
                        25,
                        25
                    ],
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
                        "gradientY1": {
                            "keyframes": [
                                {
                                    "time": 0,
                                    "value": -25
                                },
                                {
                                    "time": 1000,
                                    "value": 25
                                }
                            ]
                        },
                        "gradientY2": {
                            "keyframes": [
                                {
                                    "time": 0,
                                    "value": 25
                                },
                                {
                                    "time": 1000,
                                    "value": -25
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
