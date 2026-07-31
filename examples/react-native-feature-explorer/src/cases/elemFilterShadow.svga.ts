/*---------------------------------------------------------------------------------------
 * Copyright (c) Pixodesk LTD.
 * Licensed under the MIT License. See the LICENSE file in the project root for details.
 *---------------------------------------------------------------------------------------*/

import type { SvgaCaseJson } from '../caseTypes';

export const elemFilterShadow: SvgaCaseJson = {
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
                    "id": "_px_38bqgqpv",
                    "filterUnits": "userSpaceOnUse",
                    "height": 100,
                    "width": 100,
                    "x": -25,
                    "y": -25,
                    "meta": {
                        "label": "shadow-static"
                    },
                    "children": [
                        {
                            "type": "feDropShadow",
                            "dx": 2,
                            "dy": 2,
                            "floodColor": "#000000",
                            "floodOpacity": 0.6,
                            "stdDeviation": 1.5
                        }
                    ]
                },
                {
                    "type": "filter",
                    "id": "_px_38bqgqq0",
                    "filterUnits": "userSpaceOnUse",
                    "height": 100,
                    "width": 100,
                    "x": -25,
                    "y": -25,
                    "meta": {
                        "label": "shadow-anim"
                    },
                    "children": [
                        {
                            "type": "feDropShadow",
                            "dx": -4,
                            "dy": -4,
                            "floodColor": "#000000",
                            "floodOpacity": 0.6,
                            "stdDeviation": 1.5,
                            "animate": {
                                "dx": {
                                    "keyframes": [
                                        {
                                            "time": 0,
                                            "value": -4
                                        },
                                        {
                                            "time": 1000,
                                            "value": 4
                                        }
                                    ]
                                },
                                "dy": {
                                    "keyframes": [
                                        {
                                            "time": 0,
                                            "value": -4
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
            "type": "rect",
            "fill": "#4db380",
            "filter": "url(#_px_38bqgqq0)",
            "height": 44,
            "stroke": "none",
            "transform": "translate(128,78)",
            "width": 44
        },
        {
            "type": "rect",
            "fill": "#e6b333",
            "filter": "url(#_px_38bqgqpv)",
            "height": 44,
            "stroke": "none",
            "transform": "translate(28,78)",
            "width": 44
        }
    ]
};
