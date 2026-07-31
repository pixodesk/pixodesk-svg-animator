/*---------------------------------------------------------------------------------------
 * Copyright (c) Pixodesk LTD.
 * Licensed under the MIT License. See the LICENSE file in the project root for details.
 *---------------------------------------------------------------------------------------*/

import type { SvgaCaseJson } from '../caseTypes';

export const attrTransformUnified: SvgaCaseJson = {
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
            "fill": "#339980",
            "height": 26,
            "stroke": "none",
            "transform": "translate(138,88)",
            "width": 36,
            "animate": {
                "transform": {
                    "keyframes": [
                        {
                            "time": 0,
                            "value": {
                                "translate": [
                                    138,
                                    88
                                ],
                                "rotate": 0,
                                "skew": 0,
                                "scale": [
                                    1,
                                    1
                                ],
                                "origin": [
                                    0,
                                    0
                                ]
                            }
                        },
                        {
                            "time": 1000,
                            "value": {
                                "translate": [
                                    162,
                                    112
                                ],
                                "rotate": 90,
                                "skew": 20,
                                "scale": [
                                    0.8,
                                    1.2
                                ],
                                "origin": [
                                    10,
                                    8
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
            "transform": "translate(172,120)rotate(90)scale(0.8,1.2)translate(-10,-8)",
            "width": 36
        },
        {
            "type": "rect",
            "fill": "none",
            "height": 26,
            "opacity": 0.5,
            "stroke": "#9999a8",
            "transform": "translate(163.5,112)rotate(67.5)scale(0.85,1.15)translate(-7.5,-6)",
            "width": 36
        },
        {
            "type": "rect",
            "fill": "none",
            "height": 26,
            "opacity": 0.5,
            "stroke": "#9999a8",
            "transform": "translate(155,104)rotate(45)scale(0.9,1.1)translate(-5,-4)",
            "width": 36
        },
        {
            "type": "rect",
            "fill": "none",
            "height": 26,
            "opacity": 0.5,
            "stroke": "#9999a8",
            "transform": "translate(146.5,96)rotate(22.5)scale(0.95,1.05)translate(-2.5,-2)",
            "width": 36
        },
        {
            "type": "rect",
            "fill": "none",
            "height": 26,
            "opacity": 0.5,
            "stroke": "#9999a8",
            "transform": "translate(138,88)",
            "width": 36
        },
        {
            "type": "rect",
            "fill": "#8033cc",
            "height": 26,
            "stroke": "none",
            "transform": "translate(60,108)rotate(20)scale(1.1,0.9)translate(-10,-8)",
            "width": 36
        }
    ]
};
