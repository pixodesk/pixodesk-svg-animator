/*---------------------------------------------------------------------------------------
 * Copyright (c) Pixodesk LTD.
 * Licensed under the MIT License. See the LICENSE file in the project root for details.
 *---------------------------------------------------------------------------------------*/

import type { SvgaCaseJson } from '../caseTypes';

export const elemFilterBlur: SvgaCaseJson = {
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
            "type": "defs",
            "children": [
                {
                    "type": "filter",
                    "id": "_px_38bqgqpu",
                    "height": 1.2,
                    "width": 1.2,
                    "x": -0.1,
                    "y": -0.1,
                    "meta": {
                        "label": "blur-static"
                    },
                    "children": [
                        {
                            "type": "feGaussianBlur",
                            "stdDeviation": 2
                        }
                    ]
                },
                {
                    "type": "filter",
                    "id": "_px_38bqgqpv",
                    "height": 1.2,
                    "width": 1.2,
                    "x": -0.1,
                    "y": -0.1,
                    "meta": {
                        "label": "blur-anim"
                    },
                    "children": [
                        {
                            "type": "feGaussianBlur",
                            "stdDeviation": -1,
                            "animate": {
                                "stdDeviation": {
                                    "keyframes": [
                                        {
                                            "time": 0,
                                            "value": -1
                                        },
                                        {
                                            "time": 1000,
                                            "value": 4
                                        }
                                    ]
                                }
                            }
                        }
                    ]
                }
            ]
        },
        {
            "type": "ellipse",
            "fill": "#3399e6",
            "filter": "url(#_px_38bqgqpv)",
            "rx": 26,
            "ry": 26,
            "stroke": "none",
            "transform": "translate(150,100)"
        },
        {
            "type": "ellipse",
            "fill": "#e66633",
            "filter": "url(#_px_38bqgqpu)",
            "rx": 26,
            "ry": 26,
            "stroke": "none",
            "transform": "translate(50,100)"
        }
    ]
};
