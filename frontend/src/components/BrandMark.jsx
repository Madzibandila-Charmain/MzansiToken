/*
    BrandMark.jsx
    Author: Mukovhe Ranwashe (RNWMUK001)
    Date: 17 September 2026
*/

import { FLAG } from "./flagColours";

/* A square, so the mark sits in a tile rather than a flag's 3:2. */
const S = 48;

const G = S / 5;                /* green band */
const F = S / 15;               /* each fimbriation */
const AX = S * 0.42;            /* where the Y converges */

const PHI = Math.atan((S / 2) / AX);
const APEX_GOLD = AX - (G / 2 + F) / Math.sin(PHI);
const APEX_BLACK = APEX_GOLD - F / Math.sin(PHI);

const PALL =
    `M ${AX} ${S / 2} L -3 -3`
    + ` M ${AX} ${S / 2} L -3 ${S + 3}`
    + ` M ${AX} ${S / 2} L ${S + 3} ${S / 2}`;

/* The token boundary: a slot of surface colour straight down the mark. */
const CUT_X = S * 0.70;
const CUT_W = S * 0.085;

function BrandMark({ size = 38, title = "MzansiToken" }) {

    return (
        <svg
            className="brand-mark-svg"
            width={size}
            height={size}
            viewBox={`0 0 ${S} ${S}`}
            role="img"
            aria-label={title}
        >

            <defs>
                {/* A rounded tile, so the flag reads as a mark and not as
                    a flag that has been cropped. */}
                <clipPath id="brand-tile">
                    <rect
                        x="0"
                        y="0"
                        width={S}
                        height={S}
                        rx={S * 0.29}
                    />
                </clipPath>
            </defs>

            <g clipPath="url(#brand-tile)">

                <rect
                    x="0"
                    y="0"
                    width={S}
                    height={S / 2}
                    fill={FLAG.red}
                />
                <rect
                    x="0"
                    y={S / 2}
                    width={S}
                    height={S / 2}
                    fill={FLAG.blue}
                />

                <path
                    d={PALL}
                    fill="none"
                    stroke={FLAG.white}
                    strokeWidth={G + 2 * F}
                />
                <path
                    d={PALL}
                    fill="none"
                    stroke={FLAG.green}
                    strokeWidth={G}
                />

                <path
                    d={`M ${APEX_GOLD} ${S / 2} L -3 -3 L -3 ${S + 3} Z`}
                    fill={FLAG.gold}
                />
                <path
                    d={`M ${APEX_BLACK} ${S / 2} L -3 -3 L -3 ${S + 3} Z`}
                    fill={FLAG.black}
                />

                {/* The token boundary. */}
                <rect
                    className="brand-cut"
                    x={CUT_X}
                    y="-2"
                    width={CUT_W}
                    height={S + 4}
                />

            </g>

        </svg>
    );
}

export default BrandMark;