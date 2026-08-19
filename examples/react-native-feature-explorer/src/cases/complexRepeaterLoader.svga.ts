/*---------------------------------------------------------------------------------------
 * Copyright (c) Pixodesk LTD.
 * Licensed under the MIT License. See the LICENSE file in the project root for details.
 *---------------------------------------------------------------------------------------*/

import type { SvgaCaseJson } from '../caseTypes';

export const complexRepeaterLoader: SvgaCaseJson = {
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
        "label": "Loader repeater"
    },
    "children": [
        {
            "type": "g",
            "opacity": 0,
            "transform": "translate(210,209.9404)scale(1.98,1.98)",
            "animate": {
                "opacity": {
                    "loop": true,
                    "keyframes": [
                        {
                            "time": 0,
                            "value": 0
                        },
                        {
                            "time": 130,
                            "value": 0,
                            "easing": [
                                0.225,
                                0.225,
                                0.5735,
                                0.5735
                            ]
                        },
                        {
                            "time": 380,
                            "value": 1,
                            "easing": [
                                0.2716,
                                0.2716,
                                0.6461,
                                0.6461
                            ]
                        },
                        {
                            "time": 1130,
                            "value": 1
                        },
                        {
                            "time": 1500,
                            "value": 0,
                            "easing": [
                                0.1736,
                                0.1736,
                                0.5718,
                                0.5718
                            ]
                        },
                        {
                            "time": 2130,
                            "value": 0,
                            "easing": [
                                0.4004,
                                0.4004,
                                0.8377,
                                0.8377
                            ]
                        },
                        {
                            "time": 2380,
                            "value": 1
                        },
                        {
                            "time": 3130,
                            "value": 1
                        },
                        {
                            "time": 3500,
                            "value": 0
                        },
                        {
                            "time": 3750,
                            "value": 0
                        }
                    ]
                },
                "transform": {
                    "loop": true,
                    "keyframes": [
                        {
                            "time": 0,
                            "value": {
                                "rotate": 0,
                                "translate": [
                                    210,
                                    209.9404
                                ],
                                "scale": [
                                    1.98,
                                    1.98
                                ]
                            },
                            "easing": [
                                0.3333,
                                0.4715,
                                0.6667,
                                0.8048
                            ]
                        },
                        {
                            "time": 1130,
                            "value": {
                                "rotate": 41,
                                "translate": [
                                    210,
                                    209.9404
                                ],
                                "scale": [
                                    1.98,
                                    1.98
                                ]
                            },
                            "easing": [
                                0.3333,
                                0.6667,
                                0.6667,
                                1
                            ]
                        },
                        {
                            "time": 1880,
                            "value": {
                                "rotate": 100,
                                "translate": [
                                    210,
                                    209.9404
                                ],
                                "scale": [
                                    1.98,
                                    1.98
                                ]
                            }
                        },
                        {
                            "time": 3130,
                            "value": {
                                "rotate": 41,
                                "translate": [
                                    210,
                                    209.9404
                                ],
                                "scale": [
                                    1.98,
                                    1.98
                                ]
                            },
                            "easing": [
                                0.3333,
                                0.6667,
                                0.6667,
                                1
                            ]
                        },
                        {
                            "time": 3750,
                            "value": {
                                "rotate": 100,
                                "translate": [
                                    210,
                                    209.9404
                                ],
                                "scale": [
                                    1.98,
                                    1.98
                                ]
                            }
                        }
                    ]
                }
            },
            "effects": {
                "repeater": {
                    "copies": 12,
                    "rotate": 30
                }
            },
            "meta": {
                "label": "Repeater Circle"
            },
            "children": [
                {
                    "type": "ellipse",
                    "rx": 5,
                    "ry": 5,
                    "stroke": "none",
                    "transform": "translate(7,-25)scale(0.78,0.78)",
                    "animate": {
                        "transform": {
                            "loop": true,
                            "keyframes": [
                                {
                                    "time": 0,
                                    "value": {
                                        "translate": [
                                            7,
                                            -25
                                        ],
                                        "scale": [
                                            0.78,
                                            0.78
                                        ]
                                    },
                                    "easing": [
                                        0.77,
                                        0,
                                        0.175,
                                        1
                                    ]
                                },
                                {
                                    "time": 880,
                                    "value": {
                                        "translate": [
                                            22,
                                            -81
                                        ],
                                        "scale": [
                                            1,
                                            1
                                        ]
                                    },
                                    "easing": [
                                        0.77,
                                        0,
                                        0.175,
                                        1
                                    ]
                                },
                                {
                                    "time": 1750,
                                    "value": {
                                        "translate": [
                                            7,
                                            -25
                                        ],
                                        "scale": [
                                            0.78,
                                            0.78
                                        ]
                                    },
                                    "easing": [
                                        0,
                                        0,
                                        1,
                                        1
                                    ]
                                },
                                {
                                    "time": 1880,
                                    "value": {
                                        "translate": [
                                            7,
                                            -25
                                        ],
                                        "scale": [
                                            0.78,
                                            0.78
                                        ]
                                    },
                                    "easing": [
                                        0.77,
                                        0,
                                        0.175,
                                        1
                                    ]
                                },
                                {
                                    "time": 2750,
                                    "value": {
                                        "translate": [
                                            22,
                                            -81
                                        ],
                                        "scale": [
                                            1,
                                            1
                                        ]
                                    },
                                    "easing": [
                                        0.77,
                                        0,
                                        0.175,
                                        1
                                    ]
                                },
                                {
                                    "time": 3630,
                                    "value": {
                                        "translate": [
                                            7,
                                            -25
                                        ],
                                        "scale": [
                                            0.78,
                                            0.78
                                        ]
                                    },
                                    "easing": [
                                        0.77,
                                        0,
                                        0.175,
                                        1
                                    ]
                                },
                                {
                                    "time": 3750,
                                    "value": {
                                        "translate": [
                                            7,
                                            -25
                                        ],
                                        "scale": [
                                            0.78,
                                            0.78
                                        ]
                                    }
                                }
                            ]
                        }
                    },
                    "effects": {
                        "fillGradient": {
                            "type": "radial",
                            "c": [
                                0,
                                0
                            ],
                            "fp": [
                                0,
                                0
                            ],
                            "r": 5,
                            "stops": {
                                "keyframes": [
                                    {
                                        "time": 0,
                                        "value": [
                                            {
                                                "offset": 0.31,
                                                "color": "#79a5fb"
                                            },
                                            {
                                                "offset": 1,
                                                "color": "#3e7cf3"
                                            }
                                        ]
                                    },
                                    {
                                        "time": 630,
                                        "value": [
                                            {
                                                "offset": 0.43,
                                                "color": "#5d94ff"
                                            },
                                            {
                                                "offset": 1,
                                                "color": "#024edb"
                                            }
                                        ]
                                    },
                                    {
                                        "time": 1880,
                                        "value": [
                                            {
                                                "offset": 0.31,
                                                "color": "#79a5fb"
                                            },
                                            {
                                                "offset": 1,
                                                "color": "#3e7cf3"
                                            }
                                        ]
                                    },
                                    {
                                        "time": 3750,
                                        "value": [
                                            {
                                                "offset": 0.24,
                                                "color": "#ffd277"
                                            },
                                            {
                                                "offset": 0.38,
                                                "color": "#ffb82a"
                                            }
                                        ]
                                    }
                                ]
                            },
                            "gradientUnits": "userSpaceOnUse",
                            "spreadMethod": "pad"
                        }
                    },
                    "meta": {
                        "label": "Circle"
                    }
                }
            ]
        },
        {
            "type": "g",
            "opacity": 0,
            "transform": "translate(210,209.9404)scale(1.98,1.98)",
            "animate": {
                "opacity": {
                    "loop": true,
                    "keyframes": [
                        {
                            "time": 0,
                            "value": 0
                        },
                        {
                            "time": 130,
                            "value": 0,
                            "easing": [
                                0.225,
                                0.225,
                                0.5735,
                                0.5735
                            ]
                        },
                        {
                            "time": 380,
                            "value": 1,
                            "easing": [
                                0.2716,
                                0.2716,
                                0.6461,
                                0.6461
                            ]
                        },
                        {
                            "time": 1130,
                            "value": 1
                        },
                        {
                            "time": 1500,
                            "value": 0,
                            "easing": [
                                0.1736,
                                0.1736,
                                0.5718,
                                0.5718
                            ]
                        },
                        {
                            "time": 2130,
                            "value": 0,
                            "easing": [
                                0.4004,
                                0.4004,
                                0.8377,
                                0.8377
                            ]
                        },
                        {
                            "time": 2380,
                            "value": 1
                        },
                        {
                            "time": 3130,
                            "value": 1
                        },
                        {
                            "time": 3500,
                            "value": 0
                        },
                        {
                            "time": 3750,
                            "value": 0
                        }
                    ]
                },
                "transform": {
                    "loop": true,
                    "keyframes": [
                        {
                            "time": 0,
                            "value": {
                                "rotate": 0,
                                "translate": [
                                    210,
                                    209.9404
                                ],
                                "scale": [
                                    1.98,
                                    1.98
                                ]
                            },
                            "easing": [
                                0.3333,
                                0.4715,
                                0.6667,
                                0.8048
                            ]
                        },
                        {
                            "time": 1130,
                            "value": {
                                "rotate": 41,
                                "translate": [
                                    210,
                                    209.9404
                                ],
                                "scale": [
                                    1.98,
                                    1.98
                                ]
                            },
                            "easing": [
                                0.3333,
                                0.6667,
                                0.6667,
                                1
                            ]
                        },
                        {
                            "time": 1880,
                            "value": {
                                "rotate": 100,
                                "translate": [
                                    210,
                                    209.9404
                                ],
                                "scale": [
                                    1.98,
                                    1.98
                                ]
                            }
                        },
                        {
                            "time": 3130,
                            "value": {
                                "rotate": 41,
                                "translate": [
                                    210,
                                    209.9404
                                ],
                                "scale": [
                                    1.98,
                                    1.98
                                ]
                            },
                            "easing": [
                                0.3333,
                                0.6667,
                                0.6667,
                                1
                            ]
                        },
                        {
                            "time": 3750,
                            "value": {
                                "rotate": 100,
                                "translate": [
                                    210,
                                    209.9404
                                ],
                                "scale": [
                                    1.98,
                                    1.98
                                ]
                            }
                        }
                    ]
                }
            },
            "effects": {
                "repeater": {
                    "copies": 12,
                    "rotate": 30
                }
            },
            "meta": {
                "label": "Repeater Rectangle"
            },
            "children": [
                {
                    "type": "rect",
                    "height": 18.75,
                    "rx": 4,
                    "ry": 4,
                    "stroke": "none",
                    "transform": "translate(0.9551,-65.32)rotate(45)scale(0.5051,0.5051)",
                    "width": 18.75,
                    "x": -9.375,
                    "y": -9.375,
                    "effects": {
                        "fillGradient": {
                            "type": "radial",
                            "c": [
                                -2.767059655093931,
                                -0.30409740395394635
                            ],
                            "fp": [
                                -2.767059655093931,
                                -0.30409740395394635
                            ],
                            "r": 16.538571510007976,
                            "stops": {
                                "keyframes": [
                                    {
                                        "time": 0,
                                        "value": [
                                            {
                                                "offset": 0.31,
                                                "color": "#79a5fb"
                                            },
                                            {
                                                "offset": 1,
                                                "color": "#3e7cf3"
                                            }
                                        ]
                                    },
                                    {
                                        "time": 630,
                                        "value": [
                                            {
                                                "offset": 0.43,
                                                "color": "#5d94ff"
                                            },
                                            {
                                                "offset": 1,
                                                "color": "#024edb"
                                            }
                                        ]
                                    },
                                    {
                                        "time": 1880,
                                        "value": [
                                            {
                                                "offset": 0.31,
                                                "color": "#79a5fb"
                                            },
                                            {
                                                "offset": 1,
                                                "color": "#3e7cf3"
                                            }
                                        ]
                                    },
                                    {
                                        "time": 3750,
                                        "value": [
                                            {
                                                "offset": 0.24,
                                                "color": "#ffd277"
                                            },
                                            {
                                                "offset": 0.38,
                                                "color": "#ffb82a"
                                            }
                                        ]
                                    }
                                ]
                            },
                            "gradientUnits": "userSpaceOnUse",
                            "spreadMethod": "pad"
                        }
                    },
                    "meta": {
                        "label": "Rectangle"
                    }
                }
            ]
        },
        {
            "type": "path",
            "d": "M0,-26C14.3594,-26,26,-14.3594,26,0C26,14.3594,14.3594,26,0,26C-14.3594,26,-26,14.3594,-26,0C-26,-14.3594,-14.3594,-26,0,-26z",
            "fill": "none",
            "strokeLinecap": "round",
            "strokeLinejoin": "round",
            "strokeWidth": 11,
            "transform": "translate(210,209.9404)scale(1.98,1.98)",
            "animate": {
                "transform": {
                    "keyframes": [
                        {
                            "time": 0,
                            "value": {
                                "rotate": 0,
                                "translate": [
                                    210,
                                    209.9404
                                ],
                                "scale": [
                                    1.98,
                                    1.98
                                ]
                            }
                        },
                        {
                            "time": 3750,
                            "value": {
                                "rotate": 360,
                                "translate": [
                                    210,
                                    209.9404
                                ],
                                "scale": [
                                    1.98,
                                    1.98
                                ]
                            }
                        }
                    ]
                }
            },
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
                    "r": 32.19858036788542,
                    "stops": {
                        "keyframes": [
                            {
                                "time": 0,
                                "value": [
                                    {
                                        "offset": 0.8079,
                                        "color": "#3079fd"
                                    },
                                    {
                                        "offset": 1,
                                        "color": "#004de3"
                                    }
                                ]
                            },
                            {
                                "time": 1880,
                                "value": [
                                    {
                                        "offset": 0.8079,
                                        "color": "#3079fd"
                                    },
                                    {
                                        "offset": 1,
                                        "color": "#004de3"
                                    }
                                ]
                            },
                            {
                                "time": 3750,
                                "value": [
                                    {
                                        "offset": 0.75,
                                        "color": "#ffd277"
                                    },
                                    {
                                        "offset": 1,
                                        "color": "#ffb82a"
                                    }
                                ]
                            }
                        ]
                    },
                    "gradientUnits": "userSpaceOnUse",
                    "spreadMethod": "pad"
                },
                "strokeTrim": {
                    "range": {
                        "loop": true,
                        "keyframes": [
                            {
                                "time": 0,
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
                                "time": 380,
                                "value": [
                                    0.6,
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
                                "time": 630,
                                "value": [
                                    1,
                                    0
                                ],
                                "easing": [
                                    0.1827,
                                    0.1827,
                                    0.5925,
                                    0.5925
                                ]
                            },
                            {
                                "time": 880,
                                "value": [
                                    1,
                                    0.6667
                                ],
                                "easing": [
                                    0.3756,
                                    0.3756,
                                    0.7342,
                                    0.7342
                                ]
                            },
                            {
                                "time": 1000,
                                "value": [
                                    1,
                                    1
                                ],
                                "easing": [
                                    0.2408,
                                    0.2408,
                                    0.6391,
                                    0.6391
                                ]
                            },
                            {
                                "time": 1500,
                                "value": [
                                    1,
                                    1
                                ],
                                "easing": [
                                    0.432,
                                    0.432,
                                    0.8201,
                                    0.8201
                                ]
                            },
                            {
                                "time": 1880,
                                "value": [
                                    1,
                                    1
                                ]
                            }
                        ]
                    }
                }
            },
            "meta": {
                "label": "Circle trim"
            }
        }
    ]
};
