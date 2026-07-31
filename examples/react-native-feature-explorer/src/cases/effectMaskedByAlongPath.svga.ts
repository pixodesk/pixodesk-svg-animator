/*---------------------------------------------------------------------------------------
 * Copyright (c) Pixodesk LTD.
 * Licensed under the MIT License. See the LICENSE file in the project root for details.
 *---------------------------------------------------------------------------------------*/

import type { SvgaCaseJson } from '../caseTypes';

export const effectMaskedByAlongPath: SvgaCaseJson = {
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
            "id": "_px_38bqgqq9",
            "fill": "#f2c740",
            "rx": 44,
            "ry": 34,
            "stroke": "none",
            "transform": "translate(100,100)",
            "meta": {
                "label": "mask-ellipse"
            }
        },
        {
            "type": "rect",
            "fill": "#3380e6",
            "height": 90,
            "stroke": "none",
            "transform": "translate(-28,0)",
            "width": 110,
            "animate": {
                "transform": {
                    "keyframes": [
                        {
                            "time": 0,
                            "value": {
                                "translate": [
                                    -28,
                                    0
                                ]
                            }
                        },
                        {
                            "time": 500,
                            "value": {
                                "translate": [
                                    0,
                                    30
                                ]
                            },
                            "tangentOut": [
                                23.3383,
                                -0.2364
                            ],
                            "tangentIn": [
                                -23.3383,
                                0.2364
                            ]
                        },
                        {
                            "time": 1000,
                            "value": {
                                "translate": [
                                    28,
                                    0
                                ]
                            }
                        }
                    ]
                }
            },
            "effects": {
                "maskedBy": {
                    "href": "_px_38bqgqq9",
                    "maskType": "alpha"
                }
            },
            "meta": {
                "label": "masked-target"
            }
        }
    ]
};
