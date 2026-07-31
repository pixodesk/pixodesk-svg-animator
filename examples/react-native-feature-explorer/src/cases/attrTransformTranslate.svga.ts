/*---------------------------------------------------------------------------------------
 * Copyright (c) Pixodesk LTD.
 * Licensed under the MIT License. See the LICENSE file in the project root for details.
 *---------------------------------------------------------------------------------------*/

import type { SvgaCaseJson } from '../caseTypes';

export const attrTransformTranslate: SvgaCaseJson = {
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
            "transform": "translate(100,100)translate(-130,-115)",
            "children": [
                {
                    "type": "rect",
                    "fill": "#3399e6",
                    "height": 30,
                    "stroke": "none",
                    "transform": "translate(130,80)",
                    "width": 40,
                    "animate": {
                        "transform": {
                            "keyframes": [
                                {
                                    "time": 0,
                                    "value": {
                                        "translate": [
                                            130,
                                            80
                                        ]
                                    }
                                },
                                {
                                    "time": 1000,
                                    "value": {
                                        "translate": [
                                            170,
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
                    "height": 30,
                    "opacity": 0.5,
                    "stroke": "#9999a8",
                    "transform": "translate(170,120)",
                    "width": 40
                },
                {
                    "type": "rect",
                    "fill": "none",
                    "height": 30,
                    "opacity": 0.5,
                    "stroke": "#9999a8",
                    "transform": "translate(160,110)",
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
                    "fill": "none",
                    "height": 30,
                    "opacity": 0.5,
                    "stroke": "#9999a8",
                    "transform": "translate(140,90)",
                    "width": 40
                },
                {
                    "type": "rect",
                    "fill": "none",
                    "height": 30,
                    "opacity": 0.5,
                    "stroke": "#9999a8",
                    "transform": "translate(130,80)",
                    "width": 40
                },
                {
                    "type": "rect",
                    "fill": "#cc6633",
                    "height": 30,
                    "stroke": "none",
                    "transform": "translate(50,100)",
                    "width": 40
                }
            ]
        }
    ]
};
