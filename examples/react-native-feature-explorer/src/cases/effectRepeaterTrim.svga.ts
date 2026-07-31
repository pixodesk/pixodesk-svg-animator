/*---------------------------------------------------------------------------------------
 * Copyright (c) Pixodesk LTD.
 * Licensed under the MIT License. See the LICENSE file in the project root for details.
 *---------------------------------------------------------------------------------------*/

import type { SvgaCaseJson } from '../caseTypes';

export const effectRepeaterTrim: SvgaCaseJson = {
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
            "fill": "none",
            "rx": 6,
            "ry": 6,
            "stroke": "#2673f2",
            "strokeWidth": 3,
            "transform": "translate(120,100)",
            "effects": {
                "trimPath": {
                    "range": {
                        "keyframes": [
                            {
                                "time": 0,
                                "value": [
                                    0,
                                    0
                                ]
                            },
                            {
                                "time": 1000,
                                "value": [
                                    0,
                                    1
                                ]
                            }
                        ]
                    }
                },
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
            "fill": "none",
            "rx": 6,
            "ry": 6,
            "stroke": "#2673f2",
            "strokeWidth": 3,
            "transform": "translate(20,100)",
            "effects": {
                "trimPath": {
                    "range": {
                        "keyframes": [
                            {
                                "time": 0,
                                "value": [
                                    0,
                                    0
                                ]
                            },
                            {
                                "time": 1000,
                                "value": [
                                    0,
                                    1
                                ]
                            }
                        ]
                    }
                },
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
