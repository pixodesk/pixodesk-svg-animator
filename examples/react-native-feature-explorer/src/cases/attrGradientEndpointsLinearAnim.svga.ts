/*---------------------------------------------------------------------------------------
 * Copyright (c) Pixodesk LTD.
 * Licensed under the MIT License. See the LICENSE file in the project root for details.
 *---------------------------------------------------------------------------------------*/

import type { SvgaCaseJson } from '../caseTypes';

export const attrGradientEndpointsLinearAnim: SvgaCaseJson = {
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
            "rx": 64,
            "ry": 64,
            "stroke": "none",
            "transform": "translate(100,100)",
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
                    "animate": {
                        "gradientY1": {
                            "keyframes": [
                                {
                                    "time": 0,
                                    "value": -45
                                },
                                {
                                    "time": 1000,
                                    "value": 45
                                }
                            ]
                        },
                        "gradientY2": {
                            "keyframes": [
                                {
                                    "time": 0,
                                    "value": 45
                                },
                                {
                                    "time": 1000,
                                    "value": -45
                                }
                            ]
                        }
                    },
                    "gradientUnits": "userSpaceOnUse",
                    "spreadMethod": "pad",
                    "start": [
                        -45,
                        -45
                    ],
                    "end": [
                        45,
                        45
                    ]
                }
            }
        }
    ]
};
