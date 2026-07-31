/*---------------------------------------------------------------------------------------
 * Copyright (c) Pixodesk LTD.
 * Licensed under the MIT License. See the LICENSE file in the project root for details.
 *---------------------------------------------------------------------------------------*/

import type { SvgaCaseJson } from '../caseTypes';

export const effectTrimPath: SvgaCaseJson = {
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
            "d": "M0,0L10,-40L20,0L30,-40L40,0",
            "fill": "none",
            "stroke": "#4db34d",
            "strokeLinecap": "round",
            "strokeLinejoin": "round",
            "strokeWidth": 4,
            "transform": "translate(140,60)",
            "effects": {
                "trimPath": {
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
            "d": "M0,0L10,-40L20,0L30,-40L40,0",
            "fill": "none",
            "stroke": "#e66633",
            "strokeLinecap": "round",
            "strokeLinejoin": "round",
            "strokeWidth": 4,
            "transform": "translate(80,60)",
            "effects": {
                "trimPath": {
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
            "d": "M0,0L10,-40L20,0L30,-40L40,0",
            "fill": "none",
            "stroke": "#3366e6",
            "strokeLinecap": "round",
            "strokeLinejoin": "round",
            "strokeWidth": 4,
            "transform": "translate(20,60)",
            "effects": {
                "trimPath": {
                    "range": [
                        0.125,
                        0.75
                    ]
                }
            }
        },
        {
            "type": "path",
            "d": "M0,0L10,-40L20,0L30,-40L40,0",
            "fill": "none",
            "stroke": "#000000",
            "strokeDasharray": "5,5",
            "strokeLinecap": "round",
            "strokeLinejoin": "round",
            "transform": "translate(20,60)"
        },
        {
            "type": "path",
            "d": "M0,0L10,-40L20,0L30,-40L40,0",
            "fill": "none",
            "stroke": "#000000",
            "strokeDasharray": "5,5",
            "strokeLinecap": "round",
            "strokeLinejoin": "round",
            "transform": "translate(80,60)"
        },
        {
            "type": "path",
            "d": "M0,0L10,-40L20,0L30,-40L40,0",
            "fill": "none",
            "stroke": "#000000",
            "strokeDasharray": "5,5",
            "strokeLinecap": "round",
            "strokeLinejoin": "round",
            "transform": "translate(140,60)"
        },
        {
            "type": "path",
            "d": "M0,0L40,0L40,40L0,40L0,0z",
            "fill": "none",
            "stroke": "#4db34d",
            "strokeLinecap": "round",
            "strokeLinejoin": "round",
            "strokeWidth": 4,
            "transform": "translate(140,80)",
            "effects": {
                "trimPath": {
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
            "d": "M0,0L40,0L40,40L0,40L0,0z",
            "fill": "none",
            "stroke": "#e66633",
            "strokeLinecap": "round",
            "strokeLinejoin": "round",
            "strokeWidth": 4,
            "transform": "translate(80,80)",
            "effects": {
                "trimPath": {
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
            "d": "M0,0L40,0L40,40L0,40L0,0z",
            "fill": "none",
            "stroke": "#3366e6",
            "strokeLinecap": "round",
            "strokeLinejoin": "round",
            "strokeWidth": 4,
            "transform": "translate(20,80)",
            "effects": {
                "trimPath": {
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
            "d": "M0,-20C11.0457,-20,20,-11.0457,20,0C20,11.0457,11.0457,20,0,20C-11.0457,20,-20,11.0457,-20,0C-20,-11.0457,-11.0457,-20,0,-20z",
            "fill": "none",
            "stroke": "#4db34d",
            "strokeLinecap": "round",
            "strokeLinejoin": "round",
            "strokeWidth": 4,
            "transform": "translate(160,160)",
            "effects": {
                "trimPath": {
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
            "d": "M0,-20C11.0457,-20,20,-11.0457,20,0C20,11.0457,11.0457,20,0,20C-11.0457,20,-20,11.0457,-20,0C-20,-11.0457,-11.0457,-20,0,-20z",
            "fill": "none",
            "stroke": "#e66633",
            "strokeLinecap": "round",
            "strokeLinejoin": "round",
            "strokeWidth": 4,
            "transform": "translate(100,160)",
            "effects": {
                "trimPath": {
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
            "d": "M0,-20C11.0457,-20,20,-11.0457,20,0C20,11.0457,11.0457,20,0,20C-11.0457,20,-20,11.0457,-20,0C-20,-11.0457,-11.0457,-20,0,-20z",
            "fill": "none",
            "stroke": "#3366e6",
            "strokeLinecap": "round",
            "strokeLinejoin": "round",
            "strokeWidth": 4,
            "transform": "translate(40,160)",
            "effects": {
                "trimPath": {
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
