/*---------------------------------------------------------------------------------------
 * Copyright (c) Pixodesk LTD.
 * Licensed under the MIT License. See the LICENSE file in the project root for details.
 *---------------------------------------------------------------------------------------*/

import type { SvgaCaseJson } from '../caseTypes';

export const animEasingCubic: SvgaCaseJson = {
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
            "fill": "#3366e6",
            "height": 16,
            "stroke": "none",
            "transform": "translate(24,145)",
            "width": 16,
            "animate": {
                "transform": {
                    "keyframes": [
                        {
                            "time": 0,
                            "value": {
                                "translate": [
                                    24,
                                    145
                                ]
                            },
                            "easing": [
                                0,
                                0,
                                0.58,
                                1
                            ]
                        },
                        {
                            "time": 1000,
                            "value": {
                                "translate": [
                                    176,
                                    145
                                ]
                            }
                        }
                    ]
                }
            }
        },
        {
            "type": "rect",
            "fill": "#33b34d",
            "height": 16,
            "stroke": "none",
            "transform": "translate(24,100)",
            "width": 16,
            "animate": {
                "transform": {
                    "keyframes": [
                        {
                            "time": 0,
                            "value": {
                                "translate": [
                                    24,
                                    100
                                ]
                            },
                            "easing": [
                                0.42,
                                0,
                                1,
                                1
                            ]
                        },
                        {
                            "time": 1000,
                            "value": {
                                "translate": [
                                    176,
                                    100
                                ]
                            }
                        }
                    ]
                }
            }
        },
        {
            "type": "rect",
            "fill": "#e63333",
            "height": 16,
            "stroke": "none",
            "transform": "translate(24,55)",
            "width": 16,
            "animate": {
                "transform": {
                    "keyframes": [
                        {
                            "time": 0,
                            "value": {
                                "translate": [
                                    24,
                                    55
                                ]
                            },
                            "easing": [
                                0,
                                0,
                                1,
                                1
                            ]
                        },
                        {
                            "time": 1000,
                            "value": {
                                "translate": [
                                    176,
                                    55
                                ]
                            }
                        }
                    ]
                }
            }
        }
    ]
};
