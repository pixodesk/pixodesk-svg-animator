/*---------------------------------------------------------------------------------------
 * Copyright (c) Pixodesk LTD.
 * Licensed under the MIT License. See the LICENSE file in the project root for details.
 *---------------------------------------------------------------------------------------*/

import type { SvgaCaseJson } from '../caseTypes';

export const animEasingOvershoot: SvgaCaseJson = {
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
            "type": "rect",
            "fill": "#1a80b3",
            "height": 20,
            "stroke": "none",
            "transform": "translate(30,128)",
            "width": 20,
            "animate": {
                "transform": {
                    "keyframes": [
                        {
                            "time": 0,
                            "value": {
                                "translate": [
                                    30,
                                    128
                                ]
                            },
                            "easing": [
                                0.2,
                                1.2,
                                0.8,
                                1.2
                            ]
                        },
                        {
                            "time": 1000,
                            "value": {
                                "translate": [
                                    170,
                                    128
                                ]
                            }
                        }
                    ]
                }
            }
        },
        {
            "type": "rect",
            "fill": "#cc661a",
            "height": 20,
            "stroke": "none",
            "transform": "translate(30,72)",
            "width": 20,
            "animate": {
                "transform": {
                    "keyframes": [
                        {
                            "time": 0,
                            "value": {
                                "translate": [
                                    30,
                                    72
                                ]
                            },
                            "easing": [
                                0.4,
                                -0.5,
                                0.6,
                                1.5
                            ]
                        },
                        {
                            "time": 1000,
                            "value": {
                                "translate": [
                                    170,
                                    72
                                ]
                            }
                        }
                    ]
                }
            }
        }
    ]
};
