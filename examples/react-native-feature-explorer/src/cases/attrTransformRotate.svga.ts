/*---------------------------------------------------------------------------------------
 * Copyright (c) Pixodesk LTD.
 * Licensed under the MIT License. See the LICENSE file in the project root for details.
 *---------------------------------------------------------------------------------------*/

import type { SvgaCaseJson } from '../caseTypes';

export const attrTransformRotate: SvgaCaseJson = {
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
            "type": "g",
            "transform": "translate(100,100)translate(-112.5,-104.7487)",
            "children": [
                {
                    "type": "rect",
                    "fill": "#33b366",
                    "height": 30,
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
                                        "translate": [
                                            150,
                                            100
                                        ]
                                    }
                                },
                                {
                                    "time": 1000,
                                    "value": {
                                        "rotate": 540,
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
                    "height": 30,
                    "opacity": 0.5,
                    "stroke": "#9999a8",
                    "transform": "translate(150,100)rotate(540)",
                    "width": 40
                },
                {
                    "type": "rect",
                    "fill": "none",
                    "height": 30,
                    "opacity": 0.5,
                    "stroke": "#9999a8",
                    "transform": "translate(150,100)rotate(405)",
                    "width": 40
                },
                {
                    "type": "rect",
                    "fill": "none",
                    "height": 30,
                    "opacity": 0.5,
                    "stroke": "#9999a8",
                    "transform": "translate(150,100)rotate(270)",
                    "width": 40
                },
                {
                    "type": "rect",
                    "fill": "none",
                    "height": 30,
                    "opacity": 0.5,
                    "stroke": "#9999a8",
                    "transform": "translate(150,100)rotate(135)",
                    "width": 40
                },
                {
                    "type": "rect",
                    "fill": "none",
                    "height": 30,
                    "opacity": 0.5,
                    "stroke": "#9999a8",
                    "transform": "translate(150,100)",
                    "width": 40
                },
                {
                    "type": "rect",
                    "fill": "#994db3",
                    "height": 30,
                    "stroke": "none",
                    "transform": "translate(50,100)rotate(30)",
                    "width": 40
                }
            ]
        }
    ]
};
