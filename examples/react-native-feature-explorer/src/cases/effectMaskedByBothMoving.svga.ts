/*---------------------------------------------------------------------------------------
 * Copyright (c) Pixodesk LTD.
 * Licensed under the MIT License. See the LICENSE file in the project root for details.
 *---------------------------------------------------------------------------------------*/

import type { SvgaCaseJson } from '../caseTypes';

export const effectMaskedByBothMoving: SvgaCaseJson = {
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
            "id": "_px_38bqgqqa",
            "fill": "#f2c740",
            "rx": 34,
            "ry": 34,
            "stroke": "none",
            "transform": "translate(70,100)",
            "animate": {
                "transform": {
                    "loop": {
                        "alternate": true
                    },
                    "keyframes": [
                        {
                            "time": 0,
                            "value": {
                                "translate": [
                                    70,
                                    100
                                ]
                            }
                        },
                        {
                            "time": 1000,
                            "value": {
                                "translate": [
                                    130,
                                    100
                                ]
                            }
                        }
                    ]
                }
            },
            "meta": {
                "label": "mask-ellipse"
            }
        },
        {
            "type": "rect",
            "fill": "#3380e6",
            "height": 80,
            "stroke": "none",
            "transform": "translate(90,90)",
            "width": 100,
            "animate": {
                "transform": {
                    "loop": {
                        "alternate": true
                    },
                    "keyframes": [
                        {
                            "time": 0,
                            "value": {
                                "translate": [
                                    90,
                                    90
                                ]
                            }
                        },
                        {
                            "time": 1000,
                            "value": {
                                "translate": [
                                    110,
                                    110
                                ]
                            }
                        }
                    ]
                }
            },
            "effects": {
                "maskedBy": {
                    "href": "_px_38bqgqqa",
                    "maskType": "alpha"
                }
            },
            "meta": {
                "label": "masked-target"
            }
        }
    ]
};
