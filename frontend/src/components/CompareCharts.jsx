/*
    CompareCharts
    Author: Mukovhe Ranwashe (RNWMUK001)
    Date: 16 September 2026

    Two tokenizers, all eight languages, on one set of axes.

    One chart, and a row of headline numbers underneath it:

      - a dumbbell plot: where does each tokenizer sit for this language,
        and how far apart are they? Two dots joined by a line, so the gap
        is a length you can see rather than a subtraction you have to do.
        The family is printed under each language name, because that is
        where the pattern lives - the Nguni languages move together, and
        so do the Sotho-Tswana ones.

    It reads GET /metrics/{model} once per tokenizer. It deliberately does
    NOT use compareTokenizers() from the client, because that helper POSTs
    to /compare while the backend serves GET /compare - it would 405.
*/

import { useEffect, useRef, useState } from "react";

import { getMetrics, friendlyError } from "../api/client";

import { FAMILY } from "./languageColours";

/* One colour each. Checked for colour-blind separation - these two stay
   apart under every simulation, which matters when the whole page is a
   comparison of exactly two things. */
const COLOUR_A = "#d2601a";
const COLOUR_B = "#2f6fd0";

/*
    Compare is a difference between two tokenizers, so unlike the Inspect
    wheel it can show the raw corpus total as well - the whole list.
*/
import { COMPARE_MEASURES as MEASURES } from "../lib/measures";


