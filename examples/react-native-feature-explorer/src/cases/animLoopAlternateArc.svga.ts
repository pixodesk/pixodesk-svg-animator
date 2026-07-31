/*---------------------------------------------------------------------------------------
 * Copyright (c) Pixodesk LTD.
 * Licensed under the MIT License. See the LICENSE file in the project root for details.
 *---------------------------------------------------------------------------------------*/

import type { SvgaCaseJson } from '../caseTypes';

export const animLoopAlternateArc: SvgaCaseJson = {
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
            "type": "ellipse",
            "rx": 30,
            "ry": 30,
            "stroke": "none",
            "transform": "translate(150,150)",
            "effects": {
                "fillGradient": {
                    "type": "linear",
                    "p1": [
                        -30,
                        0
                    ],
                    "p2": [
                        30,
                        0
                    ],
                    "stops": {
                        "loop": {
                            "alternate": true
                        },
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
                                    0.42,
                                    0,
                                    1,
                                    1
                                ]
                            },
                            {
                                "time": 500,
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
            "d": "M50,122L50,122L50,122L78,172.4L22,172.4L50,122z",
            "fill": "#66b34d",
            "stroke": "none",
            "animate": {
                "d": {
                    "keyframes": [
                        {
                            "time": 0,
                            "value": {
                                "path": "M50,122L50,122L50,122L78,172.4L22,172.4L50,122z"
                            }
                        },
                        {
                            "time": 500,
                            "value": {
                                "path": "M39.5101,140.8818C41.6265,137.0722,45.642,134.7095,50,134.7095C54.358,134.7095,58.3735,137.0722,60.4899,140.8818L78,172.4L22,172.4L39.5101,140.8818z"
                            }
                        }
                    ]
                }
            },
            "meta": {
                "appliedEffects": {
                    "shape": {
                        "value": {
                            "corners": [
                                {
                                    "pointIndex": 0,
                                    "r": 0
                                }
                            ],
                            "path": "M50,122L78,172.4L22,172.4L50,122z"
                        },
                        "keyframes": [
                            {
                                "time": 0
                            },
                            {
                                "time": 500,
                                "value": {
                                    "corners": [
                                        {
                                            "pointIndex": 0,
                                            "r": 12
                                        }
                                    ]
                                }
                            }
                        ]
                    }
                }
            }
        },
        {
            "type": "ellipse",
            "fill": "#3399e6",
            "rx": 6,
            "ry": 6,
            "stroke": "none",
            "transform": "translate(120,80)",
            "animate": {
                "transform": {
                    "loop": {
                        "alternate": true
                    },
                    "keyframes": [
                        {
                            "time": 0,
                            "value": {
                                "translate": [
                                    120,
                                    80
                                ]
                            },
                            "easing": [
                                0.42,
                                0,
                                1,
                                1
                            ]
                        },
                        {
                            "time": 120,
                            "value": {
                                "translate": [
                                    130,
                                    45
                                ]
                            },
                            "easing": [
                                0.42,
                                0,
                                1,
                                1
                            ]
                        },
                        {
                            "time": 250,
                            "value": {
                                "translate": [
                                    150,
                                    20
                                ]
                            },
                            "easing": [
                                0.42,
                                0,
                                1,
                                1
                            ]
                        },
                        {
                            "time": 370,
                            "value": {
                                "translate": [
                                    170,
                                    45
                                ]
                            },
                            "easing": [
                                0.42,
                                0,
                                1,
                                1
                            ]
                        },
                        {
                            "time": 500,
                            "value": {
                                "translate": [
                                    180,
                                    80
                                ]
                            }
                        }
                    ]
                }
            }
        },
        {
            "type": "ellipse",
            "fill": "#cc6633",
            "rx": 6,
            "ry": 6,
            "stroke": "none",
            "transform": "translate(20,80)",
            "animate": {
                "transform": {
                    "keyframes": [
                        {
                            "time": 0,
                            "value": {
                                "translate": [
                                    20,
                                    80
                                ]
                            },
                            "easing": [
                                0.42,
                                0,
                                1,
                                1
                            ]
                        },
                        {
                            "time": 120,
                            "value": {
                                "translate": [
                                    30,
                                    45
                                ]
                            },
                            "easing": [
                                0.42,
                                0,
                                1,
                                1
                            ]
                        },
                        {
                            "time": 250,
                            "value": {
                                "translate": [
                                    50,
                                    20
                                ]
                            },
                            "easing": [
                                0.42,
                                0,
                                1,
                                1
                            ]
                        },
                        {
                            "time": 370,
                            "value": {
                                "translate": [
                                    70,
                                    45
                                ]
                            },
                            "easing": [
                                0.42,
                                0,
                                1,
                                1
                            ]
                        },
                        {
                            "time": 500,
                            "value": {
                                "translate": [
                                    80,
                                    80
                                ]
                            }
                        }
                    ]
                }
            }
        }
    ]
};
