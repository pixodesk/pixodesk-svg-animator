/*---------------------------------------------------------------------------------------
 * Copyright (c) Pixodesk LTD.
 * Licensed under the MIT License. See the LICENSE file in the project root for details.
 *---------------------------------------------------------------------------------------*/

import type { SvgaCaseJson } from '../caseTypes';

export const attrTransformMotionPathAutoOrientRotated: SvgaCaseJson = {
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
            "transform": "translate(100,53.4143)translate(-100,-122.081)",
            "children": [
                {
                    "type": "rect",
                    "fill": "#e67326",
                    "height": 8,
                    "stroke": "none",
                    "transform": "matrix(0.9671,-0.2545,0.2545,0.9671,120,120)",
                    "width": 26,
                    "animate": {
                        "transform": {
                            "autoOrient": true,
                            "keyframes": [
                                {
                                    "time": 0,
                                    "value": {
                                        "translate": [
                                            120,
                                            120
                                        ],
                                        "rotate": 45
                                    },
                                    "tangentOut": [
                                        28,
                                        -48
                                    ]
                                },
                                {
                                    "time": 1000,
                                    "value": {
                                        "translate": [
                                            180,
                                            120
                                        ],
                                        "rotate": 45
                                    }
                                }
                            ]
                        }
                    }
                },
                {
                    "type": "rect",
                    "fill": "#597399",
                    "height": 8,
                    "stroke": "none",
                    "transform": "translate(20,120)rotate(45)",
                    "width": 26,
                    "animate": {
                        "transform": {
                            "keyframes": [
                                {
                                    "time": 0,
                                    "value": {
                                        "translate": [
                                            20,
                                            120
                                        ],
                                        "rotate": 45
                                    },
                                    "tangentOut": [
                                        28,
                                        -48
                                    ]
                                },
                                {
                                    "time": 1000,
                                    "value": {
                                        "translate": [
                                            80,
                                            120
                                        ],
                                        "rotate": 45
                                    }
                                }
                            ]
                        }
                    }
                },
                {
                    "type": "path",
                    "d": "M20,120C48,72,80,120,80,120",
                    "fill": "none",
                    "stroke": "#808080"
                },
                {
                    "type": "path",
                    "d": "M120,120C148,72,180,120,180,120",
                    "fill": "none",
                    "stroke": "#808080"
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
                            "transform": "translate(180,120)rotate(101.3075)",
                            "width": 26
                        },
                        {
                            "type": "rect",
                            "fill": "none",
                            "height": 8,
                            "opacity": 0.6,
                            "stroke": "#80808f",
                            "transform": "translate(166.8694,106.1183)rotate(82.6415)",
                            "width": 26
                        },
                        {
                            "type": "rect",
                            "fill": "none",
                            "height": 8,
                            "opacity": 0.6,
                            "stroke": "#80808f",
                            "transform": "translate(149.4791,98.7155)rotate(48.7671)",
                            "width": 26
                        },
                        {
                            "type": "rect",
                            "fill": "none",
                            "height": 8,
                            "opacity": 0.6,
                            "stroke": "#80808f",
                            "transform": "translate(131.9055,105.082)rotate(4.9009)",
                            "width": 26
                        },
                        {
                            "type": "rect",
                            "fill": "none",
                            "height": 8,
                            "opacity": 0.6,
                            "stroke": "#80808f",
                            "transform": "translate(120,120)rotate(-14.7436)",
                            "width": 26
                        }
                    ]
                },
                {
                    "type": "g",
                    "transform": "translate(0,-0.0489)",
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
                            "transform": "translate(80,120)rotate(45)",
                            "width": 26
                        },
                        {
                            "type": "rect",
                            "fill": "none",
                            "height": 8,
                            "opacity": 0.6,
                            "stroke": "#80808f",
                            "transform": "translate(66.8694,106.1183)rotate(45)",
                            "width": 26
                        },
                        {
                            "type": "rect",
                            "fill": "none",
                            "height": 8,
                            "opacity": 0.6,
                            "stroke": "#80808f",
                            "transform": "translate(49.4791,98.7155)rotate(45)",
                            "width": 26
                        },
                        {
                            "type": "rect",
                            "fill": "none",
                            "height": 8,
                            "opacity": 0.6,
                            "stroke": "#80808f",
                            "transform": "translate(31.9055,105.082)rotate(45)",
                            "width": 26
                        },
                        {
                            "type": "rect",
                            "fill": "none",
                            "height": 8,
                            "opacity": 0.6,
                            "stroke": "#80808f",
                            "transform": "translate(20,120)rotate(45)",
                            "width": 26
                        }
                    ]
                }
            ]
        },
        {
            "type": "rect",
            "fill": "#007fff",
            "height": 10,
            "stroke": "#a0a0a0",
            "transform": "translate(50,110)rotate(15)translate(-15,-5)",
            "width": 30,
            "animate": {
                "transform": {
                    "keyframes": [
                        {
                            "time": 0,
                            "value": {
                                "translate": [
                                    35,
                                    105
                                ],
                                "rotate": 15,
                                "origin": [
                                    15,
                                    5
                                ]
                            },
                            "tangentOut": [
                                16.5685,
                                0
                            ]
                        },
                        {
                            "time": 250,
                            "value": {
                                "translate": [
                                    65,
                                    135
                                ],
                                "rotate": 15,
                                "origin": [
                                    15,
                                    5
                                ]
                            },
                            "tangentOut": [
                                0,
                                16.5685
                            ],
                            "tangentIn": [
                                0,
                                -16.5685
                            ]
                        },
                        {
                            "time": 500,
                            "value": {
                                "translate": [
                                    35,
                                    165
                                ],
                                "rotate": 15,
                                "origin": [
                                    15,
                                    5
                                ]
                            },
                            "tangentOut": [
                                -16.5685,
                                0
                            ],
                            "tangentIn": [
                                16.5685,
                                0
                            ]
                        },
                        {
                            "time": 750,
                            "value": {
                                "translate": [
                                    5,
                                    135
                                ],
                                "rotate": 15,
                                "origin": [
                                    15,
                                    5
                                ]
                            },
                            "tangentOut": [
                                0,
                                -16.5685
                            ],
                            "tangentIn": [
                                0,
                                16.5685
                            ]
                        },
                        {
                            "time": 1000,
                            "value": {
                                "translate": [
                                    35,
                                    105
                                ],
                                "rotate": 15,
                                "origin": [
                                    15,
                                    5
                                ]
                            },
                            "tangentIn": [
                                -16.5685,
                                0
                            ]
                        }
                    ]
                }
            }
        },
        {
            "type": "rect",
            "fill": "#007fff",
            "height": 10,
            "stroke": "#a0a0a0",
            "transform": "matrix(0.9659,0.2588,-0.2588,0.9659,136.8052,101.2881)",
            "width": 30,
            "animate": {
                "transform": {
                    "autoOrient": true,
                    "keyframes": [
                        {
                            "time": 0,
                            "value": {
                                "translate": [
                                    135,
                                    105
                                ],
                                "rotate": 15,
                                "origin": [
                                    15,
                                    5
                                ]
                            },
                            "tangentOut": [
                                16.5685,
                                0
                            ]
                        },
                        {
                            "time": 250,
                            "value": {
                                "translate": [
                                    165,
                                    135
                                ],
                                "rotate": 15,
                                "origin": [
                                    15,
                                    5
                                ]
                            },
                            "tangentOut": [
                                0,
                                16.5685
                            ],
                            "tangentIn": [
                                0,
                                -16.5685
                            ]
                        },
                        {
                            "time": 500,
                            "value": {
                                "translate": [
                                    135,
                                    165
                                ],
                                "rotate": 15,
                                "origin": [
                                    15,
                                    5
                                ]
                            },
                            "tangentOut": [
                                -16.5685,
                                0
                            ],
                            "tangentIn": [
                                16.5685,
                                0
                            ]
                        },
                        {
                            "time": 750,
                            "value": {
                                "translate": [
                                    105,
                                    135
                                ],
                                "rotate": 15,
                                "origin": [
                                    15,
                                    5
                                ]
                            },
                            "tangentOut": [
                                0,
                                -16.5685
                            ],
                            "tangentIn": [
                                0,
                                16.5685
                            ]
                        },
                        {
                            "time": 1000,
                            "value": {
                                "translate": [
                                    135,
                                    105
                                ],
                                "rotate": 15,
                                "origin": [
                                    15,
                                    5
                                ]
                            },
                            "tangentIn": [
                                -16.5685,
                                0
                            ]
                        }
                    ]
                }
            }
        },
        {
            "type": "ellipse",
            "fill": "none",
            "rx": 30,
            "ry": 30,
            "stroke": "#a0a0a0",
            "transform": "translate(50,140)"
        },
        {
            "type": "ellipse",
            "fill": "none",
            "rx": 30,
            "ry": 30,
            "stroke": "#a0a0a0",
            "transform": "translate(150,140)"
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
                    "height": 10,
                    "opacity": 0.6,
                    "stroke": "#80808f",
                    "transform": "translate(50,110)rotate(15)translate(-15,-5)",
                    "width": 30
                },
                {
                    "type": "rect",
                    "fill": "none",
                    "height": 10,
                    "opacity": 0.6,
                    "stroke": "#80808f",
                    "transform": "translate(20,140)rotate(15)translate(-15,-5)",
                    "width": 30
                },
                {
                    "type": "rect",
                    "fill": "none",
                    "height": 10,
                    "opacity": 0.6,
                    "stroke": "#80808f",
                    "transform": "translate(50,170)rotate(15)translate(-15,-5)",
                    "width": 30
                },
                {
                    "type": "rect",
                    "fill": "none",
                    "height": 10,
                    "opacity": 0.6,
                    "stroke": "#80808f",
                    "transform": "translate(80,140)rotate(15)translate(-15,-5)",
                    "width": 30
                },
                {
                    "type": "rect",
                    "fill": "none",
                    "height": 10,
                    "opacity": 0.6,
                    "stroke": "#80808f",
                    "transform": "translate(50,110)rotate(15)translate(-15,-5)",
                    "width": 30
                }
            ]
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
                    "height": 10,
                    "opacity": 0.6,
                    "stroke": "#80808f",
                    "transform": "translate(150,110)rotate(15)translate(-15,-5)",
                    "width": 30
                },
                {
                    "type": "rect",
                    "fill": "none",
                    "height": 10,
                    "opacity": 0.6,
                    "stroke": "#80808f",
                    "transform": "translate(120,140)rotate(-75)translate(-15,-5)",
                    "width": 30
                },
                {
                    "type": "rect",
                    "fill": "none",
                    "height": 10,
                    "opacity": 0.6,
                    "stroke": "#80808f",
                    "transform": "translate(150,170)rotate(-165)translate(-15,-5)",
                    "width": 30
                },
                {
                    "type": "rect",
                    "fill": "none",
                    "height": 10,
                    "opacity": 0.6,
                    "stroke": "#80808f",
                    "transform": "translate(180,140)rotate(105)translate(-15,-5)",
                    "width": 30
                },
                {
                    "type": "rect",
                    "fill": "none",
                    "height": 10,
                    "opacity": 0.6,
                    "stroke": "#80808f",
                    "transform": "translate(150,110)rotate(15)translate(-15,-5)",
                    "width": 30
                }
            ]
        }
    ]
};
