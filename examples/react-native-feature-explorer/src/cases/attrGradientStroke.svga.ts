/*---------------------------------------------------------------------------------------
 * Copyright (c) Pixodesk LTD.
 * Licensed under the MIT License. See the LICENSE file in the project root for details.
 *---------------------------------------------------------------------------------------*/

import type { SvgaCaseJson } from '../caseTypes';

export const attrGradientStroke: SvgaCaseJson = {
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
            "d": "M120,130L180,170L180,130L120,170",
            "fill": "none",
            "strokeWidth": 5,
            "effects": {
                "strokeGradient": {
                    "type": "radial",
                    "c": [
                        150,
                        150
                    ],
                    "fp": [
                        150,
                        150
                    ],
                    "r": 38,
                    "stops": {
                        "keyframes": [
                            {
                                "time": 0,
                                "value": [
                                    {
                                        "offset": 0,
                                        "color": "#ff0000"
                                    },
                                    {
                                        "offset": 0.5,
                                        "color": "#ffff00"
                                    },
                                    {
                                        "offset": 1,
                                        "color": "#0000ff"
                                    }
                                ],
                                "easing": [
                                    0.5,
                                    0,
                                    0.5,
                                    1
                                ]
                            },
                            {
                                "time": 1000,
                                "value": [
                                    {
                                        "offset": 0,
                                        "color": "#0000ff"
                                    },
                                    {
                                        "offset": 0.5,
                                        "color": "#ff00ff"
                                    },
                                    {
                                        "offset": 1,
                                        "color": "#00ffff"
                                    }
                                ]
                            }
                        ]
                    },
                    "gradientUnits": "userSpaceOnUse",
                    "spreadMethod": "pad"
                }
            }
        },
        {
            "type": "path",
            "d": "M20,130L80,170L80,130L20,170",
            "fill": "none",
            "strokeWidth": 5,
            "effects": {
                "strokeGradient": {
                    "type": "radial",
                    "c": [
                        50,
                        150
                    ],
                    "fp": [
                        50,
                        150
                    ],
                    "r": 38,
                    "stops": [
                        {
                            "offset": 0,
                            "color": "#ff0000"
                        },
                        {
                            "offset": 0.5,
                            "color": "#ffff00"
                        },
                        {
                            "offset": 1,
                            "color": "#0000ff"
                        }
                    ],
                    "gradientUnits": "userSpaceOnUse",
                    "spreadMethod": "pad"
                }
            }
        },
        {
            "type": "path",
            "d": "M120,30L180,70L180,30L120,70",
            "fill": "none",
            "strokeWidth": 5,
            "effects": {
                "strokeGradient": {
                    "type": "linear",
                    "p1": [
                        118,
                        50
                    ],
                    "p2": [
                        182,
                        50
                    ],
                    "stops": {
                        "keyframes": [
                            {
                                "time": 0,
                                "value": [
                                    {
                                        "offset": 0,
                                        "color": "#ff0000"
                                    },
                                    {
                                        "offset": 0.5,
                                        "color": "#ffff00"
                                    },
                                    {
                                        "offset": 1,
                                        "color": "#0000ff"
                                    }
                                ],
                                "easing": [
                                    0.5,
                                    0,
                                    0.5,
                                    1
                                ]
                            },
                            {
                                "time": 1000,
                                "value": [
                                    {
                                        "offset": 0,
                                        "color": "#0000ff"
                                    },
                                    {
                                        "offset": 0.5,
                                        "color": "#ff00ff"
                                    },
                                    {
                                        "offset": 1,
                                        "color": "#00ffff"
                                    }
                                ]
                            }
                        ]
                    },
                    "gradientUnits": "userSpaceOnUse",
                    "spreadMethod": "pad"
                }
            }
        },
        {
            "type": "path",
            "d": "M20,30L80,70L80,30L20,70",
            "fill": "none",
            "strokeWidth": 5,
            "effects": {
                "strokeGradient": {
                    "type": "linear",
                    "p1": [
                        18,
                        50
                    ],
                    "p2": [
                        82,
                        50
                    ],
                    "stops": [
                        {
                            "offset": 0,
                            "color": "#ff0000"
                        },
                        {
                            "offset": 0.5,
                            "color": "#ffff00"
                        },
                        {
                            "offset": 1,
                            "color": "#0000ff"
                        }
                    ],
                    "gradientUnits": "userSpaceOnUse",
                    "spreadMethod": "pad"
                }
            }
        }
    ]
};
