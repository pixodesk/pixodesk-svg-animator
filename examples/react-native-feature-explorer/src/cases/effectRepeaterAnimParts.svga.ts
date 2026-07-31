/*---------------------------------------------------------------------------------------
 * Copyright (c) Pixodesk LTD.
 * Licensed under the MIT License. See the LICENSE file in the project root for details.
 *---------------------------------------------------------------------------------------*/

import type { SvgaCaseJson } from '../caseTypes';

export const effectRepeaterAnimParts: SvgaCaseJson = {
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
            "fill": "#4d66cc",
            "rx": 5,
            "ry": 5,
            "stroke": "none",
            "transform": "translate(166.6667,100)",
            "effects": {
                "repeater": {
                    "copies": 5,
                    "origin": {
                        "loop": {
                            "alternate": true
                        },
                        "keyframes": [
                            {
                                "time": 0,
                                "value": [
                                    0,
                                    20
                                ]
                            },
                            {
                                "time": 1000,
                                "value": [
                                    0,
                                    42
                                ]
                            }
                        ]
                    },
                    "rotate": 22
                }
            }
        },
        {
            "type": "ellipse",
            "fill": "#4d994d",
            "rx": 5,
            "ry": 5,
            "stroke": "none",
            "transform": "translate(100,100)",
            "effects": {
                "repeater": {
                    "copies": 5,
                    "translate": [
                        11,
                        0
                    ],
                    "scale": {
                        "loop": {
                            "alternate": true
                        },
                        "keyframes": [
                            {
                                "time": 0,
                                "value": [
                                    0.7,
                                    0.7
                                ]
                            },
                            {
                                "time": 1000,
                                "value": [
                                    0.98,
                                    0.98
                                ]
                            }
                        ]
                    }
                }
            }
        },
        {
            "type": "ellipse",
            "fill": "#cc4d4d",
            "rx": 10,
            "ry": 2,
            "stroke": "none",
            "transform": "translate(33.3333,100)",
            "effects": {
                "repeater": {
                    "copies": 5,
                    "translate": [
                        0,
                        12
                    ],
                    "rotate": {
                        "loop": {
                            "alternate": true
                        },
                        "keyframes": [
                            {
                                "time": 0,
                                "value": 0
                            },
                            {
                                "time": 1000,
                                "value": 28
                            }
                        ]
                    }
                }
            }
        }
    ]
};
