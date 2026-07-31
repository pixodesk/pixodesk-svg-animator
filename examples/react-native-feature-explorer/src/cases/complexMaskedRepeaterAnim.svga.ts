/*---------------------------------------------------------------------------------------
 * Copyright (c) Pixodesk LTD.
 * Licensed under the MIT License. See the LICENSE file in the project root for details.
 *---------------------------------------------------------------------------------------*/

import type { SvgaCaseJson } from '../caseTypes';

export const complexMaskedRepeaterAnim: SvgaCaseJson = {
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
            "fill": "#3380e6",
            "height": 36,
            "stroke": "none",
            "transform": "translate(44,100)",
            "width": 18,
            "effects": {
                "repeater": {
                    "copies": 6,
                    "translate": [
                        22,
                        0
                    ]
                },
                "maskedBy": {
                    "href": "_px_38bqgqr7",
                    "maskType": "alpha"
                }
            },
            "meta": {
                "label": "rep-target"
            }
        },
        {
            "type": "ellipse",
            "id": "_px_38bqgqr7",
            "fill": "#ffffff",
            "rx": 65,
            "ry": 30,
            "stroke": "none",
            "animate": {
                "transform": {
                    "keyframes": [
                        {
                            "time": 0,
                            "value": {
                                "translate": [
                                    0,
                                    0
                                ]
                            }
                        },
                        {
                            "time": 1000,
                            "value": {
                                "translate": [
                                    40,
                                    0
                                ]
                            }
                        }
                    ]
                }
            },
            "meta": {
                "label": "mask-row"
            }
        }
    ]
};
