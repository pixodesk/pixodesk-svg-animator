/*---------------------------------------------------------------------------------------
 * Copyright (c) Pixodesk LTD.
 * Licensed under the MIT License. See the LICENSE file in the project root for details.
 *---------------------------------------------------------------------------------------*/

import type { SvgaCaseJson } from '../caseTypes';

export const effectCloneSymbolAlongPath: SvgaCaseJson = {
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
            "type": "defs",
            "children": [
                {
                    "type": "symbol",
                    "id": "_px_38bqgqol",
                    "viewBox": "0 0 100 100",
                    "meta": {
                        "label": "star-symbol",
                        "timeline": {
                            "duration": 500
                        }
                    },
                    "children": [
                        {
                            "type": "path",
                            "d": "M0,-16L4.1145,-5.6631L15.2169,-4.9443L6.6574,2.1631L9.4046,12.9443L0,7L-9.4046,12.9443L-6.6574,2.1631L-15.2169,-4.9443L-4.1145,-5.6631L0,-16z",
                            "fill": "#ffb333",
                            "stroke": "none",
                            "transform": "translate(18.1338,74.3754)",
                            "animate": {
                                "transform": {
                                    "keyframes": [
                                        {
                                            "time": 0,
                                            "value": {
                                                "translate": [
                                                    18.1338,
                                                    74.3754
                                                ]
                                            }
                                        },
                                        {
                                            "time": 250,
                                            "value": {
                                                "translate": [
                                                    47.9538,
                                                    12.1887
                                                ]
                                            },
                                            "tangentOut": [
                                                23.4667,
                                                -0.6531
                                            ],
                                            "tangentIn": [
                                                -23.4667,
                                                0.6531
                                            ]
                                        },
                                        {
                                            "time": 500,
                                            "value": {
                                                "translate": [
                                                    82.5943,
                                                    75.1807
                                                ]
                                            }
                                        }
                                    ]
                                }
                            },
                            "meta": {
                                "appliedEffects": {
                                    "shape": {
                                        "value": {
                                            "preset": {
                                                "type": "star",
                                                "points": 5,
                                                "innerRadius": 7,
                                                "radius": 16
                                            }
                                        }
                                    }
                                }
                            }
                        },
                        {
                            "type": "path",
                            "d": "M18.1338,74.3754C18.1338,74.3754,24.487,12.8419,47.9538,12.1887C71.4206,11.5356,82.5943,75.1807,82.5943,75.1807",
                            "fill": "none",
                            "stroke": "#000000",
                            "strokeDasharray": "5,5"
                        }
                    ]
                }
            ]
        },
        {
            "type": "use",
            "height": 100,
            "href": "#_px_38bqgqol",
            "transform": "translate(30,80)",
            "width": 100,
            "effects": {
                "clone": {
                    "retime": {
                        "start": 250
                    }
                }
            },
            "meta": {
                "label": "use-no-transform"
            }
        },
        {
            "type": "path",
            "d": "M0,-16L4.1145,-5.6631L15.2169,-4.9443L6.6574,2.1631L9.4046,12.9443L0,7L-9.4046,12.9443L-6.6574,2.1631L-15.2169,-4.9443L-4.1145,-5.6631L0,-16z",
            "fill": "#ffb333",
            "stroke": "none",
            "transform": "translate(18.1338,74.3754)",
            "animate": {
                "transform": {
                    "keyframes": [
                        {
                            "time": 250,
                            "value": {
                                "translate": [
                                    18.1338,
                                    74.3754
                                ]
                            }
                        },
                        {
                            "time": 500,
                            "value": {
                                "translate": [
                                    47.9538,
                                    12.1887
                                ]
                            },
                            "tangentOut": [
                                23.4667,
                                -0.6531
                            ],
                            "tangentIn": [
                                -23.4667,
                                0.6531
                            ]
                        },
                        {
                            "time": 750,
                            "value": {
                                "translate": [
                                    82.5943,
                                    75.1807
                                ]
                            }
                        }
                    ]
                }
            },
            "meta": {
                "appliedEffects": {
                    "shape": {
                        "value": {
                            "preset": {
                                "type": "star",
                                "points": 5,
                                "innerRadius": 7,
                                "radius": 16
                            }
                        }
                    }
                }
            }
        },
        {
            "type": "path",
            "d": "M18.1338,74.3754C18.1338,74.3754,24.487,12.8419,47.9538,12.1887C71.4205,11.5356,82.5943,75.1807,82.5943,75.1807",
            "fill": "none",
            "stroke": "#000000",
            "strokeDasharray": "5,5"
        },
        {
            "type": "ellipse",
            "fill": "#007fff",
            "rx": 9.641,
            "ry": 9.641,
            "stroke": "none",
            "transform": "matrix(0.1027,-0.9947,0.9947,0.1027,124.7115,74.3754)",
            "animate": {
                "transform": {
                    "autoOrient": true,
                    "keyframes": [
                        {
                            "time": 250,
                            "value": {
                                "translate": [
                                    124.7115,
                                    74.3754
                                ]
                            }
                        },
                        {
                            "time": 500,
                            "value": {
                                "translate": [
                                    154.5315,
                                    12.1887
                                ]
                            },
                            "tangentOut": [
                                23.4667,
                                -0.6531
                            ],
                            "tangentIn": [
                                -23.4668,
                                0.6532
                            ]
                        },
                        {
                            "time": 750,
                            "value": {
                                "translate": [
                                    189.172,
                                    75.1807
                                ]
                            }
                        }
                    ]
                }
            }
        },
        {
            "type": "path",
            "d": "M18.1338,74.3754C18.1338,74.3754,24.487,12.8419,47.9538,12.1887C71.4205,11.5356,82.5943,75.1807,82.5943,75.1807",
            "fill": "none",
            "stroke": "#000000",
            "strokeDasharray": "5,5",
            "transform": "translate(106.5777,0)"
        }
    ]
};
