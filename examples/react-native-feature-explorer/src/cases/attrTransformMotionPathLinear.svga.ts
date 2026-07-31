/*---------------------------------------------------------------------------------------
 * Copyright (c) Pixodesk LTD.
 * Licensed under the MIT License. See the LICENSE file in the project root for details.
 *---------------------------------------------------------------------------------------*/

import type { SvgaCaseJson } from '../caseTypes';

export const attrTransformMotionPathLinear: SvgaCaseJson = {
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
            "transform": "translate(100,100)translate(-112,-114)",
            "children": [
                {
                    "type": "rect",
                    "fill": "#e67326",
                    "height": 8,
                    "stroke": "none",
                    "transform": "matrix(1,0,0,1,122,74)",
                    "width": 26,
                    "animate": {
                        "transform": {
                            "autoOrient": true,
                            "keyframes": [
                                {
                                    "time": 0,
                                    "value": {
                                        "translate": [
                                            122,
                                            74
                                        ]
                                    }
                                },
                                {
                                    "time": 500,
                                    "value": {
                                        "translate": [
                                            176,
                                            74
                                        ]
                                    }
                                },
                                {
                                    "time": 1000,
                                    "value": {
                                        "translate": [
                                            176,
                                            128
                                        ]
                                    }
                                }
                            ]
                        }
                    }
                },
                {
                    "type": "path",
                    "d": "M122,74L176,74L176,128",
                    "fill": "none",
                    "stroke": "#b8b8c7",
                    "strokeDasharray": "3,3"
                },
                {
                    "type": "rect",
                    "fill": "#597399",
                    "height": 8,
                    "stroke": "none",
                    "transform": "translate(22,74)",
                    "width": 26,
                    "animate": {
                        "transform": {
                            "keyframes": [
                                {
                                    "time": 0,
                                    "value": {
                                        "translate": [
                                            22,
                                            74
                                        ]
                                    }
                                },
                                {
                                    "time": 500,
                                    "value": {
                                        "translate": [
                                            76,
                                            74
                                        ]
                                    }
                                },
                                {
                                    "time": 1000,
                                    "value": {
                                        "translate": [
                                            76,
                                            128
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
                    "transform": "translate(76,128)",
                    "width": 26
                },
                {
                    "type": "rect",
                    "fill": "none",
                    "height": 8,
                    "opacity": 0.5,
                    "stroke": "#9999a8",
                    "transform": "translate(76,101)",
                    "width": 26
                },
                {
                    "type": "rect",
                    "fill": "none",
                    "height": 8,
                    "opacity": 0.5,
                    "stroke": "#9999a8",
                    "transform": "translate(76,74)",
                    "width": 26
                },
                {
                    "type": "rect",
                    "fill": "none",
                    "height": 8,
                    "opacity": 0.5,
                    "stroke": "#9999a8",
                    "transform": "translate(49,74)",
                    "width": 26
                },
                {
                    "type": "rect",
                    "fill": "none",
                    "height": 8,
                    "opacity": 0.5,
                    "stroke": "#9999a8",
                    "transform": "translate(22,74)",
                    "width": 26
                },
                {
                    "type": "path",
                    "d": "M22,74L76,74L76,128",
                    "fill": "none",
                    "stroke": "#b8b8c7",
                    "strokeDasharray": "3,3"
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
                            "transform": "translate(176,128)rotate(90)",
                            "width": 26
                        },
                        {
                            "type": "rect",
                            "fill": "none",
                            "height": 8,
                            "opacity": 0.6,
                            "stroke": "#80808f",
                            "transform": "translate(176,101)rotate(90)",
                            "width": 26
                        },
                        {
                            "type": "rect",
                            "fill": "none",
                            "height": 8,
                            "opacity": 0.6,
                            "stroke": "#80808f",
                            "transform": "translate(176,74)",
                            "width": 26
                        },
                        {
                            "type": "rect",
                            "fill": "none",
                            "height": 8,
                            "opacity": 0.6,
                            "stroke": "#80808f",
                            "transform": "translate(149,74)",
                            "width": 26
                        },
                        {
                            "type": "rect",
                            "fill": "none",
                            "height": 8,
                            "opacity": 0.6,
                            "stroke": "#80808f",
                            "transform": "translate(122,74)",
                            "width": 26
                        }
                    ]
                }
            ]
        }
    ]
};
