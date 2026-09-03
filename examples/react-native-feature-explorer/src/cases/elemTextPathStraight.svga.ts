/*---------------------------------------------------------------------------------------
 * Copyright (c) Pixodesk LTD.
 * Licensed under the MIT License. See the LICENSE file in the project root for details.
 *---------------------------------------------------------------------------------------*/

import type { SvgaCaseJson } from '../caseTypes';

export const elemTextPathStraight: SvgaCaseJson = {
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
                    "fontFamily": "Roboto-Regular",
                    "style": "",
                    "ascent": 927.734375,
                    "unitsPerEm": 1000,
                    "glyphs": {
                        "g": {
                            "width": 561.03515625,
                            "d": "M46.88-268.55L46.88-268.55Q46.88-392.09 104.00-465.09Q161.13-538.09 255.37-538.09L255.37-538.09Q352.05-538.09 406.25-469.73L406.25-469.73L410.64-528.32L493.16-528.32L493.16-12.70Q493.16 89.84 432.37 148.93Q371.58 208.01 269.04 208.01L269.04 208.01Q211.91 208.01 157.23 183.59Q102.54 159.18 73.73 116.70L73.73 116.70L120.61 62.50Q178.71 134.28 262.70 134.28L262.70 134.28Q328.61 134.28 365.48 97.17Q402.34 60.06 402.34-7.32L402.34-7.32L402.34-52.73Q348.14 9.77 254.39 9.77L254.39 9.77Q161.62 9.77 104.25-64.94Q46.88-139.65 46.88-268.55ZM137.70-258.30L137.70-258.30Q137.70-168.95 174.32-117.92Q210.94-66.89 276.86-66.89L276.86-66.89Q362.30-66.89 402.34-144.53L402.34-144.53L402.34-385.74Q360.84-461.43 277.83-461.43L277.83-461.43Q211.91-461.43 174.80-410.16Q137.70-358.89 137.70-258.30Z"
                        },
                        "l": {
                            "width": 242.67578125,
                            "d": "M166.50-750L166.50 0L76.17 0L76.17-750L166.50-750Z"
                        },
                        "y": {
                            "width": 473.14453125,
                            "d": "M109.38-528.32L241.21-132.32L364.26-528.32L460.94-528.32L248.54 81.54Q199.22 213.38 91.80 213.38L91.80 213.38L74.71 211.91L41.02 205.57L41.02 132.32L65.43 134.28Q111.33 134.28 136.96 115.72Q162.60 97.17 179.20 47.85L179.20 47.85L199.22-5.86L10.74-528.32L109.38-528.32Z"
                        },
                        "p": {
                            "width": 561.03515625,
                            "d": "M514.65-266.60L514.65-258.30Q514.65-137.70 459.47-63.96Q404.30 9.77 310.06 9.77L310.06 9.77Q213.87 9.77 158.69-51.27L158.69-51.27L158.69 203.13L68.36 203.13L68.36-528.32L150.88-528.32L155.27-469.73Q210.45-538.09 308.59-538.09L308.59-538.09Q403.81-538.09 459.23-466.31Q514.65-394.53 514.65-266.60L514.65-266.60ZM424.32-268.55L424.32-268.55Q424.32-357.91 386.23-409.67Q348.14-461.43 281.74-461.43L281.74-461.43Q199.71-461.43 158.69-388.67L158.69-388.67L158.69-136.23Q199.22-63.96 282.71-63.96L282.71-63.96Q347.66-63.96 385.99-115.48Q424.32-166.99 424.32-268.55Z"
                        },
                        "h": {
                            "width": 550.78125,
                            "d": "M158.69-750L158.69-464.36Q218.75-538.09 314.94-538.09L314.94-538.09Q482.42-538.09 483.89-349.12L483.89-349.12L483.89 0L393.55 0L393.55-349.61Q393.07-406.74 367.43-434.08Q341.80-461.43 287.60-461.43L287.60-461.43Q243.65-461.43 210.45-437.99Q177.25-414.55 158.69-376.46L158.69-376.46L158.69 0L68.36 0L68.36-750L158.69-750Z"
                        },
                        "s": {
                            "width": 515.625,
                            "d": "M375.98-140.14L375.98-140.14Q375.98-176.76 348.39-197.02Q320.80-217.29 252.20-231.93Q183.59-246.58 143.31-267.09Q103.03-287.60 83.74-315.92Q64.45-344.24 64.45-383.30L64.45-383.30Q64.45-448.24 119.38-493.16Q174.32-538.09 259.77-538.09L259.77-538.09Q349.61-538.09 405.52-491.70Q461.43-445.31 461.43-373.05L461.43-373.05L370.61-373.05Q370.61-410.16 339.11-437.01Q307.62-463.87 259.77-463.87L259.77-463.87Q210.45-463.87 182.62-442.38Q154.79-420.90 154.79-386.23L154.79-386.23Q154.79-353.52 180.66-336.91Q206.54-320.31 274.17-305.18Q341.80-290.04 383.79-269.04Q425.78-248.05 446.04-218.51Q466.31-188.96 466.31-146.48L466.31-146.48Q466.31-75.68 409.67-32.96Q353.03 9.77 262.70 9.77L262.70 9.77Q199.22 9.77 150.39-12.70Q101.56-35.16 73.97-75.44Q46.39-115.72 46.39-162.60L46.39-162.60L136.72-162.60Q139.16-117.19 173.10-90.58Q207.03-63.96 262.70-63.96L262.70-63.96Q313.96-63.96 344.97-84.72Q375.98-105.47 375.98-140.14Z"
                        },
                        " ": {
                            "width": 247.55859375,
                            "d": ""
                        },
                        "o": {
                            "width": 570.3125,
                            "d": "M44.43-262.70L44.43-269.04Q44.43-346.68 74.95-408.69Q105.47-470.70 159.91-504.39Q214.36-538.09 284.18-538.09L284.18-538.09Q392.09-538.09 458.74-463.38Q525.39-388.67 525.39-264.65L525.39-264.65L525.39-258.30Q525.39-181.15 495.85-119.87Q466.31-58.59 411.38-24.41Q356.45 9.77 285.16 9.77L285.16 9.77Q177.73 9.77 111.08-64.94Q44.43-139.65 44.43-262.70L44.43-262.70ZM135.25-258.30L135.25-258.30Q135.25-170.41 176.03-117.19Q216.80-63.96 285.16-63.96L285.16-63.96Q354.00-63.96 394.53-117.92Q435.06-171.88 435.06-269.04L435.06-269.04Q435.06-355.96 393.80-409.91Q352.54-463.87 284.18-463.87L284.18-463.87Q217.29-463.87 176.27-410.64Q135.25-357.42 135.25-258.30Z"
                        },
                        "f": {
                            "width": 347.16796875,
                            "d": "M203.13 0L112.79 0L112.79-458.50L29.30-458.50L29.30-528.32L112.79-528.32L112.79-582.52Q112.79-667.48 158.20-713.87Q203.61-760.25 286.62-760.25L286.62-760.25Q317.87-760.25 348.63-751.95L348.63-751.95L343.75-678.71Q320.80-683.11 294.92-683.11L294.92-683.11Q250.98-683.11 227.05-657.47Q203.13-631.84 203.13-583.98L203.13-583.98L203.13-528.32L315.92-528.32L315.92-458.50L203.13-458.50L203.13 0Z"
                        }
                    }
                }
            }
        }
    },
    "children": [
        {
            "type": "text",
            "transform": "translate(0,-56.4198)",
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
                    "path": "M24,100L176,100"
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
                    "fill": "#4d33b3",
                    "fontFamily": "Courier",
                    "fontSize": "15px",
                    "text": "browser",
                    "xml:space": "preserve",
                    "style": {
                        "white-space": "pre"
                    },
                    "children": [
                        {
                            "type": "tspan",
                            "fill": "#4d33b3",
                            "fontFamily": "Courier",
                            "fontSize": "15px",
                            "text": "browser",
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
            "type": "text",
            "transform": "translate(-0.0736,27.0454)",
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
                    "path": "M24,100L80,83.0864"
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
                    "fill": "#4d33b3",
                    "fontFamily": "Courier",
                    "fontSize": "15px",
                    "text": "browser",
                    "xml:space": "preserve",
                    "style": {
                        "white-space": "pre"
                    },
                    "children": [
                        {
                            "type": "tspan",
                            "fill": "#4d33b3",
                            "fontFamily": "Courier",
                            "fontSize": "15px",
                            "text": "browser",
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
            "type": "path",
            "d": "M24,100L176,100",
            "fill": "none",
            "stroke": "#b8b8c7",
            "strokeDasharray": "3,3",
            "transform": "translate(0,-56.4198)"
        },
        {
            "type": "text",
            "transform": "translate(0,-36.4198)",
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
                    "path": "M24,100L176,100"
                }
            },
            "meta": {
                "appliedEffects": {
                    "text": {
                        "fontSource": "asset"
                    }
                }
            },
            "children": [
                {
                    "type": "tspan",
                    "fill": "#4d33b3",
                    "fontFamily": "Roboto-Regular",
                    "fontSize": "15px",
                    "text": "glyphs off",
                    "xml:space": "preserve",
                    "style": {
                        "white-space": "pre"
                    },
                    "children": [
                        {
                            "type": "tspan",
                            "fill": "#4d33b3",
                            "fontFamily": "Roboto-Regular",
                            "fontSize": "15px",
                            "text": "glyphs off",
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
            "type": "text",
            "transform": "translate(-0.2402,51.2882)",
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
                    "path": "M24,100L110,76.0082"
                }
            },
            "meta": {
                "appliedEffects": {
                    "text": {
                        "fontSource": "asset"
                    }
                }
            },
            "children": [
                {
                    "type": "tspan",
                    "fill": "#4d33b3",
                    "fontFamily": "Roboto-Regular",
                    "fontSize": "15px",
                    "text": "glyphs off",
                    "xml:space": "preserve",
                    "style": {
                        "white-space": "pre"
                    },
                    "children": [
                        {
                            "type": "tspan",
                            "fill": "#4d33b3",
                            "fontFamily": "Roboto-Regular",
                            "fontSize": "15px",
                            "text": "glyphs off",
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
            "type": "path",
            "d": "M24,100L176,100",
            "fill": "none",
            "stroke": "#b8b8c7",
            "strokeDasharray": "3,3",
            "transform": "translate(0,-36.4198)"
        },
        {
            "type": "text",
            "transform": "translate(0,-16.4198)",
            "xml:space": "preserve",
            "style": {
                "white-space": "pre"
            },
            "effects": {
                "text": {
                    "useGlyphs": true
                },
                "textPath": {
                    "pathOverflow": "extend",
                    "lengthAdjust": "spacing",
                    "method": "align",
                    "spacing": "auto",
                    "path": "M24,100L176,100"
                }
            },
            "children": [
                {
                    "type": "tspan",
                    "fill": "#4d33b3",
                    "fontFamily": "Roboto-Regular",
                    "fontSize": "15px",
                    "text": "glyphs of",
                    "xml:space": "preserve",
                    "style": {
                        "white-space": "pre"
                    },
                    "children": [
                        {
                            "type": "tspan",
                            "fill": "#4d33b3",
                            "fontFamily": "Roboto-Regular",
                            "fontSize": "15px",
                            "text": "glyphs of",
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
            "type": "text",
            "transform": "translate(0,76.7)",
            "xml:space": "preserve",
            "style": {
                "white-space": "pre"
            },
            "effects": {
                "text": {
                    "useGlyphs": true
                },
                "textPath": {
                    "pathOverflow": "extend",
                    "lengthAdjust": "spacing",
                    "method": "align",
                    "spacing": "auto",
                    "path": "M24,100L110,73.3"
                }
            },
            "children": [
                {
                    "type": "tspan",
                    "fill": "#4d33b3",
                    "fontFamily": "Roboto-Regular",
                    "fontSize": "15px",
                    "text": "glyphs of",
                    "xml:space": "preserve",
                    "style": {
                        "white-space": "pre"
                    },
                    "children": [
                        {
                            "type": "tspan",
                            "fill": "#4d33b3",
                            "fontFamily": "Roboto-Regular",
                            "fontSize": "15px",
                            "text": "glyphs of",
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
            "type": "path",
            "d": "M24,100L176,100",
            "fill": "none",
            "stroke": "#b8b8c7",
            "strokeDasharray": "3,3",
            "transform": "translate(0,-16.4198)"
        }
    ]
};
