/*---------------------------------------------------------------------------------------
 * Copyright (c) Pixodesk LTD.
 * Licensed under the MIT License. See the LICENSE file in the project root for details.
 *---------------------------------------------------------------------------------------*/

import type { SvgaCaseJson } from '../caseTypes';

export const complexTrimLoader: SvgaCaseJson = {
    "type": "svg",
    "fill": "none",
    "viewBox": "0 0 420 420",
    "animator": {
        "duration": 3750,
        "mode": "auto",
        "direction": "normal",
        "timeline": "time",
        "trigger": {
            "startOn": "load",
            "outAction": "pause"
        }
    },
    "meta": {
        "label": "Loader trim"
    },
    "children": [
        {
            "type": "g",
            "transform": "translate(210,210)scale(2,2)",
            "animate": {
                "transform": {
                    "keyframes": [
                        {
                            "time": 0,
                            "value": {
                                "rotate": 0,
                                "translate": [
                                    210,
                                    210
                                ],
                                "scale": [
                                    2,
                                    2
                                ]
                            }
                        },
                        {
                            "time": 2500,
                            "value": {
                                "rotate": -360,
                                "translate": [
                                    210,
                                    210
                                ],
                                "scale": [
                                    2,
                                    2
                                ]
                            }
                        }
                    ]
                }
            },
            "meta": {
                "label": "Group rotation"
            },
            "children": [
                {
                    "type": "path",
                    "d": "M0,-89C49.1533,-89,89,-49.1533,89,0C89,49.1533,49.1533,89,0,89C-49.1533,89,-89,49.1533,-89,0C-89,-49.1533,-49.1533,-89,0,-89z",
                    "fill": "none",
                    "strokeLinecap": "round",
                    "strokeLinejoin": "round",
                    "strokeWidth": 5,
                    "effects": {
                        "strokeGradient": {
                            "type": "radial",
                            "c": [
                                0,
                                0
                            ],
                            "fp": [
                                0,
                                0
                            ],
                            "r": 94.29927299685441,
                            "stops": [
                                {
                                    "offset": 0.89,
                                    "color": "#fdc558"
                                },
                                {
                                    "offset": 1,
                                    "color": "#ffab06"
                                }
                            ],
                            "gradientUnits": "userSpaceOnUse",
                            "spreadMethod": "pad"
                        },
                        "trimPath": {
                            "range": {
                                "loop": true,
                                "keyframes": [
                                    {
                                        "time": 0,
                                        "value": [
                                            1,
                                            1
                                        ],
                                        "easing": [
                                            0.1616,
                                            0.1616,
                                            0.6032,
                                            0.6032
                                        ]
                                    },
                                    {
                                        "time": 380,
                                        "value": [
                                            1,
                                            1
                                        ],
                                        "easing": [
                                            0.4301,
                                            0.4301,
                                            0.8248,
                                            0.8248
                                        ]
                                    },
                                    {
                                        "time": 630,
                                        "value": [
                                            1,
                                            1
                                        ],
                                        "easing": [
                                            0.1911,
                                            0.1911,
                                            0.5758,
                                            0.5758
                                        ]
                                    },
                                    {
                                        "time": 750,
                                        "value": [
                                            0.8333,
                                            1
                                        ],
                                        "easing": [
                                            0.359,
                                            0.359,
                                            0.7374,
                                            0.7374
                                        ]
                                    },
                                    {
                                        "time": 880,
                                        "value": [
                                            0.6667,
                                            1
                                        ],
                                        "easing": [
                                            0.2493,
                                            0.2493,
                                            0.6232,
                                            0.6232
                                        ]
                                    },
                                    {
                                        "time": 1130,
                                        "value": [
                                            0.3333,
                                            0.6
                                        ],
                                        "easing": [
                                            0.3887,
                                            0.3887,
                                            0.7617,
                                            0.7617
                                        ]
                                    },
                                    {
                                        "time": 1380,
                                        "value": [
                                            0,
                                            0.2
                                        ],
                                        "easing": [
                                            0.3012,
                                            0.3012,
                                            0.6886,
                                            0.6886
                                        ]
                                    },
                                    {
                                        "time": 1500,
                                        "value": [
                                            0,
                                            0
                                        ],
                                        "easing": [
                                            0.2996,
                                            0.2996,
                                            0.6987,
                                            0.6987
                                        ]
                                    },
                                    {
                                        "time": 1630,
                                        "value": [
                                            0,
                                            0
                                        ],
                                        "easing": [
                                            0.2452,
                                            0.2452,
                                            0.63,
                                            0.63
                                        ]
                                    },
                                    {
                                        "time": 1750,
                                        "value": [
                                            0,
                                            0
                                        ],
                                        "easing": [
                                            0.4261,
                                            0.4261,
                                            0.8252,
                                            0.8252
                                        ]
                                    },
                                    {
                                        "time": 1880,
                                        "value": [
                                            0,
                                            0
                                        ]
                                    }
                                ]
                            }
                        }
                    },
                    "meta": {
                        "label": "Yellow stroke trim"
                    }
                },
                {
                    "type": "path",
                    "d": "M0,-67C37.0031,-67,67,-37.0031,67,0C67,37.0031,37.0031,67,0,67C-37.0031,67,-67,37.0031,-67,0C-67,-37.0031,-37.0031,-67,0,-67z",
                    "fill": "none",
                    "strokeLinecap": "round",
                    "strokeLinejoin": "round",
                    "strokeWidth": 15,
                    "effects": {
                        "strokeGradient": {
                            "type": "radial",
                            "c": [
                                0,
                                0
                            ],
                            "fp": [
                                0,
                                0
                            ],
                            "r": 75.22504842934781,
                            "stops": [
                                {
                                    "offset": 0.85,
                                    "color": "#ff649c"
                                },
                                {
                                    "offset": 1,
                                    "color": "#fe2b77"
                                }
                            ],
                            "gradientUnits": "userSpaceOnUse",
                            "spreadMethod": "pad"
                        },
                        "trimPath": {
                            "range": {
                                "loop": true,
                                "keyframes": [
                                    {
                                        "time": 0,
                                        "value": [
                                            1,
                                            1
                                        ],
                                        "easing": [
                                            0.1592,
                                            0.1592,
                                            0.6205,
                                            0.6205
                                        ]
                                    },
                                    {
                                        "time": 250,
                                        "value": [
                                            1,
                                            1
                                        ],
                                        "easing": [
                                            0.4356,
                                            0.4356,
                                            0.8173,
                                            0.8173
                                        ]
                                    },
                                    {
                                        "time": 380,
                                        "value": [
                                            1,
                                            1
                                        ],
                                        "easing": [
                                            0.1865,
                                            0.1865,
                                            0.6988,
                                            0.6988
                                        ]
                                    },
                                    {
                                        "time": 500,
                                        "value": [
                                            0.8,
                                            1
                                        ],
                                        "easing": [
                                            0.2383,
                                            0.2383,
                                            0.6113,
                                            0.6113
                                        ]
                                    },
                                    {
                                        "time": 750,
                                        "value": [
                                            0.4,
                                            0.6667
                                        ],
                                        "easing": [
                                            0.3768,
                                            0.3768,
                                            0.7507,
                                            0.7507
                                        ]
                                    },
                                    {
                                        "time": 1000,
                                        "value": [
                                            0,
                                            0.3333
                                        ],
                                        "easing": [
                                            0.2705,
                                            0.2705,
                                            0.6314,
                                            0.6314
                                        ]
                                    },
                                    {
                                        "time": 1130,
                                        "value": [
                                            0,
                                            0.1667
                                        ],
                                        "easing": [
                                            0.3776,
                                            0.3776,
                                            0.7307,
                                            0.7307
                                        ]
                                    },
                                    {
                                        "time": 1250,
                                        "value": [
                                            0,
                                            0
                                        ],
                                        "easing": [
                                            0.3091,
                                            0.3091,
                                            0.6909,
                                            0.6909
                                        ]
                                    },
                                    {
                                        "time": 1380,
                                        "value": [
                                            0,
                                            0
                                        ],
                                        "easing": [
                                            0.2452,
                                            0.2452,
                                            0.63,
                                            0.63
                                        ]
                                    },
                                    {
                                        "time": 1500,
                                        "value": [
                                            0,
                                            0
                                        ],
                                        "easing": [
                                            0.4261,
                                            0.4261,
                                            0.8252,
                                            0.8252
                                        ]
                                    },
                                    {
                                        "time": 1630,
                                        "value": [
                                            0,
                                            0
                                        ],
                                        "easing": [
                                            0.167,
                                            0.167,
                                            0.5835,
                                            0.5835
                                        ]
                                    },
                                    {
                                        "time": 1750,
                                        "value": [
                                            0,
                                            0
                                        ],
                                        "easing": [
                                            0.4165,
                                            0.4165,
                                            0.833,
                                            0.833
                                        ]
                                    },
                                    {
                                        "time": 1880,
                                        "value": [
                                            0,
                                            0
                                        ]
                                    }
                                ]
                            }
                        }
                    },
                    "meta": {
                        "label": "Red stroke trim"
                    }
                },
                {
                    "type": "path",
                    "d": "M0,-45C24.8528,-45,45,-24.8528,45,0C45,24.8528,24.8528,45,0,45C-24.8528,45,-45,24.8528,-45,0C-45,-24.8528,-24.8528,-45,0,-45z",
                    "fill": "none",
                    "strokeLinecap": "round",
                    "strokeLinejoin": "round",
                    "strokeWidth": 10,
                    "effects": {
                        "strokeGradient": {
                            "type": "radial",
                            "c": [
                                0,
                                0
                            ],
                            "fp": [
                                0,
                                0
                            ],
                            "r": 56.942118946215615,
                            "stops": [
                                {
                                    "offset": 0.78,
                                    "color": "#4886ff"
                                },
                                {
                                    "offset": 1,
                                    "color": "#0242c1"
                                }
                            ],
                            "gradientUnits": "userSpaceOnUse",
                            "spreadMethod": "pad"
                        },
                        "trimPath": {
                            "range": {
                                "loop": true,
                                "keyframes": [
                                    {
                                        "time": 0,
                                        "value": [
                                            1,
                                            1
                                        ],
                                        "easing": [
                                            0.1911,
                                            0.1911,
                                            0.5758,
                                            0.5758
                                        ]
                                    },
                                    {
                                        "time": 130,
                                        "value": [
                                            0.8333,
                                            1
                                        ],
                                        "easing": [
                                            0.359,
                                            0.359,
                                            0.7374,
                                            0.7374
                                        ]
                                    },
                                    {
                                        "time": 250,
                                        "value": [
                                            0.6667,
                                            1
                                        ],
                                        "easing": [
                                            0.2493,
                                            0.2493,
                                            0.6232,
                                            0.6232
                                        ]
                                    },
                                    {
                                        "time": 500,
                                        "value": [
                                            0.3333,
                                            0.6
                                        ],
                                        "easing": [
                                            0.3887,
                                            0.3887,
                                            0.7617,
                                            0.7617
                                        ]
                                    },
                                    {
                                        "time": 750,
                                        "value": [
                                            0,
                                            0.2
                                        ],
                                        "easing": [
                                            0.3012,
                                            0.3012,
                                            0.6886,
                                            0.6886
                                        ]
                                    },
                                    {
                                        "time": 880,
                                        "value": [
                                            0,
                                            0
                                        ],
                                        "easing": [
                                            0.2996,
                                            0.2996,
                                            0.6987,
                                            0.6987
                                        ]
                                    },
                                    {
                                        "time": 1000,
                                        "value": [
                                            0,
                                            0
                                        ],
                                        "easing": [
                                            0.2452,
                                            0.2452,
                                            0.63,
                                            0.63
                                        ]
                                    },
                                    {
                                        "time": 1130,
                                        "value": [
                                            0,
                                            0
                                        ],
                                        "easing": [
                                            0.4261,
                                            0.4261,
                                            0.8252,
                                            0.8252
                                        ]
                                    },
                                    {
                                        "time": 1250,
                                        "value": [
                                            0,
                                            0
                                        ],
                                        "easing": [
                                            0.1616,
                                            0.1616,
                                            0.6032,
                                            0.6032
                                        ]
                                    },
                                    {
                                        "time": 1630,
                                        "value": [
                                            0,
                                            0
                                        ],
                                        "easing": [
                                            0.4301,
                                            0.4301,
                                            0.8248,
                                            0.8248
                                        ]
                                    },
                                    {
                                        "time": 1880,
                                        "value": [
                                            0,
                                            0
                                        ]
                                    }
                                ]
                            }
                        }
                    },
                    "meta": {
                        "label": "Blue stroke trim"
                    }
                }
            ]
        }
    ]
};
