/*
    MetricsChart
    Author: Mukovhe Ranwashe (RNWMUK001)
    Date: 15 September 2026

    Shows every language at once for one tokenizer, using the
    /metrics/{model} endpoint that already exists in the backend.

    Two charts:
      - a doughnut of each language's share of the total token
        bill. This is the only part-to-whole number on the page,
        so it is the only one that may honestly be a pie.
      - a petal wheel for the three ratio measures. Ratios do not
        add up to anything, so those get length, not angle.
*/

import { useEffect, useRef, useState } from "react";

import { getMetrics, friendlyError } from "../api/client";

/* One shared source of truth for language colours and families, so the
   pills, the reading panels and these charts can never disagree. */
import { languageColour, FAMILY, LANGUAGE_ORDER } from "./languageColours";

/*
    The petal wheel plots ratios only. A raw corpus total is not a ratio,
    and drawn as a petal it would just restate the doughnut beside it, so
    Inspect takes the ratio subset of the shared list.
*/
import { RATIO_MEASURES as MEASURES } from "../lib/measures";


/* Geometry. One centre for both charts so they line up. */
const CENTRE = 160;
const DONUT_OUTER = 122;
const DONUT_INNER = 72;
const ROSE_OUTER = 120;
const ROSE_INNER = 26;

const TAU = Math.PI * 2;
const START = -Math.PI / 2;

/*
    Path for a slice of a ring: out along the outer arc, back
    along the inner one.
*/
function sector(radiusInner, radiusOuter, angleStart, angleEnd) {

    const point = (radius, angle) => [
        CENTRE + radius * Math.cos(angle),
        CENTRE + radius * Math.sin(angle)
    ];

    const large = (angleEnd - angleStart) > Math.PI ? 1 : 0;

    const [x0, y0] = point(radiusOuter, angleStart);
    const [x1, y1] = point(radiusOuter, angleEnd);
    const [x2, y2] = point(radiusInner, angleEnd);
    const [x3, y3] = point(radiusInner, angleStart);

    return `M${x0} ${y0}`
        + `A${radiusOuter} ${radiusOuter} 0 ${large} 1 ${x1} ${y1}`
        + `L${x2} ${y2}`
        + `A${radiusInner} ${radiusInner} 0 ${large} 0 ${x3} ${y3}`
        + `Z`;
}

function ordinal(n) {

    if (n % 10 === 1 && n !== 11) {
        return "st";
    }

    if (n % 10 === 2 && n !== 12) {
        return "nd";
    }

    if (n % 10 === 3 && n !== 13) {
        return "rd";
    }

    return "th";
}

