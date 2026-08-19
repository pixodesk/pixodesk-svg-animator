/*---------------------------------------------------------------------------------------
 * Copyright (c) Pixodesk LTD.
 * Licensed under the MIT License. See the LICENSE file in the project root for details.
 *---------------------------------------------------------------------------------------*/

import type { SvgaCaseJson } from '../caseTypes';

export const effectTrimPathSubpath: SvgaCaseJson = {
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
            "type": "path",
            "d": "M0,0L10,-20L19.9999,0L30,-20L39.9999,0M0,-20L10,-40L20,-20L30,-40L40,-20",
            "fill": "none",
            "stroke": "#4db34d",
            "strokeLinecap": "round",
            "strokeLinejoin": "round",
            "strokeWidth": 4,
            "transform": "translate(140,60)",
            "effects": {
                "strokeTrim": {
                    "offset": {
                        "loop": true,
                        "keyframes": [
                            {
                                "time": 0,
                                "value": 0
                            },
                            {
                                "time": 1000,
                                "value": 1
                            }
                        ]
                    },
                    "range": [
                        0,
                        0.4
                    ]
                }
            }
        },
        {
            "type": "path",
            "d": "M0,0L10,-20L19.9999,0L30,-20L39.9999,0M0,-20L10,-40L20,-20L30,-40L40,-20",
            "fill": "none",
            "stroke": "#e66633",
            "strokeLinecap": "round",
            "strokeLinejoin": "round",
            "strokeWidth": 4,
            "transform": "translate(80,60)",
            "effects": {
                "strokeTrim": {
                    "range": {
                        "loop": {
                            "alternate": true
                        },
                        "keyframes": [
                            {
                                "time": 0,
                                "value": [
                                    0,
                                    0
                                ]
                            },
                            {
                                "time": 1000,
                                "value": [
                                    0,
                                    1
                                ]
                            }
                        ]
                    }
                }
            }
        },
        {
            "type": "path",
            "d": "M0,0L10,-20L19.9999,0L30,-20L39.9999,0M0,-20L10,-40L20,-20L30,-40L40,-20",
            "fill": "none",
            "stroke": "#3366e6",
            "strokeLinecap": "round",
            "strokeLinejoin": "round",
            "strokeWidth": 4,
            "transform": "translate(20,60)",
            "effects": {
                "strokeTrim": {
                    "range": [
                        0.125,
                        0.75
                    ]
                }
            }
        },
        {
            "type": "path",
            "d": "M0,-20L10,-40L20,-20L30,-40L40,-20",
            "fill": "none",
            "stroke": "#000000",
            "strokeDasharray": "5,5",
            "strokeLinecap": "round",
            "strokeLinejoin": "round",
            "transform": "translate(20,60)"
        },
        {
            "type": "path",
            "d": "M0,-20L10,-40L20,-20L30,-40L40,-20",
            "fill": "none",
            "stroke": "#000000",
            "strokeDasharray": "5,5",
            "strokeLinecap": "round",
            "strokeLinejoin": "round",
            "transform": "translate(80,60)"
        },
        {
            "type": "path",
            "d": "M0,-20L10,-40L20,-20L30,-40L40,-20",
            "fill": "none",
            "stroke": "#000000",
            "strokeDasharray": "5,5",
            "strokeLinecap": "round",
            "strokeLinejoin": "round",
            "transform": "translate(140,60)"
        },
        {
            "type": "path",
            "d": "M0,-20L10,-40L19.9999,-20L30,-40L39.9999,-20",
            "fill": "none",
            "stroke": "#000000",
            "strokeDasharray": "5,5",
            "strokeLinecap": "round",
            "strokeLinejoin": "round",
            "transform": "translate(20,80)"
        },
        {
            "type": "path",
            "d": "M0,-20L10,-40L19.9999,-20L30,-40L39.9999,-20",
            "fill": "none",
            "stroke": "#000000",
            "strokeDasharray": "5,5",
            "strokeLinecap": "round",
            "strokeLinejoin": "round",
            "transform": "translate(80,80)"
        },
        {
            "type": "path",
            "d": "M0,-20L10,-40L19.9999,-20L30,-40L40,-20",
            "fill": "none",
            "stroke": "#000000",
            "strokeDasharray": "5,5",
            "strokeLinecap": "round",
            "strokeLinejoin": "round",
            "transform": "translate(140,80)"
        },
        {
            "type": "path",
            "d": "M0,0L40,0L40,40L0,40L0,0zM10,10L30,10L30,30L10,30L10,10z",
            "fill": "none",
            "stroke": "#4db34d",
            "strokeLinecap": "round",
            "strokeLinejoin": "round",
            "strokeWidth": 4,
            "transform": "translate(140,80)",
            "effects": {
                "strokeTrim": {
                    "offset": {
                        "loop": true,
                        "keyframes": [
                            {
                                "time": 0,
                                "value": 0
                            },
                            {
                                "time": 1000,
                                "value": 1
                            }
                        ]
                    },
                    "range": [
                        0,
                        0.4
                    ]
                }
            }
        },
        {
            "type": "path",
            "d": "M0,0L40,0L40,40L0,40L0,0zM10,10L30,10L30,30L10,30L10,10z",
            "fill": "none",
            "stroke": "#e66633",
            "strokeLinecap": "round",
            "strokeLinejoin": "round",
            "strokeWidth": 4,
            "transform": "translate(80,80)",
            "effects": {
                "strokeTrim": {
                    "range": {
                        "loop": {
                            "alternate": true
                        },
                        "keyframes": [
                            {
                                "time": 0,
                                "value": [
                                    0,
                                    0
                                ]
                            },
                            {
                                "time": 1000,
                                "value": [
                                    0,
                                    1
                                ]
                            }
                        ]
                    }
                }
            }
        },
        {
            "type": "path",
            "d": "M0,0L40,0L40,40L0,40L0,0zM10,10L30,10L30,30L10,30L10,10z",
            "fill": "none",
            "stroke": "#3366e6",
            "strokeLinecap": "round",
            "strokeLinejoin": "round",
            "strokeWidth": 4,
            "transform": "translate(20,80)",
            "effects": {
                "strokeTrim": {
                    "range": [
                        0.125,
                        0.75
                    ]
                }
            }
        },
        {
            "type": "path",
            "d": "M0,0L40,0L40,40L0,40L0,0z",
            "fill": "none",
            "stroke": "#000000",
            "strokeDasharray": "5,5",
            "strokeLinecap": "round",
            "strokeLinejoin": "round",
            "transform": "translate(20,80)"
        },
        {
            "type": "path",
            "d": "M0,0L40,0L40,40L0,40L0,0z",
            "fill": "none",
            "stroke": "#000000",
            "strokeDasharray": "5,5",
            "strokeLinecap": "round",
            "strokeLinejoin": "round",
            "transform": "translate(80,80)"
        },
        {
            "type": "path",
            "d": "M0,0L40,0L40,40L0,40L0,0z",
            "fill": "none",
            "stroke": "#000000",
            "strokeDasharray": "5,5",
            "strokeLinecap": "round",
            "strokeLinejoin": "round",
            "transform": "translate(140,80)"
        },
        {
            "type": "path",
            "d": "M0,-20C11.0457,-20,20,-11.0457,20,0C20,11.0457,11.0457,20,0,20C-11.0457,20,-20,11.0457,-20,0C-20,-11.0457,-11.0457,-20,0,-20zM0,-10C5.5229,-10,10,-5.5229,10,0C10,5.5229,5.5229,10,0,10C-5.5229,10,-10,5.5229,-10,0C-10,-5.5229,-5.5229,-10,0,-10z",
            "fill": "none",
            "stroke": "#4db34d",
            "strokeLinecap": "round",
            "strokeLinejoin": "round",
            "strokeWidth": 4,
            "transform": "translate(160,160)",
            "effects": {
                "strokeTrim": {
                    "offset": {
                        "loop": true,
                        "keyframes": [
                            {
                                "time": 0,
                                "value": 0
                            },
                            {
                                "time": 1000,
                                "value": 1
                            }
                        ]
                    },
                    "range": [
                        0,
                        0.4
                    ]
                }
            }
        },
        {
            "type": "path",
            "d": "M0,-20C11.0457,-20,20,-11.0457,20,0C20,11.0457,11.0457,20,0,20C-11.0457,20,-20,11.0457,-20,0C-20,-11.0457,-11.0457,-20,0,-20zM0,-10C5.5229,-10,10,-5.5229,10,0C10,5.5229,5.5229,10,0,10C-5.5229,10,-10,5.5229,-10,0C-10,-5.5229,-5.5229,-10,0,-10z",
            "fill": "none",
            "stroke": "#e66633",
            "strokeLinecap": "round",
            "strokeLinejoin": "round",
            "strokeWidth": 4,
            "transform": "translate(100,160)",
            "effects": {
                "strokeTrim": {
                    "range": {
                        "loop": {
                            "alternate": true
                        },
                        "keyframes": [
                            {
                                "time": 0,
                                "value": [
                                    0,
                                    0
                                ]
                            },
                            {
                                "time": 1000,
                                "value": [
                                    0,
                                    1
                                ]
                            }
                        ]
                    }
                }
            }
        },
        {
            "type": "path",
            "d": "M0,-20C11.0457,-20,20,-11.0457,20,0C20,11.0457,11.0457,20,0,20C-11.0457,20,-20,11.0457,-20,0C-20,-11.0457,-11.0457,-20,0,-20zM0,-10C5.5229,-10,10,-5.5229,10,0C10,5.5229,5.5229,10,0,10C-5.5229,10,-10,5.5229,-10,0C-10,-5.5229,-5.5229,-10,0,-10z",
            "fill": "none",
            "stroke": "#3366e6",
            "strokeLinecap": "round",
            "strokeLinejoin": "round",
            "strokeWidth": 4,
            "transform": "translate(40,160)",
            "effects": {
                "strokeTrim": {
                    "range": [
                        0.125,
                        0.75
                    ]
                }
            }
        },
        {
            "type": "path",
            "d": "M0,-20C11.0457,-20,20,-11.0457,20,0C20,11.0457,11.0457,20,0,20C-11.0457,20,-20,11.0457,-20,0C-20,-11.0457,-11.0457,-20,0,-20z",
            "fill": "none",
            "stroke": "#000000",
            "strokeDasharray": "5,5",
            "strokeLinecap": "round",
            "strokeLinejoin": "round",
            "transform": "translate(40,160)"
        },
        {
            "type": "path",
            "d": "M0,-20C11.0457,-20,20,-11.0457,20,0C20,11.0457,11.0457,20,0,20C-11.0457,20,-20,11.0457,-20,0C-20,-11.0457,-11.0457,-20,0,-20z",
            "fill": "none",
            "stroke": "#000000",
            "strokeDasharray": "5,5",
            "strokeLinecap": "round",
            "strokeLinejoin": "round",
            "transform": "translate(100,160)"
        },
        {
            "type": "path",
            "d": "M0,-20C11.0457,-20,20,-11.0457,20,0C20,11.0457,11.0457,20,0,20C-11.0457,20,-20,11.0457,-20,0C-20,-11.0457,-11.0457,-20,0,-20z",
            "fill": "none",
            "stroke": "#000000",
            "strokeDasharray": "5,5",
            "strokeLinecap": "round",
            "strokeLinejoin": "round",
            "transform": "translate(160,160)"
        }
    ]
};
