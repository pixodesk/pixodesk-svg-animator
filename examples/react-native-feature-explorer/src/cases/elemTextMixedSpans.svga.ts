/*---------------------------------------------------------------------------------------
 * Copyright (c) Pixodesk LTD.
 * Licensed under the MIT License. See the LICENSE file in the project root for details.
 *---------------------------------------------------------------------------------------*/

import type { SvgaCaseJson } from '../caseTypes';

export const elemTextMixedSpans: SvgaCaseJson = {
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
            "type": "text",
            "textAnchor": "middle",
            "transform": "translate(100,100)",
            "xml:space": "preserve",
            "style": {
                "white-space": "pre"
            },
            "effects": {
                "text": {
                    "useGlyphs": true
                }
            },
            "children": [
                {
                    "type": "tspan",
                    "xml:space": "preserve",
                    "style": {
                        "white-space": "pre"
                    },
                    "children": [
                        {
                            "type": "tspan",
                            "fill": "#33334d",
                            "fontFamily": "sans-serif",
                            "fontSize": "15px",
                            "text": "plain ",
                            "xml:space": "preserve",
                            "style": {
                                "white-space": "pre"
                            }
                        },
                        {
                            "type": "tspan",
                            "fill": "#33804d",
                            "fontFamily": "sans-serif",
                            "fontSize": "15px",
                            "fontWeight": "700",
                            "text": "bold ",
                            "xml:space": "preserve",
                            "style": {
                                "white-space": "pre"
                            }
                        },
                        {
                            "type": "tspan",
                            "fill": "#994db3",
                            "fontFamily": "sans-serif",
                            "fontSize": "15px",
                            "fontStyle": "italic",
                            "text": "italic ",
                            "xml:space": "preserve",
                            "style": {
                                "white-space": "pre"
                            }
                        },
                        {
                            "type": "tspan",
                            "fill": "#e64d33",
                            "fontFamily": "sans-serif",
                            "fontSize": "15px",
                            "text": "fill",
                            "xml:space": "preserve",
                            "style": {
                                "white-space": "pre"
                            },
                            "animate": {
                                "fill": {
                                    "keyframes": [
                                        {
                                            "time": 0,
                                            "value": "#e64d33"
                                        },
                                        {
                                            "time": 1000,
                                            "value": "#3366e6"
                                        }
                                    ]
                                }
                            }
                        }
                    ]
                }
            ]
        }
    ]
};