function MetricsChart({ tokenizer }) {

    const [data, setData] = useState(null);
    const [error, setError] = useState("");

    /*
        The charts used to swap silently: the old tokenizer's slices stayed
        on screen, at full clarity, until the new numbers happened to land.
        This is what the blur and the wheel are driven by.
    */
    const [loading, setLoading] = useState(false);
    const [measure, setMeasure] = useState("fertility");

    /* Which language the pointer is on, and where to put the card. */
    const [hot, setHot] = useState(null);
    const [tip, setTip] = useState({ x: 0, y: 0 });

    /* Starts false so the slices grow in from nothing on first paint. */
    const [grown, setGrown] = useState(false);

    const requestRef = useRef(0);

    /* Whether anything has ever been drawn, so a tokenizer switch does not
       collapse the slices to nothing behind the blur. */
    const drawnRef = useRef(false);

    useEffect(() => {

        if (!tokenizer) {
            return;
        }

        /*
            Each request gets a number. A slow reply from an older
            tokenizer is thrown away instead of overwriting a newer
            one - otherwise fast typing can leave the wrong numbers
            on screen.
        */
        const id = requestRef.current + 1;
        requestRef.current = id;

        /*
            Only collapse the slices on the very first load, where growing
            them in is the point. On a later switch the previous tokenizer's
            chart stays on screen, blurred, and morphs into the new one -
            collapsing it would leave an empty box behind the blur.
        */
        if (!drawnRef.current) {
            setGrown(false);
        }

        setError("");
        setLoading(true);

        getMetrics(tokenizer)
            .then((result) => {

                if (requestRef.current !== id) {
                    return;
                }

                setData(result);
                setLoading(false);

                drawnRef.current = true;

                /* Next frame, so the transition has something to run from. */
                requestAnimationFrame(() => setGrown(true));

            })
            .catch((err) => {

                if (requestRef.current !== id) {
                    return;
                }

                setData(null);
                setLoading(false);

                drawnRef.current = false;

                setError(
                    friendlyError(err) || "Could not load metrics."
                );

            });

    }, [tokenizer]);

    if (error) {

        return (
            <section className="charts-box">
                <div className="inspect-error">{error}</div>
            </section>
        );

    }

    if (!data) {

        if (!loading) {
            return null;
        }

        return (
            <section className="charts-box is-first-load">
                <div className="charts-overlay">
                    <span className="spinner is-big"></span>
                    <span>Loading all eight languages at once&hellip;</span>
                </div>
            </section>
        );
    }

    /*
        Slices go round in the same order the palette was validated in,
        and English last. That keeps neighbouring slices the pairs that
        were checked for colour-blind separation.
    */
    const names = Object.keys(data).sort((a, b) => {

        if (a === "English") {
            return 1;
        }

        if (b === "English") {
            return -1;
        }

        const left = LANGUAGE_ORDER.indexOf(a);
        const right = LANGUAGE_ORDER.indexOf(b);

        return (left === -1 ? 99 : left) - (right === -1 ? 99 : right);
    });

    const colours = {};

    names.forEach((name) => {
        colours[name] = languageColour(name);
    });

    const total = names.reduce(
        (sum, name) => sum + data[name].token_count,
        0
    );

    const current = MEASURES.find((m) => m.key === measure);

    /* token_premium is null for English - it is the baseline, so 1.00. */
    const valueOf = (name) => {

        const value = data[name][measure];

        if (value === null || value === undefined) {
            return measure === "token_premium" ? 1 : 0;
        }

        return value;
    };

    const biggest = Math.max(...names.map(valueOf));

    function showTip(event, name) {

        setHot(name);

        setTip({
            x: Math.min(event.clientX + 16, window.innerWidth - 250),
            y: Math.min(event.clientY + 16, window.innerHeight - 140)
        });

    }

    /* ---------- doughnut ---------- */

    let angle = START;

    const donutSlices = names.map((name, index) => {

        const span = data[name].token_count / total * TAU;
        const pad = Math.min(0.016, span / 8);
        const mid = angle + span / 2;

        const share = data[name].token_count / total * 100;

        /*
            The percentage sits just outside its own slice. It used to live
            only in the legend, which meant reading the doughnut was a
            matter of matching colours by eye.
        */
        const labelRadius = DONUT_OUTER + 17;

        const slice = {
            name: name,
            path: sector(DONUT_INNER, DONUT_OUTER, angle + pad, angle + span - pad),
            dx: Math.cos(mid) * 12,
            dy: Math.sin(mid) * 12,
            share: share,
            labelX: CENTRE + labelRadius * Math.cos(mid),
            labelY: CENTRE + labelRadius * Math.sin(mid) + 4,

            /* Keep the text inside the box on the left-hand slices. */
            anchor: Math.cos(mid) > 0.25
                ? "start"
                : Math.cos(mid) < -0.25
                    ? "end"
                    : "middle",

            delay: index * 55
        };

        angle = angle + span;

        return slice;
    });

    /* ---------- petal wheel ---------- */

    const slotAngle = TAU / names.length;

    const petals = names.map((name, index) => {

        const from = START + index * slotAngle;
        const mid = from + slotAngle / 2;
        const scale = biggest ? valueOf(name) / biggest : 0;

        /*
            Drawn at full length and then scaled. Scaling about the
            centre keeps the angle and changes only the radius, and
            a transform is something CSS can animate.
        */
        const labelRadius =
            ROSE_INNER + (ROSE_OUTER - ROSE_INNER) * scale + 13;

        return {
            name: name,
            path: sector(ROSE_INNER, ROSE_OUTER, from + 0.035, from + slotAngle - 0.035),
            scale: scale,
            dx: Math.cos(mid) * 10,
            dy: Math.sin(mid) * 10,
            labelX: labelRadius * Math.cos(mid),
            labelY: labelRadius * Math.sin(mid) + 4,
            delay: index * 55
        };
    });

    /* ---------- the sentence underneath ---------- */

    const southAfrican = names.filter((n) => n !== "English");

    const byTokens = [...southAfrican].sort(
        (a, b) => data[b].token_count - data[a].token_count
    );

    const byWord = [...southAfrican].sort(
        (a, b) => data[b].fertility - data[a].fertility
    );

    const cheapest = byTokens[byTokens.length - 1];
    const bestPerWord = byWord[byWord.length - 1];

    const wordRank = byWord.indexOf(cheapest) + 1;
    const costRank = byTokens.indexOf(bestPerWord) + 1;

    /* ---------- one wedge, used by both charts ---------- */

    function wedge(item, scale) {

        const lifted = hot === item.name;

        return (
            <g
                key={item.name}
                className={
                    "chart-pop"
                    + (lifted ? " is-on" : "")
                    + (hot && !lifted ? " is-dim" : "")
                }
                style={{
                    transform: lifted
                        ? `translate(${item.dx}px, ${item.dy}px)`
                        : "translate(0px, 0px)"
                }}
                onMouseMove={(event) => showTip(event, item.name)}
                onMouseLeave={() => setHot(null)}
            >
                <g
                    className="chart-grow"
                    style={{
                        transformOrigin: `${CENTRE}px ${CENTRE}px`,
                        transform: `scale(${grown ? scale : 0})`,
                        transitionDelay: `${item.delay}ms`
                    }}
                >
                    <path
                        className="chart-wedge"
                        d={item.path}
                        fill={colours[item.name]}
                    />
                </g>
            </g>
        );
    }

    return (
        <section
            className={"charts-box" + (loading ? " is-busy" : "")}
        >

            {/* Blurs everything behind it, so nobody reads the old
                tokenizer's slices as if they were the new one's. */}
            {loading && (
                <div className="charts-overlay">
                    <span className="spinner is-big"></span>
                    <span>Loading all eight languages at once&hellip;</span>
                </div>
            )}

            <div className="charts-head">
                <h2>All eight languages at once</h2>
            </div>

            <div className="charts-grid">

                {/* Doughnut */}
                <div className="chart-card">

                    <h3>Share of the whole token bill</h3>
                    <p>Every token spent belongs to one language, so these add to 100%.</p>

                    <svg
                        className="chart-svg"
                        viewBox="-24 0 368 320"
                        role="img"
                        aria-label="Share of total tokens by language"
                    >
                        {donutSlices.map((slice) => wedge(slice, 1))}

                        {/* The share of each slice, printed on the slice. */}
                        {donutSlices.map((slice) => (
                            <text
                                key={`share-${slice.name}`}
                                className={
                                    "chart-share"
                                    + (hot && hot !== slice.name
                                        ? " is-dim"
                                        : "")
                                }
                                x={slice.labelX}
                                y={slice.labelY}
                                textAnchor={slice.anchor}
                                fill={colours[slice.name]}
                            >
                                {slice.share.toFixed(1)}%
                            </text>
                        ))}

                        <text
                            className="chart-hub"
                            x={CENTRE}
                            y={CENTRE - 2}
                            textAnchor="middle"
                        >
                            {total.toLocaleString()}
                        </text>

                        <text
                            className="chart-hub-sub"
                            x={CENTRE}
                            y={CENTRE + 15}
                            textAnchor="middle"
                        >
                            tokens in total
                        </text>
                    </svg>

                </div>

                {/* Petal wheel */}
                <div className="chart-card">

                    <h3>{current.title}</h3>
                    <p>Longer petal is worse. Switch the measure and watch them grow.</p>

                    <div className="chart-switch">
                        {MEASURES.map((m) => (
                            <button
                                key={m.key}
                                type="button"
                                aria-pressed={measure === m.key}
                                onClick={() => setMeasure(m.key)}
                            >
                                {m.label}
                            </button>
                        ))}
                    </div>

                    <svg
                        className="chart-svg"
                        viewBox="0 0 320 320"
                        role="img"
                        aria-label={current.title + " by language"}
                    >
                        {petals.map((petal) => wedge(petal, petal.scale))}

                        {/* English is 1.00 by definition */}
                        {measure === "token_premium" && (
                            <circle
                                className="chart-baseline-ring"
                                cx={CENTRE}
                                cy={CENTRE}
                                r={ROSE_INNER + (ROSE_OUTER - ROSE_INNER) * (1 / biggest)}
                            />
                        )}

                        {petals.map((petal) => (
                            <text
                                key={petal.name}
                                className="chart-label"
                                x={CENTRE}
                                y={CENTRE}
                                textAnchor="middle"
                                fill={colours[petal.name]}
                                style={{
                                    transform: `translate(${petal.labelX}px, ${petal.labelY}px)`
                                }}
                            >
                                {current.format(valueOf(petal.name))}
                            </text>
                        ))}
                    </svg>

                </div>

            </div>

            {/* Legend. Also the direct labels, which is what lets the
                two lighter colours stay in the palette. */}
            <div className="chart-legend">
                {names.map((name) => (
                    <div
                        key={name}
                        className="chart-chip"
                        onMouseEnter={() => setHot(name)}
                        onMouseLeave={() => setHot(null)}
                    >
                        <i
                            className="swatch"
                            style={{ background: colours[name] }}
                        />
                        {name}
                        {" "}
                        <b>
                            {(data[name].token_count / total * 100).toFixed(1)}%
                        </b>
                        {" "}
                        <span className="family">{FAMILY[name] || ""}</span>
                    </div>
                ))}
            </div>

            <p className="chart-note">
                On the wheel <b>{bestPerWord}</b> has the shortest petal
                &mdash; the best tokens-per-word score. On the doughnut it
                still takes the {costRank}{ordinal(costRank)} biggest slice.
                {" "}
                <b>{cheapest}</b> does the opposite: {wordRank}
                {ordinal(wordRank)} per word, yet the smallest slice of the
                bill. Per-word divides by spaces, and the two families do not
                put their spaces in the same places.
            </p>

            {/* Hover card */}
            <div
                className={"chart-tip" + (hot ? " is-visible" : "")}
                style={{ left: tip.x, top: tip.y }}
            >
                {hot && (
                    <>
                        <b>{hot}</b>
                        {" "}
                        <span className="key">{FAMILY[hot] || ""}</span>
                        <br />
                        <span className="key">tokens</span>
                        {" "}
                        <span className="val">
                            {data[hot].token_count.toLocaleString()}
                        </span>
                        <br />
                        <span className="key">per word</span>
                        {" "}
                        <span className="val">
                            {data[hot].fertility.toFixed(2)}
                        </span>
                        <br />
                        <span className="key">bytes/token</span>
                        {" "}
                        <span className="val">
                            {data[hot].compression.toFixed(2)}
                        </span>
                        <br />
                        <span className="key">vs English</span>
                        {" "}
                        <span className="val">
                            {data[hot].token_premium === null
                                ? "—"
                                : data[hot].token_premium.toFixed(2) + "×"}
                        </span>
                    </>
                )}
            </div>

        </section>
    );
}

export default MetricsChart;