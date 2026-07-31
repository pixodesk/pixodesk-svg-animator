/*---------------------------------------------------------------------------------------
 * Copyright (c) Pixodesk LTD.
 * Licensed under the MIT License. See the LICENSE file in the project root for details.
 *---------------------------------------------------------------------------------------*/

import type { SvgaCaseJson } from '../caseTypes';

export const elemImage: SvgaCaseJson = {
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
            "type": "image",
            "height": 44,
            "href": "data:image/png;base64,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",
            "transform": "translate(150,100)translate(-150,-100)",
            "width": 44,
            "x": 128,
            "y": 78,
            "animate": {
                "transform": {
                    "keyframes": [
                        {
                            "time": 0,
                            "value": {
                                "scale": [
                                    1,
                                    1
                                ],
                                "origin": [
                                    150,
                                    100
                                ]
                            }
                        },
                        {
                            "time": 1000,
                            "value": {
                                "scale": [
                                    1.6,
                                    1.6
                                ],
                                "origin": [
                                    150,
                                    100
                                ]
                            }
                        }
                    ]
                }
            }
        },
        {
            "type": "image",
            "height": 44,
            "href": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAKAAAACgCAYAAACLz2ctAAAMgklEQVR4Aeyce4wVVx3Hf/vmvcvCsksWBHYploKwjQqNbQ0QCi1FpFhRCkKx8J/GJioSE9u0f0hojEaTVmsbC1TaxkRptLRaaiFraxFsKlTTYGF36wLLLqy89sk+8PymzjJz5sy9d+69O3Pmnu9mz52Z8z7f3+fOec3c/M/84sPrcNAgKgbyCX9QIEIFAGCE4qNoIgAICiJVAABGKj8KB4BgIFIFzAUwUtlRuK0AALSVwDESBQBgJLKjUFsBAGgrgWMkCgDASGRHobYCANBWAsdIFACAkcgeaaFaFQ4AtTKHeZUBgObZXKsWA0CtzGFeZQCgeTbXqsUAUCtzmFcZAGiezbVqcagAatVyVEYLBQCgFmYwtxIA0Fzba9FyAKiFGcytBAA01/ZatBwAamEGcysBAEOxPQrxUwAA+ikD/1AUAIChyIxC/BQAgH7KwD8UBQBgKDKjED8FAKCfMvAPRQEAGIrM5haSrOUAMJlCCB9WBQDgsMqLzJMpAACTKYTwYVUAAA6rvMg8mQIAMJlCCB9WBQDgsMqLzJMpkLsAJms5wrVQAABqYQZzKwEAzbW9Fi0HgFqYwdxKAEBzba9FywGgFmYwtxIAMPdsH6sWAcBYmSv3KgsAc8+msWoRAIyVuXKvsgAw92waqxYBwFiZK/cqCwBzz6axalFWAYxVy1FZLRQAgFqYwdxKAEBzba9FywGgFmYwtxIA0Fzba9FyAKiFGcytBADMiu2RSboKAMB0lUO6rCgAALMiIzJJVwEAmK5ySJcVBQBgVmREJukqAADTVQ7psqIAAMyKjOZmkmnLAWCmCiJ9RgoAwIzkQ+JMFQCAmSqI9BkpEBsAi/LzqHJMocsVJKi9HNe+HlmYl5FgnJhzsPOTj8UFHMqxgrs7p42mH989mV5eN43e2FRDb2+ppfqHaunQ5hr6/frptOu+qbTjriqqqxpBufKXwIR6NXH75yvoFWEEp3v4tonKSq765DhPXDvdU1+oVqYJ4rnmllLf/HcsrQqSFTGwjy2upMNbZ1rwMYTV44qodES+FcZfmNHF+TRZfPnmTCqhpTVj6JkvTrGg/MGiSTRhVEGg8nSLnK9bhfzqUyjugHKYyo/jFCa4C82eOIIUWXGylB0D6BfZr06q+F+eU0qHvl5DK2aNpUR3c1VahpK/aPvXzyDORxUnDn6xAdAjZpoebOiV4g6ZZnLiocDM8uJ0kw+l++7tFbTtjgorvyHPNE64PZzPTtE1p5E88iTGAciKZ3LHWHPLuIzvoDyOWzu3lKuidL0D1+lfbb10sLGT/tzQQf9s66HWjn7qH1RGtzyXiK75GwsnWOdx+jASwFkTSgJ3ebZRV8/2B8eOk+jI8PM4ThXnfNcAfXP/Wbrj2VP04L5m2vZ6C20/cI427ztNK/c20e3PnqSfH2mnSz0DquS0qW488ThRGaipp5EA8hhwTRog8YShNoPu9xOlRfQd0fWqWHjuvYu04vlGOny6SxVs+Q1eJ/qViHfX7kZ6U9wZLU/p45FFlZKP3pdGAsgmuS8NAO8Xs988Tpym+9Hyycru+4f1bfSUuLMFyfZ74s5Y39TpSVIzvphmV5R4/HX1MAbA7n5x+3BYYeaE4sATgNWzxzlyIOqR8nQFShe1AowZwkne9IcTV2jfB1dk75Suv/2nFurs8w4MuZtPKQMNIhkD4FGpa+M72f1iGSRVG5SIBezpEkBHzvh3l3K+2+6skL2Ix3KPH2rz+CfxcAW/+u+rrmu+WFA9ig+xcMYA+Pez3Z5ZpHxHS2SxtQJWhtYZ58Xjl5yXCc/rqkZ6wneJ8ZzHM6DH00fbyX1vJyqP0eK0MQAWipYeb+12mZe7RL6zuTx9Llbd7J79ctd34kKvT2y393yxdcYTH6cvL6m8+H7qADvTOs8v9w7SgqdP0mcd7nPPnHJG0fpcmEXr+mWtckVid+QlyeB8R/vK3LKkZfB22LSyIle8v/6ni4pFt+zy9LlYVjvWE9J48RrxrNYTYJiHMQAW5OVZC7t9ktVX3eyeWKjs/9VPlRHD6gzbLbpPztPp53c+f7L34QH5buyXNtf9jQFQ8GfZ8r2WHutof/Da3OiixDLcK23ddV4bpBPtvWTnaefldywt8T4wcPSMezjglzbX/RMrn4Ot33v8oqtVfGdbN6/M5ee84E1/htTpV/9Rp/My6flIBeDnOvqSpuMIWz9dTtvFDDqoqxPjTk6vuwsEoO6NSaV+PHbjvVZn3JWzvGM0O3ydT/drh6dyHKEYK/63W72dJue3RQD4JbEAHtTxsEHOS8dr4wBkI7wrdX/W83clailW3OSG84qYdZ4SEwjOJ1WnGiuq/FLNL5fiqVXPpRYq2rLnmLsb5igPzBvPB5cbW5xPU8X+rdMzaPfLafuliQ/73SR2YvhoujMSwHfForS8jXaPoht+YJ53bLjnH154k0HUq9iyqy1Pbb+WH8VqvtxHiVyq3XmyekYRbiSALPTfpK05fuS9bIR7tnrPLPcSzeWeQeL1O04fxPGitRxfXleUw+3rh14+TWte+iih++k7F+zosTsaC+BuxZ1sY934IQPyOxnVYwuHrvnkUFMHHwK7i4oJR/VY98J24EwdCeZWetcZHcFanxoL4PutPZ4nSZbPHDNkrPWuMeHH3unu3aoeWpg1sYR4CejjnDP7nJlid55ZKcOT2lgAWU5ekuGj7SaNLqSK/2/k3y3NfnmcdfpKamt3dn728bUPvU+slBTkkWqMaacJcpwiTZSCpI06rtEA8naabIBNt5YTjwV5TOgMO9iYXvfLefC48dqA/MwK0YO33ujyOV46buGUUUNfGorhn9EA8nbaVbGt5rQbv6/xtTrv7Fc1ZnSmS3Z+qNG7e8KgL5kxOllS33B+I27nsirf8DgEGA0gG+gv0rYav+gtP67f3jVALVf7OXra7om32zzP7XFmjyyutF5C5/Og7vElVZRsHztonmHHNx5A1cSCF6CdhuBXI53X6ZzzEs5bEuycDwP0m7XTAnWj/AzjE8sm07LaG5MmziuOzngAeXzGcCQyXqbdr503v2Ipd/kcVj6ygF7ZMIP4ZXV++IH9/NyG+WV0cHMNLc6g6/bLW+U/3H75w11AHPJPtL7H7+q2dWbW/doa8ERkq1hYVuzMWW/L8cvq/ENE+zdMpydXVtNjSyott2vNVDqwaYb1+zHfum2i52Uqnt7wE9Z2OXE6AkBhLVU3LLyt/wMnvUsoVkCaH/wgw/YDLZ73U5zZ8XLQguqRxA9CsJtTUWLNzHnS4YzH5wzzw6+dpdezXE/OOwwHAIXKvL7H63zi1POvenDBEymgx0ExI161t5HOZDix4fdBNv62mXg9848AMKAVAkaXHx7g5PK7vuzHrlvxrqzKj+PaTvVLA/x7LDwDtuPIxz7F2l5Pin0hd+2rX2ii779xjvhczjvRNY9ZXzh+iZbvabCezOa4h5u7XO+YqB6A4Hi6udjcAXfUt5HzzS8+/9lh9SY87zxwuNM9f+xSQu13vnXekz//HkuiRHzXdJbB5/yLBYnSyGEHTnVYP8nBMPJQ4MSFXuIxJz/2zw/O8l2On4Q5JrYOXxU7Kht/10xLdzfQT965QAOOd9J5HLjwlzfejnv0YKtclJbXsQFQS/WyWCnujp880k4bRJd676+baNFzDdaPFC3d1WA9CbNFTF4efbOVPjjfm8VSo89KXwCj1wY1CEEBABiCyCjCXwEA6K8NQkJQAACGIDKK8FcAAPprg5AQFACAIYiMIvwVAID+2kQVYlS5ANAoc+vXWACon02MqhEANMrc+jUWAOpnE6NqBACNMrd+jQWA+tnEqBq5ADSq5WisFgoAQC3MYG4lAKC5ttei5QBQCzOYWwkAaK7ttWg5ANTCDOZWAgBatsdHVAoAwKiUR7mWAgDQkgEfUSkAAKNSHuVaCgBASwZ8RKUAAIxKeZRrKQAALRnM/Yi65QAwagsYXj4ANByAqJsPAKO2gOHlA0DDAYi6+QAwagsYXj4ANByAqJsfHYBRtxzla6EAANTCDOZWAgCaa3stWg4AtTCDuZUAgObaXouWA0AtzGBuJQBg+LZHiQ4FAKBDDJyGrwAADF9zlOhQAAA6xMBp+AoAwPA1R4kOBQCgQwychq8AAAxfc3NLVLQcACpEgVd4CgDA8LRGSQoFAKBCFHiFpwAADE9rlKRQAAAqRIFXeAoAwPC0RkkKBQwBUNFyeGmhAADUwgzmVgIAmmt7LVoOALUwg7mVAIDm2l6LlgNALcxgbiUAYI7bXvfm/Q8AAP///cXGkAAAAAZJREFUAwAp0nU973WrJgAAAABJRU5ErkJggg==",
            "width": 44,
            "x": 28,
            "y": 78
        }
    ]
};
