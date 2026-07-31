/*---------------------------------------------------------------------------------------
 * Copyright (c) Pixodesk LTD.
 * Licensed under the MIT License. See the LICENSE file in the project root for details.
 *---------------------------------------------------------------------------------------*/

import type { SvgaCaseJson } from '../caseTypes';

export const attrGradientStrokeRadial: SvgaCaseJson = {
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
            "type": "path",
            "d": "M120,80L180,120L180,80L120,120",
            "fill": "none",
            "strokeWidth": 16,
            "effects": {
                "strokeGradient": {
                    "type": "radial",
                    "c": [
                        150,
                        100
                    ],
                    "fp": [
                        150,
                        100
                    ],
                    "r": 38,
                    "stops": {
                        "keyframes": [
                            {
                                "time": 0,
                                "value": [
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
                    "gradientUnits": "userSpaceOnUse",
                    "spreadMethod": "pad"
                }
            }
        },
        {
            "type": "path",
            "d": "M20,80L80,120L80,80L20,120",
            "fill": "none",
            "strokeWidth": 16,
            "effects": {
                "strokeGradient": {
                    "type": "radial",
                    "c": [
                        50,
                        100
                    ],
                    "fp": [
                        50,
                        100
                    ],
                    "r": 38,
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
