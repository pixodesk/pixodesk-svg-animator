/*---------------------------------------------------------------------------------------
 * Copyright (c) Pixodesk LTD.
 * Licensed under the MIT License. See the LICENSE file in the project root for details.
 *---------------------------------------------------------------------------------------*/

import type { SvgaCaseJson } from '../caseTypes';

export const effectMaskedByRotatingMask: SvgaCaseJson = {
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
            "animate": {
                "transform": {
                    "keyframes": [
                        {
                            "time": 0,
                            "value": {
                                "rotate": 0,
                                "translate": [
                                    100,
                                    100
                                ]
                            }
                        },
                        {
                            "time": 1000,
                            "value": {
                                "rotate": 90,
                                "translate": [
                                    100,
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
            "height": 90,
            "stroke": "none",
            "transform": "translate(100,100)",
            "width": 110,
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
