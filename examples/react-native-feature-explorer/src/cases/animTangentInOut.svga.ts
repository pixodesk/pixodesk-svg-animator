/*---------------------------------------------------------------------------------------
 * Copyright (c) Pixodesk LTD.
 * Licensed under the MIT License. See the LICENSE file in the project root for details.
 *---------------------------------------------------------------------------------------*/

import type { SvgaCaseJson } from '../caseTypes';

export const animTangentInOut: SvgaCaseJson = {
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
            "fill": "#e67326",
            "height": 8,
            "stroke": "none",
            "transform": "matrix(0.5039,-0.8638,0.8638,0.5039,120,120)",
            "width": 26,
            "animate": {
                "transform": {
                    "autoOrient": true,
                    "keyframes": [
                        {
                            "time": 0,
                            "value": {
                                "translate": [
                                    120,
                                    120
                                ]
                            },
                            "tangentOut": [
                                28,
                                -48
                            ]
                        },
                        {
                            "time": 1000,
                            "value": {
                                "translate": [
                                    180,
                                    120
                                ]
                            }
                        }
                    ]
                }
            }
        },
        {
            "type": "rect",
            "fill": "#597399",
            "height": 8,
            "stroke": "none",
            "transform": "translate(20,120)",
            "width": 26,
            "animate": {
                "transform": {
                    "keyframes": [
                        {
                            "time": 0,
                            "value": {
                                "translate": [
                                    20,
                                    120
                                ]
                            },
                            "tangentOut": [
                                28,
                                -48
                            ]
                        },
                        {
                            "time": 1000,
                            "value": {
                                "translate": [
                                    80,
                                    120
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
            "height": 8,
            "opacity": 0.5,
            "stroke": "#9999a8",
            "transform": "translate(80,120)",
            "width": 26
        },
        {
            "type": "rect",
            "fill": "none",
            "height": 8,
            "opacity": 0.5,
            "stroke": "#9999a8",
            "transform": "translate(66.8694,106.1183)",
            "width": 26
        },
        {
            "type": "rect",
            "fill": "none",
            "height": 8,
            "opacity": 0.5,
            "stroke": "#9999a8",
            "transform": "translate(49.4791,98.7155)",
            "width": 26
        },
        {
            "type": "rect",
            "fill": "none",
            "height": 8,
            "opacity": 0.5,
            "stroke": "#9999a8",
            "transform": "translate(31.9055,105.082)",
            "width": 26
        },
        {
            "type": "rect",
            "fill": "none",
            "height": 8,
            "opacity": 0.5,
            "stroke": "#9999a8",
            "transform": "translate(20,120)",
            "width": 26
        },
        {
            "type": "path",
            "d": "M20,120C48,72,80,120,80,120",
            "fill": "none",
            "stroke": "#808080"
        },
        {
            "type": "path",
            "d": "M120,120C148,72,180,120,180,120",
            "fill": "none",
            "stroke": "#808080"
        },
        {
            "type": "g",
            "meta": {
                "label": "outlines 0%/25%/50%/75%/100%"
            },
            "children": [
                {
                    "type": "rect",
                    "fill": "none",
                    "height": 8,
                    "opacity": 0.6,
                    "stroke": "#80808f",
                    "transform": "translate(180,120)rotate(56.3075)",
                    "width": 26
                },
                {
                    "type": "rect",
                    "fill": "none",
                    "height": 8,
                    "opacity": 0.6,
                    "stroke": "#80808f",
                    "transform": "translate(166.8694,106.1183)rotate(37.6415)",
                    "width": 26
                },
                {
                    "type": "rect",
                    "fill": "none",
                    "height": 8,
                    "opacity": 0.6,
                    "stroke": "#80808f",
                    "transform": "translate(149.4791,98.7155)rotate(3.7671)",
                    "width": 26
                },
                {
                    "type": "rect",
                    "fill": "none",
                    "height": 8,
                    "opacity": 0.6,
                    "stroke": "#80808f",
                    "transform": "translate(131.9055,105.082)rotate(-40.0991)",
                    "width": 26
                },
                {
                    "type": "rect",
                    "fill": "none",
                    "height": 8,
                    "opacity": 0.6,
                    "stroke": "#80808f",
                    "transform": "translate(120,120)rotate(-59.7436)",
                    "width": 26
                }
            ]
        }
    ]
};
