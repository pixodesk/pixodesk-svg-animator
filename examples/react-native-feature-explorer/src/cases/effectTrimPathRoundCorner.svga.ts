/*---------------------------------------------------------------------------------------
 * Copyright (c) Pixodesk LTD.
 * Licensed under the MIT License. See the LICENSE file in the project root for details.
 *---------------------------------------------------------------------------------------*/

import type { SvgaCaseJson } from '../caseTypes';

export const effectTrimPathRoundCorner: SvgaCaseJson = {
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
            "d": "M0,0L5.418,-21.6721C5.9436,-23.7746,7.8328,-25.2496,10,-25.2496C12.1672,-25.2496,14.0564,-23.7746,14.582,-21.6721C14.582,-21.6721,16.1484,-15.4065,17.3141,-10.7437L22.6859,-10.7437C22.6859,-10.7437,24.1239,-16.4958,25.418,-21.6721C25.9436,-23.7746,27.8328,-25.2496,30,-25.2496C32.1672,-25.2496,34.0564,-23.7746,34.582,-21.6721L40,0",
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
            },
            "meta": {
                "appliedEffects": {
                    "shape": {
                        "value": {
                            "corners": [
                                {
                                    "pointIndex": 0,
                                    "r": 2.7686,
                                    "type": "b"
                                },
                                {
                                    "pointIndex": 1,
                                    "r": 4.723
                                },
                                {
                                    "pointIndex": 2,
                                    "r": 2.7686,
                                    "type": "b"
                                },
                                {
                                    "pointIndex": 3,
                                    "r": 4.723
                                },
                                {
                                    "pointIndex": 4,
                                    "r": 2.7686,
                                    "type": "b"
                                }
                            ],
                            "path": "M0,0L10,-40L20,0L30,-40L40,0"
                        }
                    }
                }
            }
        },
        {
            "type": "path",
            "d": "M0,0L5.418,-21.6721C5.9436,-23.7746,7.8328,-25.2496,10,-25.2496C12.1672,-25.2496,14.0564,-23.7746,14.582,-21.6721C14.582,-21.6721,16.1484,-15.4065,17.3141,-10.7437L22.6859,-10.7437C22.6859,-10.7437,24.1239,-16.4958,25.418,-21.6721C25.9436,-23.7746,27.8328,-25.2496,30,-25.2496C32.1672,-25.2496,34.0564,-23.7746,34.582,-21.6721L40,0",
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
            },
            "meta": {
                "appliedEffects": {
                    "shape": {
                        "value": {
                            "corners": [
                                {
                                    "pointIndex": 0,
                                    "r": 2.7686,
                                    "type": "b"
                                },
                                {
                                    "pointIndex": 1,
                                    "r": 4.723
                                },
                                {
                                    "pointIndex": 2,
                                    "r": 2.7686,
                                    "type": "b"
                                },
                                {
                                    "pointIndex": 3,
                                    "r": 4.723
                                },
                                {
                                    "pointIndex": 4,
                                    "r": 2.7686,
                                    "type": "b"
                                }
                            ],
                            "path": "M0,0L10,-40L20,0L30,-40L40,0"
                        }
                    }
                }
            }
        },
        {
            "type": "path",
            "d": "M0,0L5.418,-21.6721C5.9436,-23.7746,7.8328,-25.2496,10,-25.2496C12.1672,-25.2496,14.0564,-23.7746,14.582,-21.6721C14.582,-21.6721,16.1484,-15.4065,17.3141,-10.7437L22.6859,-10.7437C22.6859,-10.7437,24.1239,-16.4958,25.418,-21.6721C25.9436,-23.7746,27.8328,-25.2496,30,-25.2496C32.1672,-25.2496,34.0564,-23.7746,34.582,-21.6721L40,0",
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
            },
            "meta": {
                "appliedEffects": {
                    "shape": {
                        "value": {
                            "corners": [
                                {
                                    "pointIndex": 0,
                                    "r": 2.7686,
                                    "type": "b"
                                },
                                {
                                    "pointIndex": 1,
                                    "r": 4.723
                                },
                                {
                                    "pointIndex": 2,
                                    "r": 2.7686,
                                    "type": "b"
                                },
                                {
                                    "pointIndex": 3,
                                    "r": 4.723
                                },
                                {
                                    "pointIndex": 4,
                                    "r": 2.7686,
                                    "type": "b"
                                }
                            ],
                            "path": "M0,0L10,-40L20,0L30,-40L40,0"
                        }
                    }
                }
            }
        },
        {
            "type": "path",
            "d": "M0,0L5.418,-21.6721C5.9436,-23.7746,7.8328,-25.2496,10,-25.2496C12.1672,-25.2496,14.0564,-23.7746,14.582,-21.6721C14.582,-21.6721,16.1484,-15.4065,17.3141,-10.7437L22.6859,-10.7437C22.6859,-10.7437,24.1239,-16.4958,25.418,-21.6721C25.9436,-23.7746,27.8328,-25.2496,30,-25.2496C32.1672,-25.2496,34.0564,-23.7746,34.582,-21.6721L40,0",
            "fill": "none",
            "stroke": "#000000",
            "strokeDasharray": "5,5",
            "strokeLinecap": "round",
            "strokeLinejoin": "round",
            "transform": "translate(20,60)",
            "meta": {
                "appliedEffects": {
                    "shape": {
                        "value": {
                            "corners": [
                                {
                                    "pointIndex": 0,
                                    "r": 2.7686,
                                    "type": "b"
                                },
                                {
                                    "pointIndex": 1,
                                    "r": 4.723
                                },
                                {
                                    "pointIndex": 2,
                                    "r": 2.7686,
                                    "type": "b"
                                },
                                {
                                    "pointIndex": 3,
                                    "r": 4.723
                                },
                                {
                                    "pointIndex": 4,
                                    "r": 2.7686,
                                    "type": "b"
                                }
                            ],
                            "path": "M0,0L10,-40L20,0L30,-40L40,0"
                        }
                    }
                }
            }
        },
        {
            "type": "path",
            "d": "M0,0L5.418,-21.6721C5.9436,-23.7746,7.8328,-25.2496,10,-25.2496C12.1672,-25.2496,14.0564,-23.7746,14.582,-21.6721C14.582,-21.6721,16.1484,-15.4065,17.3141,-10.7437L22.6859,-10.7437C22.6859,-10.7437,24.1239,-16.4958,25.418,-21.6721C25.9436,-23.7746,27.8328,-25.2496,30,-25.2496C32.1672,-25.2496,34.0564,-23.7746,34.582,-21.6721L40,0",
            "fill": "none",
            "stroke": "#000000",
            "strokeDasharray": "5,5",
            "strokeLinecap": "round",
            "strokeLinejoin": "round",
            "transform": "translate(80,60)",
            "meta": {
                "appliedEffects": {
                    "shape": {
                        "value": {
                            "corners": [
                                {
                                    "pointIndex": 0,
                                    "r": 2.7686,
                                    "type": "b"
                                },
                                {
                                    "pointIndex": 1,
                                    "r": 4.723
                                },
                                {
                                    "pointIndex": 2,
                                    "r": 2.7686,
                                    "type": "b"
                                },
                                {
                                    "pointIndex": 3,
                                    "r": 4.723
                                },
                                {
                                    "pointIndex": 4,
                                    "r": 2.7686,
                                    "type": "b"
                                }
                            ],
                            "path": "M0,0L10,-40L20,0L30,-40L40,0"
                        }
                    }
                }
            }
        },
        {
            "type": "path",
            "d": "M0,0L5.418,-21.6721C5.9436,-23.7746,7.8328,-25.2496,10,-25.2496C12.1672,-25.2496,14.0564,-23.7746,14.582,-21.6721C14.582,-21.6721,16.1484,-15.4065,17.3141,-10.7437L22.6859,-10.7437C22.6859,-10.7437,24.1239,-16.4958,25.418,-21.6721C25.9436,-23.7746,27.8328,-25.2496,30,-25.2496C32.1672,-25.2496,34.0564,-23.7746,34.582,-21.6721L40,0",
            "fill": "none",
            "stroke": "#000000",
            "strokeDasharray": "5,5",
            "strokeLinecap": "round",
            "strokeLinejoin": "round",
            "transform": "translate(140,60)",
            "meta": {
                "appliedEffects": {
                    "shape": {
                        "value": {
                            "corners": [
                                {
                                    "pointIndex": 0,
                                    "r": 2.7686,
                                    "type": "b"
                                },
                                {
                                    "pointIndex": 1,
                                    "r": 4.723
                                },
                                {
                                    "pointIndex": 2,
                                    "r": 2.7686,
                                    "type": "b"
                                },
                                {
                                    "pointIndex": 3,
                                    "r": 4.723
                                },
                                {
                                    "pointIndex": 4,
                                    "r": 2.7686,
                                    "type": "b"
                                }
                            ],
                            "path": "M0,0L10,-40L20,0L30,-40L40,0"
                        }
                    }
                }
            }
        },
        {
            "type": "path",
            "d": "M0,12C0,8.8174,1.2643,5.7652,3.5147,3.5147C5.7652,1.2643,8.8174,0,12,0C12,0,23.0598,0,28,0C31.1826,0,34.2348,1.2643,36.4853,3.5147C38.7357,5.7652,40,8.8174,40,12C40,12,40,23.0598,40,28C40,31.1826,38.7357,34.2348,36.4853,36.4853C34.2348,38.7357,31.1826,40,28,40C28,40,16.9402,40,12,40C8.8174,40,5.7652,38.7357,3.5147,36.4853C1.2643,34.2348,0,31.1826,0,28C0,28,0,16.9402,0,12z",
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
            },
            "meta": {
                "appliedEffects": {
                    "shape": {
                        "value": {
                            "corners": [
                                {
                                    "pointIndex": 0,
                                    "r": 12
                                },
                                {
                                    "pointIndex": 1,
                                    "r": 12
                                },
                                {
                                    "pointIndex": 2,
                                    "r": 12
                                },
                                {
                                    "pointIndex": 3,
                                    "r": 12
                                }
                            ],
                            "path": "M0,0L40,0L40,40L0,40L0,0z"
                        }
                    }
                }
            }
        },
        {
            "type": "path",
            "d": "M0,12C0,8.8174,1.2643,5.7652,3.5147,3.5147C5.7652,1.2643,8.8174,0,12,0C12,0,23.0598,0,28,0C31.1826,0,34.2348,1.2643,36.4853,3.5147C38.7357,5.7652,40,8.8174,40,12C40,12,40,23.0598,40,28C40,31.1826,38.7357,34.2348,36.4853,36.4853C34.2348,38.7357,31.1826,40,28,40C28,40,16.9402,40,12,40C8.8174,40,5.7652,38.7357,3.5147,36.4853C1.2643,34.2348,0,31.1826,0,28C0,28,0,16.9402,0,12z",
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
            },
            "meta": {
                "appliedEffects": {
                    "shape": {
                        "value": {
                            "corners": [
                                {
                                    "pointIndex": 0,
                                    "r": 12
                                },
                                {
                                    "pointIndex": 1,
                                    "r": 12
                                },
                                {
                                    "pointIndex": 2,
                                    "r": 12
                                },
                                {
                                    "pointIndex": 3,
                                    "r": 12
                                }
                            ],
                            "path": "M0,0L40,0L40,40L0,40L0,0z"
                        }
                    }
                }
            }
        },
        {
            "type": "path",
            "d": "M0,12C0,8.8174,1.2643,5.7652,3.5147,3.5147C5.7652,1.2643,8.8174,0,12,0C12,0,23.0598,0,28,0C31.1826,0,34.2348,1.2643,36.4853,3.5147C38.7357,5.7652,40,8.8174,40,12C40,12,40,23.0598,40,28C40,31.1826,38.7357,34.2348,36.4853,36.4853C34.2348,38.7357,31.1826,40,28,40C28,40,16.9402,40,12,40C8.8174,40,5.7652,38.7357,3.5147,36.4853C1.2643,34.2348,0,31.1826,0,28C0,28,0,16.9402,0,12z",
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
            },
            "meta": {
                "appliedEffects": {
                    "shape": {
                        "value": {
                            "corners": [
                                {
                                    "pointIndex": 0,
                                    "r": 12
                                },
                                {
                                    "pointIndex": 1,
                                    "r": 12
                                },
                                {
                                    "pointIndex": 2,
                                    "r": 12
                                },
                                {
                                    "pointIndex": 3,
                                    "r": 12
                                }
                            ],
                            "path": "M0,0L40,0L40,40L0,40L0,0z"
                        }
                    }
                }
            }
        },
        {
            "type": "path",
            "d": "M0,12C0,8.8174,1.2643,5.7652,3.5147,3.5147C5.7652,1.2643,8.8174,0,12,0C12,0,23.0598,0,28,0C31.1826,0,34.2348,1.2643,36.4853,3.5147C38.7357,5.7652,40,8.8174,40,12C40,12,40,23.0598,40,28C40,31.1826,38.7357,34.2348,36.4853,36.4853C34.2348,38.7357,31.1826,40,28,40C28,40,16.9402,40,12,40C8.8174,40,5.7652,38.7357,3.5147,36.4853C1.2643,34.2348,0,31.1826,0,28C0,28,0,16.9402,0,12z",
            "fill": "none",
            "stroke": "#000000",
            "strokeDasharray": "5,5",
            "strokeLinecap": "round",
            "strokeLinejoin": "round",
            "transform": "translate(20,80)",
            "meta": {
                "appliedEffects": {
                    "shape": {
                        "value": {
                            "corners": [
                                {
                                    "pointIndex": 0,
                                    "r": 12
                                },
                                {
                                    "pointIndex": 1,
                                    "r": 12
                                },
                                {
                                    "pointIndex": 2,
                                    "r": 12
                                },
                                {
                                    "pointIndex": 3,
                                    "r": 12
                                }
                            ],
                            "path": "M0,0L40,0L40,40L0,40L0,0z"
                        }
                    }
                }
            }
        },
        {
            "type": "path",
            "d": "M0,12C0,8.8174,1.2643,5.7652,3.5147,3.5147C5.7652,1.2643,8.8174,0,12,0C12,0,23.0598,0,28,0C31.1826,0,34.2348,1.2643,36.4853,3.5147C38.7357,5.7652,40,8.8174,40,12C40,12,40,23.0598,40,28C40,31.1826,38.7357,34.2348,36.4853,36.4853C34.2348,38.7357,31.1826,40,28,40C28,40,16.9402,40,12,40C8.8174,40,5.7652,38.7357,3.5147,36.4853C1.2643,34.2348,0,31.1826,0,28C0,28,0,16.9402,0,12z",
            "fill": "none",
            "stroke": "#000000",
            "strokeDasharray": "5,5",
            "strokeLinecap": "round",
            "strokeLinejoin": "round",
            "transform": "translate(80,80)",
            "meta": {
                "appliedEffects": {
                    "shape": {
                        "value": {
                            "corners": [
                                {
                                    "pointIndex": 0,
                                    "r": 12
                                },
                                {
                                    "pointIndex": 1,
                                    "r": 12
                                },
                                {
                                    "pointIndex": 2,
                                    "r": 12
                                },
                                {
                                    "pointIndex": 3,
                                    "r": 12
                                }
                            ],
                            "path": "M0,0L40,0L40,40L0,40L0,0z"
                        }
                    }
                }
            }
        },
        {
            "type": "path",
            "d": "M0,12C0,8.8174,1.2643,5.7652,3.5147,3.5147C5.7652,1.2643,8.8174,0,12,0C12,0,23.0598,0,28,0C31.1826,0,34.2348,1.2643,36.4853,3.5147C38.7357,5.7652,40,8.8174,40,12C40,12,40,23.0598,40,28C40,31.1826,38.7357,34.2348,36.4853,36.4853C34.2348,38.7357,31.1826,40,28,40C28,40,16.9402,40,12,40C8.8174,40,5.7652,38.7357,3.5147,36.4853C1.2643,34.2348,0,31.1826,0,28C0,28,0,16.9402,0,12z",
            "fill": "none",
            "stroke": "#000000",
            "strokeDasharray": "5,5",
            "strokeLinecap": "round",
            "strokeLinejoin": "round",
            "transform": "translate(140,80)",
            "meta": {
                "appliedEffects": {
                    "shape": {
                        "value": {
                            "corners": [
                                {
                                    "pointIndex": 0,
                                    "r": 12
                                },
                                {
                                    "pointIndex": 1,
                                    "r": 12
                                },
                                {
                                    "pointIndex": 2,
                                    "r": 12
                                },
                                {
                                    "pointIndex": 3,
                                    "r": 12
                                }
                            ],
                            "path": "M0,0L40,0L40,40L0,40L0,0z"
                        }
                    }
                }
            }
        }
    ]
};
