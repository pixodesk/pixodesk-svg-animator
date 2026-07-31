/*---------------------------------------------------------------------------------------
 * Copyright (c) Pixodesk LTD.
 * Licensed under the MIT License. See the LICENSE file in the project root for details.
 *---------------------------------------------------------------------------------------*/

import type { SvgaCaseJson } from '../caseTypes';

export const complexFirework: SvgaCaseJson = {
    "type": "svg",
    "fill": "none",
    "viewBox": "0 0 400 400",
    "animator": {
        "duration": 6250,
        "mode": "auto",
        "direction": "normal",
        "timeline": "time",
        "trigger": {
            "startOn": "load",
            "outAction": "pause"
        }
    },
    "meta": {
        "label": "Firework"
    },
    "children": [
        {
            "type": "rect",
            "height": 400,
            "stroke": "none",
            "transform": "translate(200,200)",
            "width": 400,
            "x": -200,
            "y": -200,
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
                    "r": 294.5776496891772,
                    "stops": [
                        {
                            "offset": 0,
                            "color": "#013793"
                        },
                        {
                            "offset": 0.19,
                            "color": "#012c74"
                        },
                        {
                            "offset": 0.4,
                            "color": "#002562"
                        },
                        {
                            "offset": 0.64,
                            "color": "#012157"
                        },
                        {
                            "offset": 1,
                            "color": "#000a1d"
                        }
                    ],
                    "gradientUnits": "userSpaceOnUse",
                    "spreadMethod": "pad"
                }
            },
            "meta": {
                "label": "Background"
            }
        },
        {
            "type": "g",
            "transform": "translate(200,200)translate(-200,-200)",
            "meta": {
                "label": "Squares"
            },
            "children": [
                {
                    "type": "g",
                    "transform": "translate(200,200)translate(-200,-200)",
                    "meta": {
                        "label": "Squares background"
                    },
                    "children": [
                        {
                            "type": "g",
                            "transform": "translate(200,200)",
                            "animate": {
                                "transform": {
                                    "keyframes": [
                                        {
                                            "time": 1880,
                                            "value": {
                                                "rotate": 0,
                                                "translate": [
                                                    200,
                                                    200
                                                ]
                                            },
                                            "easing": [
                                                0.25,
                                                0.46,
                                                0.45,
                                                0.94
                                            ]
                                        },
                                        {
                                            "time": 4250,
                                            "value": {
                                                "rotate": 30,
                                                "translate": [
                                                    200,
                                                    200
                                                ]
                                            }
                                        }
                                    ]
                                }
                            },
                            "meta": {
                                "label": "Rotation"
                            },
                            "children": [
                                {
                                    "type": "g",
                                    "opacity": 0,
                                    "animate": {
                                        "opacity": {
                                            "keyframes": [
                                                {
                                                    "time": 1880,
                                                    "value": 0,
                                                    "easing": [
                                                        0.42,
                                                        0,
                                                        1,
                                                        1
                                                    ]
                                                },
                                                {
                                                    "time": 2630,
                                                    "value": 1,
                                                    "easing": [
                                                        0,
                                                        0,
                                                        1,
                                                        1
                                                    ]
                                                },
                                                {
                                                    "time": 3750,
                                                    "value": 1,
                                                    "easing": [
                                                        0.55,
                                                        0.055,
                                                        0.675,
                                                        0.19
                                                    ]
                                                },
                                                {
                                                    "time": 6630,
                                                    "value": 0
                                                }
                                            ]
                                        }
                                    },
                                    "effects": {
                                        "repeater": {
                                            "copies": 4,
                                            "rotate": 21,
                                            "scale": [
                                                132,
                                                132
                                            ]
                                        }
                                    },
                                    "meta": {
                                        "label": "Clone with scale and rotation"
                                    },
                                    "children": [
                                        {
                                            "type": "g",
                                            "animate": {
                                                "transform": {
                                                    "keyframes": [
                                                        {
                                                            "time": 1880,
                                                            "value": {
                                                                "translate": [
                                                                    0,
                                                                    0
                                                                ]
                                                            },
                                                            "easing": [
                                                                0.215,
                                                                0.61,
                                                                0.355,
                                                                1
                                                            ]
                                                        },
                                                        {
                                                            "time": 4380,
                                                            "value": {
                                                                "translate": [
                                                                    0,
                                                                    -100
                                                                ]
                                                            }
                                                        }
                                                    ]
                                                }
                                            },
                                            "meta": {
                                                "label": "Clone anchor fix"
                                            },
                                            "children": [
                                                {
                                                    "type": "g",
                                                    "effects": {
                                                        "repeater": {
                                                            "copies": 8,
                                                            "origin": {
                                                                "keyframes": [
                                                                    {
                                                                        "time": 1880,
                                                                        "value": [
                                                                            0,
                                                                            0
                                                                        ],
                                                                        "easing": [
                                                                            0.215,
                                                                            0.61,
                                                                            0.355,
                                                                            1
                                                                        ]
                                                                    },
                                                                    {
                                                                        "time": 4380,
                                                                        "value": [
                                                                            0,
                                                                            100
                                                                        ]
                                                                    }
                                                                ]
                                                            },
                                                            "rotate": 45
                                                        }
                                                    },
                                                    "meta": {
                                                        "label": "Clone with rotation"
                                                    },
                                                    "children": [
                                                        {
                                                            "type": "rect",
                                                            "height": 4,
                                                            "stroke": "#80aeff",
                                                            "strokeLinecap": "round",
                                                            "strokeLinejoin": "round",
                                                            "strokeWidth": 2,
                                                            "width": 4,
                                                            "x": -2,
                                                            "y": -2,
                                                            "animate": {
                                                                "transform": {
                                                                    "keyframes": [
                                                                        {
                                                                            "time": 1880,
                                                                            "value": {
                                                                                "rotate": 0
                                                                            },
                                                                            "easing": [
                                                                                0.215,
                                                                                0.61,
                                                                                0.355,
                                                                                1
                                                                            ]
                                                                        },
                                                                        {
                                                                            "time": 4380,
                                                                            "value": {
                                                                                "rotate": 53
                                                                            }
                                                                        }
                                                                    ]
                                                                },
                                                                "width": {
                                                                    "keyframes": [
                                                                        {
                                                                            "time": 1880,
                                                                            "value": 4,
                                                                            "easing": [
                                                                                0.215,
                                                                                0.61,
                                                                                0.355,
                                                                                1
                                                                            ]
                                                                        },
                                                                        {
                                                                            "time": 4380,
                                                                            "value": 16
                                                                        }
                                                                    ]
                                                                },
                                                                "height": {
                                                                    "keyframes": [
                                                                        {
                                                                            "time": 1880,
                                                                            "value": 4,
                                                                            "easing": [
                                                                                0.215,
                                                                                0.61,
                                                                                0.355,
                                                                                1
                                                                            ]
                                                                        },
                                                                        {
                                                                            "time": 4380,
                                                                            "value": 16
                                                                        }
                                                                    ]
                                                                }
                                                            },
                                                            "meta": {
                                                                "label": "Rectangle"
                                                            }
                                                        }
                                                    ]
                                                }
                                            ]
                                        }
                                    ]
                                }
                            ]
                        }
                    ]
                },
                {
                    "type": "g",
                    "transform": "translate(200,200)rotate(7)scale(0.81,0.81)",
                    "animate": {
                        "transform": {
                            "keyframes": [
                                {
                                    "time": 1880,
                                    "value": {
                                        "rotate": 7,
                                        "translate": [
                                            200,
                                            200
                                        ],
                                        "scale": [
                                            0.81,
                                            0.81
                                        ]
                                    },
                                    "easing": [
                                        0.25,
                                        0.46,
                                        0.45,
                                        0.94
                                    ]
                                },
                                {
                                    "time": 4380,
                                    "value": {
                                        "rotate": 37,
                                        "translate": [
                                            200,
                                            200
                                        ],
                                        "scale": [
                                            0.81,
                                            0.81
                                        ]
                                    }
                                }
                            ]
                        }
                    },
                    "meta": {
                        "label": "Rotation"
                    },
                    "children": [
                        {
                            "type": "g",
                            "opacity": 0,
                            "animate": {
                                "opacity": {
                                    "keyframes": [
                                        {
                                            "time": 880,
                                            "value": 0,
                                            "easing": [
                                                0.42,
                                                0,
                                                1,
                                                1
                                            ]
                                        },
                                        {
                                            "time": 2630,
                                            "value": 1,
                                            "easing": [
                                                0,
                                                0,
                                                1,
                                                1
                                            ]
                                        },
                                        {
                                            "time": 3750,
                                            "value": 1,
                                            "easing": [
                                                0.55,
                                                0.055,
                                                0.675,
                                                0.19
                                            ]
                                        },
                                        {
                                            "time": 8630,
                                            "value": 0
                                        }
                                    ]
                                }
                            },
                            "effects": {
                                "repeater": {
                                    "copies": 4,
                                    "rotate": 21,
                                    "scale": [
                                        132,
                                        132
                                    ]
                                }
                            },
                            "meta": {
                                "label": "Clone with scale and rotation"
                            },
                            "children": [
                                {
                                    "type": "g",
                                    "animate": {
                                        "transform": {
                                            "keyframes": [
                                                {
                                                    "time": 1880,
                                                    "value": {
                                                        "translate": [
                                                            0,
                                                            0
                                                        ]
                                                    },
                                                    "easing": [
                                                        0.215,
                                                        0.61,
                                                        0.355,
                                                        1
                                                    ]
                                                },
                                                {
                                                    "time": 4380,
                                                    "value": {
                                                        "translate": [
                                                            0,
                                                            -100
                                                        ]
                                                    }
                                                }
                                            ]
                                        }
                                    },
                                    "effects": {
                                        "repeater": {
                                            "copies": 3
                                        }
                                    },
                                    "meta": {
                                        "label": "Clone anchor fix"
                                    },
                                    "children": [
                                        {
                                            "type": "g",
                                            "effects": {
                                                "repeater": {
                                                    "copies": 8,
                                                    "origin": {
                                                        "keyframes": [
                                                            {
                                                                "time": 1880,
                                                                "value": [
                                                                    0,
                                                                    0
                                                                ],
                                                                "easing": [
                                                                    0.215,
                                                                    0.61,
                                                                    0.355,
                                                                    1
                                                                ]
                                                            },
                                                            {
                                                                "time": 4380,
                                                                "value": [
                                                                    0,
                                                                    100
                                                                ]
                                                            }
                                                        ]
                                                    },
                                                    "rotate": 45
                                                }
                                            },
                                            "meta": {
                                                "label": "Clone with rotation"
                                            },
                                            "children": [
                                                {
                                                    "type": "rect",
                                                    "height": 4,
                                                    "stroke": "#fffd80",
                                                    "strokeLinecap": "round",
                                                    "strokeLinejoin": "round",
                                                    "strokeWidth": 2,
                                                    "width": 4,
                                                    "x": -2,
                                                    "y": -2,
                                                    "animate": {
                                                        "transform": {
                                                            "keyframes": [
                                                                {
                                                                    "time": 1880,
                                                                    "value": {
                                                                        "rotate": 0
                                                                    },
                                                                    "easing": [
                                                                        0.215,
                                                                        0.61,
                                                                        0.355,
                                                                        1
                                                                    ]
                                                                },
                                                                {
                                                                    "time": 4380,
                                                                    "value": {
                                                                        "rotate": 53
                                                                    }
                                                                }
                                                            ]
                                                        },
                                                        "width": {
                                                            "keyframes": [
                                                                {
                                                                    "time": 1880,
                                                                    "value": 4,
                                                                    "easing": [
                                                                        0.215,
                                                                        0.61,
                                                                        0.355,
                                                                        1
                                                                    ]
                                                                },
                                                                {
                                                                    "time": 4380,
                                                                    "value": 16
                                                                }
                                                            ]
                                                        },
                                                        "height": {
                                                            "keyframes": [
                                                                {
                                                                    "time": 1880,
                                                                    "value": 4,
                                                                    "easing": [
                                                                        0.215,
                                                                        0.61,
                                                                        0.355,
                                                                        1
                                                                    ]
                                                                },
                                                                {
                                                                    "time": 4380,
                                                                    "value": 16
                                                                }
                                                            ]
                                                        }
                                                    },
                                                    "meta": {
                                                        "label": "Rectangle"
                                                    }
                                                }
                                            ]
                                        }
                                    ]
                                }
                            ]
                        }
                    ]
                }
            ]
        },
        {
            "type": "g",
            "transform": "translate(200,200)",
            "meta": {
                "label": "Lines long"
            },
            "children": [
                {
                    "type": "g",
                    "transform": "translate(-200,-200)",
                    "effects": {
                        "repeater": {
                            "copies": 8,
                            "origin": [
                                200,
                                200
                            ],
                            "rotate": 45
                        }
                    },
                    "meta": {
                        "label": "Clone with rotation"
                    },
                    "children": [
                        {
                            "type": "path",
                            "d": "M200,200L200,50",
                            "fill": "none",
                            "stroke": "#ffffff",
                            "strokeLinecap": "round",
                            "strokeLinejoin": "round",
                            "strokeWidth": 4,
                            "effects": {
                                "trimPath": {
                                    "range": {
                                        "keyframes": [
                                            {
                                                "time": 0,
                                                "value": [
                                                    0,
                                                    0
                                                ],
                                                "easing": [
                                                    0.3347,
                                                    0.3559,
                                                    0.6266,
                                                    0.6902
                                                ]
                                            },
                                            {
                                                "time": 380,
                                                "value": [
                                                    0.6124,
                                                    0.019
                                                ],
                                                "easing": [
                                                    0.309,
                                                    0.3798,
                                                    0.6332,
                                                    0.7127
                                                ]
                                            },
                                            {
                                                "time": 750,
                                                "value": [
                                                    0.7762,
                                                    0.0519
                                                ],
                                                "easing": [
                                                    0.3284,
                                                    0.3792,
                                                    0.6612,
                                                    0.7127
                                                ]
                                            },
                                            {
                                                "time": 880,
                                                "value": [
                                                    0.791,
                                                    0.0682
                                                ],
                                                "easing": [
                                                    0.3299,
                                                    0.4856,
                                                    0.6627,
                                                    0.8202
                                                ]
                                            },
                                            {
                                                "time": 1000,
                                                "value": [
                                                    0.7953,
                                                    0.0885
                                                ],
                                                "easing": [
                                                    0.2819,
                                                    0.1812,
                                                    0.6432,
                                                    0.5419
                                                ]
                                            },
                                            {
                                                "time": 1750,
                                                "value": [
                                                    0.8977,
                                                    0.3636
                                                ],
                                                "easing": [
                                                    0.364,
                                                    0.3215,
                                                    0.7231,
                                                    0.6894
                                                ]
                                            },
                                            {
                                                "time": 2500,
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
                                "label": "Path"
                            }
                        }
                    ]
                }
            ]
        },
        {
            "type": "g",
            "transform": "translate(200,200)",
            "meta": {
                "label": "Lines short"
            },
            "children": [
                {
                    "type": "g",
                    "transform": "translate(-108.2392,-261.3126)rotate(22.5)",
                    "effects": {
                        "repeater": {
                            "copies": 8,
                            "origin": [
                                200,
                                200
                            ],
                            "rotate": 45
                        }
                    },
                    "meta": {
                        "label": "Clone"
                    },
                    "children": [
                        {
                            "type": "path",
                            "d": "M200,200L200,50",
                            "fill": "none",
                            "stroke": "#ffffff",
                            "strokeLinecap": "round",
                            "strokeLinejoin": "round",
                            "strokeWidth": 8,
                            "effects": {
                                "trimPath": {
                                    "range": {
                                        "keyframes": [
                                            {
                                                "time": 1000,
                                                "value": [
                                                    0.4,
                                                    0.4
                                                ],
                                                "easing": [
                                                    0.3556,
                                                    0.3212,
                                                    0.6689,
                                                    0.6462
                                                ]
                                            },
                                            {
                                                "time": 1250,
                                                "value": [
                                                    0.5652,
                                                    0.4097
                                                ],
                                                "easing": [
                                                    0.3302,
                                                    0.3186,
                                                    0.652,
                                                    0.6444
                                                ]
                                            },
                                            {
                                                "time": 1500,
                                                "value": [
                                                    0.6504,
                                                    0.4332
                                                ],
                                                "easing": [
                                                    0.3294,
                                                    0.3377,
                                                    0.6382,
                                                    0.6585
                                                ]
                                            },
                                            {
                                                "time": 1880,
                                                "value": [
                                                    0.6945,
                                                    0.5494
                                                ],
                                                "easing": [
                                                    0.303,
                                                    0.459,
                                                    0.6274,
                                                    0.792
                                                ]
                                            },
                                            {
                                                "time": 2130,
                                                "value": [
                                                    0.7,
                                                    0.7
                                                ]
                                            }
                                        ]
                                    }
                                }
                            },
                            "meta": {
                                "label": "Path"
                            }
                        }
                    ]
                }
            ]
        },
        {
            "type": "g",
            "transform": "translate(200,200)",
            "meta": {
                "label": "Circles"
            },
            "children": [
                {
                    "type": "g",
                    "opacity": 0,
                    "transform": "rotate(22.5)",
                    "animate": {
                        "opacity": {
                            "keyframes": [
                                {
                                    "time": 1630,
                                    "value": 0,
                                    "easing": [
                                        0.42,
                                        0,
                                        1,
                                        1
                                    ]
                                },
                                {
                                    "time": 2000,
                                    "value": 0.8
                                },
                                {
                                    "time": 2250,
                                    "value": 0.8,
                                    "easing": [
                                        0,
                                        0,
                                        0.58,
                                        1
                                    ]
                                },
                                {
                                    "time": 3380,
                                    "value": 0
                                }
                            ]
                        },
                        "transform": {
                            "keyframes": [
                                {
                                    "time": 1630,
                                    "value": {
                                        "scale": [
                                            1,
                                            1
                                        ],
                                        "rotate": 22.5
                                    }
                                },
                                {
                                    "time": 3000,
                                    "value": {
                                        "scale": [
                                            1.5,
                                            1.5
                                        ],
                                        "rotate": 22.5
                                    }
                                }
                            ]
                        }
                    },
                    "meta": {
                        "label": "Scale and opacity"
                    },
                    "children": [
                        {
                            "type": "g",
                            "transform": "translate(0,-150)",
                            "meta": {
                                "label": "Clone anchor fix"
                            },
                            "children": [
                                {
                                    "type": "g",
                                    "effects": {
                                        "repeater": {
                                            "copies": 8,
                                            "origin": [
                                                0,
                                                150
                                            ],
                                            "rotate": 45
                                        }
                                    },
                                    "meta": {
                                        "label": "Clone with rotation"
                                    },
                                    "children": [
                                        {
                                            "type": "ellipse",
                                            "fill": "#ffffff",
                                            "rx": 8,
                                            "ry": 8,
                                            "stroke": "none",
                                            "meta": {
                                                "label": "Ellipse"
                                            }
                                        }
                                    ]
                                }
                            ]
                        }
                    ]
                }
            ]
        }
    ]
};
