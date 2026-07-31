/*---------------------------------------------------------------------------------------
 * Copyright (c) Pixodesk LTD.
 * Licensed under the MIT License. See the LICENSE file in the project root for details.
 *---------------------------------------------------------------------------------------*/

import type { SvgaCaseJson } from '../caseTypes';

export const attrTransformOrigin: SvgaCaseJson = {
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
            "fill": "#cc8033",
            "height": 26,
            "stroke": "none",
            "transform": "translate(150,100)",
            "width": 40,
            "animate": {
                "transform": {
                    "keyframes": [
                        {
                            "time": 0,
                            "value": {
                                "rotate": 0,
                                "origin": [
                                    0,
                                    0
                                ],
                                "translate": [
                                    150,
                                    100
                                ]
                            }
                        },
                        {
                            "time": 1000,
                            "value": {
                                "rotate": 360,
                                "origin": [
                                    20,
                                    13
                                ],
                                "translate": [
                                    150,
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
            "fill": "none",
            "height": 26,
            "opacity": 0.5,
            "stroke": "#9999a8",
            "transform": "translate(170,113)rotate(360)translate(-20,-13)",
            "width": 40
        },
        {
            "type": "rect",
            "fill": "none",
            "height": 26,
            "opacity": 0.5,
            "stroke": "#9999a8",
            "transform": "translate(165,109.75)rotate(270)translate(-15,-9.75)",
            "width": 40
        },
        {
            "type": "rect",
            "fill": "none",
            "height": 26,
            "opacity": 0.5,
            "stroke": "#9999a8",
            "transform": "translate(160,106.5)rotate(180)translate(-10,-6.5)",
            "width": 40
        },
        {
            "type": "rect",
            "fill": "none",
            "height": 26,
            "opacity": 0.5,
            "stroke": "#9999a8",
            "transform": "translate(155,103.25)rotate(90)translate(-5,-3.25)",
            "width": 40
        },
        {
            "type": "rect",
            "fill": "none",
            "height": 26,
            "opacity": 0.5,
            "stroke": "#9999a8",
            "transform": "translate(150,100)",
            "width": 40
        },
        {
            "type": "rect",
            "fill": "#804dcc",
            "height": 26,
            "stroke": "none",
            "transform": "translate(70,113)rotate(30)translate(-20,-13)",
            "width": 40
        }
    ]
};
