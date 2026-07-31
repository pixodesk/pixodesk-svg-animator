/*---------------------------------------------------------------------------------------
 * Copyright (c) Pixodesk LTD.
 * Licensed under the MIT License. See the LICENSE file in the project root for details.
 *---------------------------------------------------------------------------------------*/

import type { SvgaCaseJson } from '../caseTypes';

export const elemMaskTextLongPathBrowserFont: SvgaCaseJson = {
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
        },
        "definitions": {
            "glyphs": {
                "Roboto-Regular": {
                    "fFamily": "Roboto-Regular",
                    "style": "",
                    "ascent": 927.734375,
                    "unitsPerEm": 1000,
                    "glyphs": {
                        "M": {
                            "width": 873.046875,
                            "d": "M82.52-710.94L203.61-710.94L436.04-130.86L668.46-710.94L790.04-710.94L790.04 0L696.29 0L696.29-276.86L705.08-575.68L471.68 0L399.90 0L166.99-574.22L176.27-276.86L176.27 0L82.52 0L82.52-710.94Z"
                        },
                        "a": {
                            "width": 543.9453125,
                            "d": "M489.26 0L394.53 0Q386.72-15.63 381.84-55.66L381.84-55.66Q318.85 9.77 231.45 9.77L231.45 9.77Q153.32 9.77 103.27-34.42Q53.22-78.61 53.22-146.48L53.22-146.48Q53.22-229.00 115.97-274.66Q178.71-320.31 292.48-320.31L292.48-320.31L380.37-320.31L380.37-361.82Q380.37-409.18 352.05-437.26Q323.73-465.33 268.55-465.33L268.55-465.33Q220.21-465.33 187.50-440.92Q154.79-416.50 154.79-381.84L154.79-381.84L63.96-381.84Q63.96-421.39 92.04-458.25Q120.12-495.12 168.21-516.60Q216.31-538.09 273.93-538.09L273.93-538.09Q365.23-538.09 416.99-492.43Q468.75-446.78 470.70-366.70L470.70-366.70L470.70-123.54Q470.70-50.78 489.26-7.81L489.26-7.81L489.26 0ZM244.63-68.85L244.63-68.85Q287.11-68.85 325.20-90.82Q363.28-112.79 380.37-147.95L380.37-147.95L380.37-256.35L309.57-256.35Q143.55-256.35 143.55-159.18L143.55-159.18Q143.55-116.70 171.88-92.77Q200.20-68.85 244.63-68.85Z"
                        },
                        "s": {
                            "width": 515.625,
                            "d": "M375.98-140.14L375.98-140.14Q375.98-176.76 348.39-197.02Q320.80-217.29 252.20-231.93Q183.59-246.58 143.31-267.09Q103.03-287.60 83.74-315.92Q64.45-344.24 64.45-383.30L64.45-383.30Q64.45-448.24 119.38-493.16Q174.32-538.09 259.77-538.09L259.77-538.09Q349.61-538.09 405.52-491.70Q461.43-445.31 461.43-373.05L461.43-373.05L370.61-373.05Q370.61-410.16 339.11-437.01Q307.62-463.87 259.77-463.87L259.77-463.87Q210.45-463.87 182.62-442.38Q154.79-420.90 154.79-386.23L154.79-386.23Q154.79-353.52 180.66-336.91Q206.54-320.31 274.17-305.18Q341.80-290.04 383.79-269.04Q425.78-248.05 446.04-218.51Q466.31-188.96 466.31-146.48L466.31-146.48Q466.31-75.68 409.67-32.96Q353.03 9.77 262.70 9.77L262.70 9.77Q199.22 9.77 150.39-12.70Q101.56-35.16 73.97-75.44Q46.39-115.72 46.39-162.60L46.39-162.60L136.72-162.60Q139.16-117.19 173.10-90.58Q207.03-63.96 262.70-63.96L262.70-63.96Q313.96-63.96 344.97-84.72Q375.98-105.47 375.98-140.14Z"
                        },
                        "k": {
                            "width": 506.8359375,
                            "d": "M399.90 0L215.82-244.63L159.18-185.55L159.18 0L68.85 0L68.85-750L159.18-750L159.18-296.39L207.52-354.49L372.07-528.32L481.93-528.32L276.37-307.62L505.86 0L399.90 0Z"
                        },
                        "e": {
                            "width": 529.78515625,
                            "d": "M287.60 9.77L287.60 9.77Q180.18 9.77 112.79-60.79Q45.41-131.35 45.41-249.51L45.41-249.51L45.41-266.11Q45.41-344.73 75.44-406.49Q105.47-468.26 159.42-503.17Q213.38-538.09 276.37-538.09L276.37-538.09Q379.39-538.09 436.52-470.21Q493.65-402.34 493.65-275.88L493.65-275.88L493.65-238.28L135.74-238.28Q137.70-160.16 181.40-112.06Q225.10-63.96 292.48-63.96L292.48-63.96Q340.33-63.96 373.54-83.50Q406.74-103.03 431.64-135.25L431.64-135.25L486.82-92.29Q420.41 9.77 287.60 9.77ZM276.37-463.87L276.37-463.87Q221.68-463.87 184.57-424.07Q147.46-384.28 138.67-312.50L138.67-312.50L403.32-312.50L403.32-319.34Q399.41-388.18 366.21-426.03Q333.01-463.87 276.37-463.87Z"
                        },
                        "d": {
                            "width": 563.96484375,
                            "d": "M46.39-261.72L46.39-268.55Q46.39-390.14 104.00-464.11Q161.62-538.09 254.88-538.09L254.88-538.09Q347.66-538.09 401.86-474.61L401.86-474.61L401.86-750L492.19-750L492.19 0L409.18 0L404.79-56.64Q350.59 9.77 253.91 9.77L253.91 9.77Q162.11 9.77 104.25-65.43Q46.39-140.63 46.39-261.72L46.39-261.72ZM136.72-258.30L136.72-258.30Q136.72-168.46 173.83-117.68Q210.94-66.89 276.37-66.89L276.37-66.89Q362.30-66.89 401.86-144.04L401.86-144.04L401.86-386.72Q361.33-461.43 277.34-461.43L277.34-461.43Q210.94-461.43 173.83-410.16Q136.72-358.89 136.72-258.30Z"
                        }
                    }
                }
            }
        }
    },
    "children": [
        {
            "type": "defs",
            "children": [
                {
                    "type": "mask",
                    "id": "_px_38ds48tg",
                    "maskType": "alpha",
                    "children": [
                        {
                            "type": "text",
                            "transform": "translate(-37.05,-1.92)",
                            "xml:space": "preserve",
                            "style": {
                                "white-space": "pre"
                            },
                            "effects": {
                                "textPath": {
                                    "pathOverflow": "extend",
                                    "lengthAdjust": "spacing",
                                    "method": "align",
                                    "spacing": "auto",
                                    "startOffset": {
                                        "keyframes": [
                                            {
                                                "time": 0,
                                                "value": -20
                                            },
                                            {
                                                "time": 1000,
                                                "value": 93
                                            }
                                        ]
                                    },
                                    "path": "M37.05,-23.0799C50.8571,-23.0799,62.05,-11.8872,62.05,1.9199C62.05,15.727,50.8571,26.9199,37.05,26.9199C23.2429,26.9199,12.05,15.727,12.05,1.9199C12.05,-11.8872,23.2429,-23.0799,37.05,-23.0799z"
                                }
                            },
                            "meta": {
                                "appliedEffects": {
                                    "text": {
                                        "fontSource": "browser"
                                    }
                                }
                            },
                            "children": [
                                {
                                    "type": "tspan",
                                    "fill": "#007fff",
                                    "fontFamily": "Courier",
                                    "fontSize": "32px",
                                    "text": "Mask",
                                    "xml:space": "preserve",
                                    "style": {
                                        "white-space": "pre"
                                    },
                                    "children": [
                                        {
                                            "type": "tspan",
                                            "fill": "#007fff",
                                            "fontFamily": "Courier",
                                            "fontSize": "32px",
                                            "text": "Mask",
                                            "xml:space": "preserve",
                                            "style": {
                                                "white-space": "pre"
                                            }
                                        }
                                    ]
                                }
                            ]
                        }
                    ]
                },
                {
                    "type": "mask",
                    "id": "_px_38ds48th",
                    "maskType": "alpha",
                    "children": [
                        {
                            "type": "ellipse",
                            "fill": "#ff0000",
                            "rx": 37,
                            "ry": 37,
                            "stroke": "none",
                            "transform": "translate(37.05,1.92)"
                        }
                    ]
                },
                {
                    "type": "mask",
                    "id": "_px_38ds48ti",
                    "maskType": "alpha",
                    "children": [
                        {
                            "type": "text",
                            "transform": "translate(-37.05,-1.92)",
                            "xml:space": "preserve",
                            "style": {
                                "white-space": "pre"
                            },
                            "effects": {
                                "textPath": {
                                    "pathOverflow": "extend",
                                    "lengthAdjust": "spacing",
                                    "method": "align",
                                    "spacing": "auto",
                                    "startOffset": -40,
                                    "path": "M37.05,-23.08C50.8571,-23.08,62.05,-11.8872,62.05,1.9199C62.05,15.727,50.8571,26.9199,37.05,26.9199C23.2429,26.9199,12.05,15.727,12.05,1.9199C12.05,-11.8872,23.2429,-23.08,37.05,-23.08z"
                                }
                            },
                            "meta": {
                                "appliedEffects": {
                                    "text": {
                                        "fontSource": "browser"
                                    }
                                }
                            },
                            "children": [
                                {
                                    "type": "tspan",
                                    "fill": "#007fff",
                                    "fontFamily": "Courier",
                                    "fontSize": "32px",
                                    "text": "Mask",
                                    "xml:space": "preserve",
                                    "style": {
                                        "white-space": "pre"
                                    },
                                    "children": [
                                        {
                                            "type": "tspan",
                                            "fill": "#007fff",
                                            "fontFamily": "Courier",
                                            "fontSize": "32px",
                                            "text": "Mask",
                                            "xml:space": "preserve",
                                            "style": {
                                                "white-space": "pre"
                                            }
                                        }
                                    ]
                                }
                            ]
                        }
                    ]
                },
                {
                    "type": "mask",
                    "id": "_px_38ds48tj",
                    "maskType": "alpha",
                    "children": [
                        {
                            "type": "ellipse",
                            "fill": "#ff0000",
                            "rx": 37,
                            "ry": 37,
                            "stroke": "none",
                            "transform": "translate(37.05,1.92)"
                        }
                    ]
                }
            ]
        },
        {
            "type": "text",
            "mask": "url(#_px_38ds48tj)",
            "transform": "translate(15.11,49.5)",
            "xml:space": "preserve",
            "style": {
                "white-space": "pre"
            },
            "effects": {
                "textPath": {
                    "pathOverflow": "extend",
                    "lengthAdjust": "spacing",
                    "method": "align",
                    "spacing": "auto",
                    "startOffset": -40,
                    "path": "M37.05,-23.08C50.8571,-23.08,62.05,-11.8871,62.05,1.92C62.05,15.7271,50.8571,26.92,37.05,26.92C23.2429,26.92,12.05,15.7271,12.05,1.92C12.05,-11.8871,23.2429,-23.08,37.05,-23.08z"
                }
            },
            "meta": {
                "appliedEffects": {
                    "text": {
                        "fontSource": "browser"
                    }
                }
            },
            "children": [
                {
                    "type": "tspan",
                    "fill": "#007fff",
                    "fontFamily": "Courier",
                    "fontSize": "32px",
                    "text": "Masked",
                    "xml:space": "preserve",
                    "style": {
                        "white-space": "pre"
                    },
                    "children": [
                        {
                            "type": "tspan",
                            "fill": "#007fff",
                            "fontFamily": "Courier",
                            "fontSize": "32px",
                            "text": "Masked",
                            "xml:space": "preserve",
                            "style": {
                                "white-space": "pre"
                            }
                        }
                    ]
                }
            ]
        },
        {
            "type": "ellipse",
            "fill": "none",
            "rx": 37,
            "ry": 37,
            "stroke": "#000000",
            "transform": "translate(52.16,51.42)"
        },
        {
            "type": "ellipse",
            "fill": "none",
            "rx": 25,
            "ry": 25,
            "stroke": "#000000",
            "transform": "translate(52.16,51.42)"
        },
        {
            "type": "ellipse",
            "fill": "#ff0000",
            "mask": "url(#_px_38ds48ti)",
            "rx": 37,
            "ry": 37,
            "stroke": "none",
            "transform": "translate(52.16,152)"
        },
        {
            "type": "ellipse",
            "fill": "none",
            "rx": 37,
            "ry": 37,
            "stroke": "#000000",
            "transform": "translate(52.16,152)"
        },
        {
            "type": "ellipse",
            "fill": "none",
            "rx": 25,
            "ry": 25,
            "stroke": "#000000",
            "transform": "translate(52.16,152)"
        },
        {
            "type": "text",
            "mask": "url(#_px_38ds48th)",
            "transform": "translate(112.11,49.5)",
            "xml:space": "preserve",
            "style": {
                "white-space": "pre"
            },
            "effects": {
                "textPath": {
                    "pathOverflow": "extend",
                    "lengthAdjust": "spacing",
                    "method": "align",
                    "spacing": "auto",
                    "startOffset": {
                        "keyframes": [
                            {
                                "time": 0,
                                "value": -20
                            },
                            {
                                "time": 1000,
                                "value": 62
                            }
                        ]
                    },
                    "path": "M37.05,-23.08C50.8571,-23.08,62.05,-11.8872,62.05,1.9199C62.05,15.727,50.8571,26.9199,37.05,26.9199C23.2429,26.9199,12.05,15.727,12.05,1.9199C12.05,-11.8872,23.2429,-23.08,37.05,-23.08z"
                }
            },
            "meta": {
                "appliedEffects": {
                    "text": {
                        "fontSource": "browser"
                    }
                }
            },
            "children": [
                {
                    "type": "tspan",
                    "fill": "#007fff",
                    "fontFamily": "Courier",
                    "fontSize": "32px",
                    "text": "Masked",
                    "xml:space": "preserve",
                    "style": {
                        "white-space": "pre"
                    },
                    "children": [
                        {
                            "type": "tspan",
                            "fill": "#007fff",
                            "fontFamily": "Courier",
                            "fontSize": "32px",
                            "text": "Masked",
                            "xml:space": "preserve",
                            "style": {
                                "white-space": "pre"
                            }
                        }
                    ]
                }
            ]
        },
        {
            "type": "ellipse",
            "fill": "none",
            "rx": 37,
            "ry": 37,
            "stroke": "#000000",
            "transform": "translate(149.16,51.42)"
        },
        {
            "type": "ellipse",
            "fill": "none",
            "rx": 25,
            "ry": 25,
            "stroke": "#000000",
            "transform": "translate(149.16,51.42)"
        },
        {
            "type": "ellipse",
            "fill": "#ff0000",
            "mask": "url(#_px_38ds48tg)",
            "rx": 37,
            "ry": 37,
            "stroke": "none",
            "transform": "translate(149.16,152)"
        },
        {
            "type": "ellipse",
            "fill": "none",
            "rx": 37,
            "ry": 37,
            "stroke": "#000000",
            "transform": "translate(149.16,152)"
        },
        {
            "type": "ellipse",
            "fill": "none",
            "rx": 25,
            "ry": 25,
            "stroke": "#000000",
            "transform": "translate(149.16,152)"
        }
    ]
};