function CompareCharts({ tokenizerA, tokenizerB }) {

    const [pair, setPair] = useState(null);
    const [error, setError] = useState("");
    const [measure, setMeasure] = useState("fertility");
    const [hot, setHot] = useState(null);

    /* Which shape the same numbers are drawn in. */
    const [shape, setShape] = useState("dots");

    const requestRef = useRef(0);

    /* Which [tokenizerA, tokenizerB] pair `pair`/`error` currently
       reflect. `loading` below is derived by comparing this against
       the pair the page is actually showing now, instead of being a
       flag the effect flips on and off - the flip was a synchronous
       setState in the effect body, flagged by
       react-hooks/set-state-in-effect. JSON.stringify is just a cheap
       way to compare two strings at once; tokenizer names can contain
       "/", so they cannot be joined with it safely. */
    const [resolvedFor, setResolvedFor] = useState(null);

    const requestedFor =
        tokenizerA && tokenizerB
            ? JSON.stringify([tokenizerA, tokenizerB])
            : null;

    const loading = requestedFor !== null && requestedFor !== resolvedFor;

    useEffect(() => {

        if (!tokenizerA || !tokenizerB) {
            return;
        }

        /* Number every request so a slow reply for an old pair of
           tokenizers cannot overwrite a newer one. */
        const id = requestRef.current + 1;
        requestRef.current = id;

        const key = JSON.stringify([tokenizerA, tokenizerB]);

        Promise.all([
            getMetrics(tokenizerA),
            getMetrics(tokenizerB)
        ])
            .then(([a, b]) => {

                if (requestRef.current !== id) {
                    return;
                }

                setPair({ a, b });
                setError("");
                setResolvedFor(key);

            })
            .catch((err) => {

                if (requestRef.current !== id) {
                    return;
                }

                setPair(null);
                setError(
                    friendlyError(err) ||
                    "Could not load the comparison."
                );
                setResolvedFor(key);

            });

    }, [tokenizerA, tokenizerB]);

    /*
        Compare already shows this exact failure at the top of the page
        (same friendlyError text) the moment the backend is unreachable -
        this used to repeat it a second time down here. Rendering nothing
        leaves that one message as the only place it appears.
    */
    if (error && !loading) {
        return null;
    }

    if (loading && !pair) {

        return (
            /*
                Same two classes as Inspect's first load: is-first-load
                gives the section a height, charts-overlay centres the
                spinner above the sentence. This used to use a
                charts-waiting class that had no CSS at all, so the
                spinner sat against the text in a collapsed box.
            */
            <section className="compare-charts is-first-load">
                <div className="charts-overlay">
                    <span className="spinner is-big"></span>
                    <span>Comparing {tokenizerA} and {tokenizerB}&hellip;</span>
                </div>
            </section>
        );

    }

    if (!pair) {
        return null;
    }

    const current = MEASURES.find((m) => m.key === measure);

    /* Only languages both tokenizers reported, so no row is half empty. */
    const names = Object.keys(pair.a).filter(
        (name) => pair.b[name] !== undefined
    );

    const valueOf = (side, name) => {

        const value = pair[side][name]?.[measure];

        if (value === null || value === undefined) {
            return measure === "token_premium" ? 1 : 0;
        }

        return value;
    };

    const rows = names.map((name) => {

        const a = valueOf("a", name);
        const b = valueOf("b", name);

        /* Percentage change from A to B, then flipped where needed so that
           a positive number always means "B is better". */
        const raw = a === 0 ? 0 : (b - a) / a * 100;

        return {
            name: name,
            family: FAMILY[name] || "",
            a: a,
            b: b,
            change: raw,
            gain: current.lowerIsBetter ? -raw : raw
        };
    });

    const highest = Math.max(...rows.map((r) => Math.max(r.a, r.b)));

    const southAfrican = rows.filter((r) => r.name !== "English");
    const improved = southAfrican.filter((r) => r.gain > 0).length;

    const meanGain =
        southAfrican.length === 0
            ? 0
            : southAfrican.reduce((sum, r) => sum + r.gain, 0) /
              southAfrican.length;

    /*
        "Biggest change" used to be the language B improved the MOST on,
        which is not what the words say, and left a user asking why one
        language was "winning". Rank by how far apart the two tokenizers
        are, in either direction, and then say the direction in words.
    */
    const ranked = [...southAfrican].sort(
        (p, q) => Math.abs(q.gain) - Math.abs(p.gain)
    );

    const widest = ranked[0];
    const closest = ranked[ranked.length - 1];

    const english = rows.find((r) => r.name === "English");

    /* The tokenizer that is ahead on average, named rather than implied. */
    const winner = meanGain > 0 ? tokenizerB : tokenizerA;

    const winnerWins = meanGain > 0
        ? improved
        : southAfrican.length - improved;

    /*
        Every percentage on this page is a size plus a direction in words,
        because "44%" on its own does not say who it is good for.
    */
    const sizeOf = (row) => {

        const size = Math.abs(row.change);

        return size < 1
            ? size.toFixed(1)
            : String(Math.round(size));
    };

    const phraseOf = (row) => (
        `${sizeOf(row)}% ${row.gain > 0
            ? current.betterWord
            : current.worseWord}`
    );

    /*
        If nothing moved there is nothing to report, and saying "0 of 8
        improved" would read as a verdict against B when in fact the two
        sides are producing the same numbers. Usually that means both
        pickers are on the same tokenizer.
    */
    const unchanged = rows.every((r) => Math.abs(r.change) < 0.05);

    /* ---------- dumbbell geometry ---------- */

    const LEFT = 132;
    const RIGHT = 860;
    const TOP = 30;
    const ROW = 40;

    const x = (value) => LEFT + (value / highest) * (RIGHT - LEFT);

    const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => f * highest);

    return (
        <section className="compare-charts">

            <div className={"compare-body" + (loading ? " is-loading" : "")}>

                <div className="compare-head">
                    <h2>All eight languages, both tokenizers</h2>

                    <div className="compare-legend">
                        <span>
                            <i style={{ background: COLOUR_A }}></i>
                            {tokenizerA}
                        </span>
                        <span>
                            <i style={{ background: COLOUR_B }}></i>
                            {tokenizerB}
                        </span>
                    </div>
                </div>

                {tokenizerA === tokenizerB && (
                    <div className="selection-status is-warning">
                        <span className="status-dot"></span>
                        <span>
                            Both sides are set to <b>{tokenizerA}</b>, so every
                            pair of dots sits in the same place.
                        </span>
                    </div>
                )}

                <div className="compare-controls">

                    <div className="compare-switch">
                        {[
                            { key: "dots", label: "Dots" },
                            { key: "bars", label: "Bars" }
                        ].map((s2) => (
                            <button
                                key={s2.key}
                                type="button"
                                aria-pressed={shape === s2.key}
                                onClick={() => setShape(s2.key)}
                            >
                                {s2.label}
                            </button>
                        ))}
                    </div>

                    <div className="compare-switch">
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

                </div>

                {/* ---------- the chart ---------- */}
                {shape === "dots" && (
                <div className="compare-card">

                        <h3>{current.title}</h3>
                        <p>
                            The line between the two dots is the difference.
                            A short line means the tokenizers agree.
                        </p>

                        <svg
                            className="compare-svg"
                            viewBox={`0 0 900 ${TOP + rows.length * ROW + 40}`}
                            role="img"
                            aria-label={
                                current.title + " for " + tokenizerA +
                                " and " + tokenizerB + " by language"
                            }
                        >

                            {ticks.map((t, i) => (
                                <g key={i}>
                                    <line
                                        className="compare-grid-line"
                                        x1={x(t)}
                                        y1={TOP - 14}
                                        x2={x(t)}
                                        y2={TOP + rows.length * ROW - 18}
                                    />
                                    <text
                                        className="compare-axis"
                                        x={x(t)}
                                        y={TOP + rows.length * ROW}
                                        textAnchor="middle"
                                    >
                                        {current.format(t)}
                                    </text>
                                </g>
                            ))}

                            {rows.map((r, i) => {

                                const y = TOP + i * ROW;
                                const low = Math.min(x(r.a), x(r.b));
                                const high = Math.max(x(r.a), x(r.b));
                                const lowValue = x(r.a) < x(r.b) ? r.a : r.b;
                                const highValue = x(r.a) < x(r.b) ? r.b : r.a;

                                /*
                                    When both tokenizers land on the same
                                    number the second dot covers the first
                                    and one of them simply disappears. Draw
                                    one dot split down the middle instead,
                                    so "they agree" is visible rather than
                                    looking like a missing value.
                                */
                                const together = Math.abs(x(r.a) - x(r.b)) < 1.5;
                                const cx = x(r.a);

                                return (
                                    <g
                                        key={r.name}
                                        className={
                                            "compare-row"
                                            + (hot === r.name ? " is-on" : "")
                                            + (hot && hot !== r.name ? " is-dim" : "")
                                        }
                                        onMouseEnter={() => setHot(r.name)}
                                        onMouseLeave={() => setHot(null)}
                                    >

                                        {/* A wide invisible band so the whole
                                            row is a hover target, not just
                                            the two dots. */}
                                        <rect
                                            x="0"
                                            y={y - ROW / 2}
                                            width="900"
                                            height={ROW}
                                            fill="transparent"
                                        />

                                        <text className="compare-lang" x="0" y={y + 1}>
                                            {r.name}
                                        </text>

                                        <text className="compare-family" x="0" y={y + 14}>
                                            {r.family}
                                        </text>

                                        {together ? (

                                            <>
                                                {/* One dot, two halves. */}
                                                <path
                                                    className="compare-dot"
                                                    d={`M${cx} ${y - 6.5}`
                                                        + ` A6.5 6.5 0 0 0 ${cx} ${y + 6.5} Z`}
                                                    fill={COLOUR_A}
                                                />

                                                <path
                                                    className="compare-dot"
                                                    d={`M${cx} ${y - 6.5}`
                                                        + ` A6.5 6.5 0 0 1 ${cx} ${y + 6.5} Z`}
                                                    fill={COLOUR_B}
                                                />

                                                <text
                                                    className="compare-value"
                                                    x={cx + 13}
                                                    y={y + 4}
                                                >
                                                    {current.format(r.a)}
                                                </text>
                                            </>

                                        ) : (

                                            <>
                                                <line
                                                    className="compare-connector"
                                                    x1={x(r.a)}
                                                    y1={y}
                                                    x2={x(r.b)}
                                                    y2={y}
                                                />

                                                <circle
                                                    className="compare-dot"
                                                    cx={x(r.a)}
                                                    cy={y}
                                                    r="6.5"
                                                    fill={COLOUR_A}
                                                />

                                                <circle
                                                    className="compare-dot"
                                                    cx={x(r.b)}
                                                    cy={y}
                                                    r="6.5"
                                                    fill={COLOUR_B}
                                                />

                                                <text
                                                    className="compare-value"
                                                    x={low - 11}
                                                    y={y + 4}
                                                    textAnchor="end"
                                                >
                                                    {current.format(lowValue)}
                                                </text>

                                                <text
                                                    className="compare-value"
                                                    x={high + 11}
                                                    y={y + 4}
                                                >
                                                    {current.format(highValue)}
                                                </text>
                                            </>

                                        )}

                                    </g>
                                );
                            })}
                        </svg>

                </div>
                )}

                {/* ---------- grouped bars ---------- */}
                {shape === "bars" && (
                <div className="compare-card">

                    <h3>{current.title}</h3>
                    <p>
                        Two bars per language, one for each tokenizer. The
                        shorter bar wins for every measure except bytes per
                        token, where longer is better.
                    </p>

                    <svg
                        className="compare-svg"
                        viewBox={`0 0 900 ${TOP + rows.length * ROW + 40}`}
                        role="img"
                        aria-label={current.title + " as grouped bars"}
                    >

                        {ticks.map((t, i) => (
                            <g key={i}>
                                <line
                                    className="compare-grid-line"
                                    x1={x(t)}
                                    y1={TOP - 20}
                                    x2={x(t)}
                                    y2={TOP + rows.length * ROW - 18}
                                />
                                <text
                                    className="compare-axis"
                                    x={x(t)}
                                    y={TOP + rows.length * ROW}
                                    textAnchor="middle"
                                >
                                    {current.format(t)}
                                </text>
                            </g>
                        ))}

                        {rows.map((r, i) => {

                            const y = TOP + i * ROW;

                            /* 2px of surface between the pair, so they read
                               as two bars rather than one striped block. */
                            const h = 11;

                            return (
                                <g
                                    key={r.name}
                                    className={
                                        "compare-row"
                                        + (hot === r.name ? " is-on" : "")
                                        + (hot && hot !== r.name ? " is-dim" : "")
                                    }
                                    onMouseEnter={() => setHot(r.name)}
                                    onMouseLeave={() => setHot(null)}
                                >

                                    <rect
                                        x="0"
                                        y={y - ROW / 2}
                                        width="900"
                                        height={ROW}
                                        fill="transparent"
                                    />

                                    <text className="compare-lang" x="0" y={y - 2}>
                                        {r.name}
                                    </text>

                                    <text className="compare-family" x="0" y={y + 11}>
                                        {r.family}
                                    </text>

                                    <rect
                                        className="compare-bar"
                                        x={LEFT}
                                        y={y - h - 1}
                                        width={Math.max(x(r.a) - LEFT, 0)}
                                        height={h}
                                        fill={COLOUR_A}
                                    />

                                    <rect
                                        className="compare-bar"
                                        x={LEFT}
                                        y={y + 1}
                                        width={Math.max(x(r.b) - LEFT, 0)}
                                        height={h}
                                        fill={COLOUR_B}
                                    />

                                    <text
                                        className="compare-value"
                                        x={x(r.a) + 8}
                                        y={y - 3}
                                    >
                                        {current.format(r.a)}
                                    </text>

                                    <text
                                        className="compare-value"
                                        x={x(r.b) + 8}
                                        y={y + 11}
                                    >
                                        {current.format(r.b)}
                                    </text>

                                </g>
                            );
                        })}
                    </svg>

                </div>
                )}

                {/* What "better" means, before any number claims it. */}
                <p className="compare-meaning">
                    {current.goodMeans}
                    {" "}
                    Every percentage below compares <b>{tokenizerB}</b>{" "}
                    against <b>{tokenizerA}</b>.
                </p>

                {/* The headline numbers, under the chart they summarise. */}
                <div className="compare-verdict">

                    <div className="stat">
                        <span className="k">Ahead overall</span>
                        <span className="v v-name">
                            {unchanged ? "Neither" : winner}
                        </span>
                        <span className="n">
                            {unchanged
                                ? "the two sides give the same numbers"
                                : `wins on ${winnerWins} of `
                                    + `${southAfrican.length} SA languages`}
                        </span>
                    </div>

                    <div className="stat">
                        <span className="k">Typical difference</span>
                        <span
                            className={"v " + (unchanged
                                ? ""
                                : meanGain > 0 ? "up" : "down")}
                        >
                            {unchanged
                                ? "\u2014"
                                : `${Math.abs(meanGain) < 1
                                    ? Math.abs(meanGain).toFixed(1)
                                    : Math.round(Math.abs(meanGain))}% `
                                    + `${meanGain > 0
                                        ? current.betterWord
                                        : current.worseWord}`}
                        </span>
                        <span className="n">
                            {current.unit}, averaged over the{" "}
                            {southAfrican.length}
                        </span>
                    </div>

                    <div className="stat">
                        <span className="k">
                            Furthest apart
                            {!unchanged && widest
                                ? ` \u2013 ${widest.name}`
                                : ""}
                        </span>
                        <span
                            className={"v " + (unchanged || !widest
                                ? ""
                                : widest.gain > 0 ? "up" : "down")}
                        >
                            {unchanged || !widest
                                ? "\u2014"
                                : phraseOf(widest)}
                        </span>
                        <span className="n">
                            {unchanged || !widest
                                ? "nothing moved"
                                : `${current.format(widest.a)} \u2192 `
                                    + `${current.format(widest.b)} `
                                    + `${current.unit}`}
                        </span>
                    </div>

                    <div className="stat">
                        <span className="k">
                            Closest
                            {!unchanged && closest
                                ? ` \u2013 ${closest.name}`
                                : ""}
                        </span>
                        <span
                            className={"v " + (unchanged || !closest
                                ? ""
                                : closest.gain > 0 ? "up" : "down")}
                        >
                            {unchanged || !closest
                                ? "\u2014"
                                : phraseOf(closest)}
                        </span>
                        <span className="n">
                            {unchanged || !closest
                                ? "nothing moved"
                                : `${current.format(closest.a)} \u2192 `
                                    + `${current.format(closest.b)} `
                                    + `${current.unit}`}
                        </span>
                    </div>

                </div>

                {/* Written from the numbers, so it stays true for any pair. */}
                <p className="compare-note">
                    {unchanged
                        ? <>
                            <b>{tokenizerA}</b> and <b>{tokenizerB}</b> produce
                            the same numbers for every language, so there is
                            nothing to choose between them here.
                            {tokenizerA === tokenizerB
                                ? " Both pickers are set to the same tokenizer."
                                : " Check that both tokenizers actually loaded."}
                          </>
                        : <>
                            On average <b>{winner}</b> comes out{" "}
                            {Math.abs(meanGain) < 1
                                ? Math.abs(meanGain).toFixed(1)
                                : Math.round(Math.abs(meanGain))}%{" "}
                            {meanGain > 0
                                ? current.betterWord
                                : current.worseWord}{" "}
                            on {current.title.toLowerCase()}, and it is ahead
                            on {winnerWins} of the {southAfrican.length} South
                            African languages.
                            {" "}
                            {widest && (
                                <>
                                    The two are furthest apart on{" "}
                                    <b>{widest.name}</b> ({phraseOf(widest)}
                                    {" "}with <b>{tokenizerB}</b>) and closest
                                    on <b>{closest.name}</b> ({phraseOf(closest)}).
                                    That is a property of the language, not a
                                    contest between the languages - a wide gap
                                    only means the two tokenizers disagree most
                                    about how to split it.
                                </>
                            )}
                            {" "}
                            {measure === "token_premium"
                                && english
                                && english.gain < 0 && (
                                <>
                                    English got{" "}
                                    <b>
                                        {Math.abs(english.gain).toFixed(1)}%
                                        {" "}worse
                                    </b>
                                    {" "}at the same time, so part of any
                                    improvement against English is the baseline
                                    slipping rather than the language gaining.
                                </>
                            )}
                          </>}
                </p>

            </div>

            {loading && (
                <div className="charts-overlay">
                    <span className="spinner is-big"></span>
                    <span>Comparing {tokenizerA} and {tokenizerB}&hellip;</span>
                </div>
            )}

        </section>
    );
}

export default CompareCharts;