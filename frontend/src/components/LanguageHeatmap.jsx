/*
    LanguageHeatmap.jsx
    Author: Mukovhe Ranwashe (RNWMUK001)

    Every tokenizer on the board against every language, one cell each.

    The board can only say a tokenizer averages 1.7x. It cannot say which
    language it is bad at, and that is the question the project exists to
    answer. One row per tokenizer, one column per language, and the answer
    is the shape of the grid.

    Colour is magnitude, so it is one ramp going light to dark - never a set
    of different colours, which would say "different kinds" instead of
    "more". Every cell also carries its number, so nobody has to read the
    colour to read the value.
*/

/* English is the yardstick every premium is measured against. */
const BASELINE = "English";

/*
    Six steps of one green, pale to deep, built out from the flag green the
    rest of the page uses. One hue and one direction: more colour means more
    tokens. The ink flips to white on the last step, and every pairing
    clears 4.5:1 against its own cell.

    Note the direction, because it is the opposite of the status lines: a
    DEEP cell is the bad one here. The key underneath says so in words -
    "same as English" on the pale end, "three times as many tokens" on the
    deep end - so nobody has to infer it from the colour.
*/
const RAMP = [
    { fill: "#e3faef", ink: "#132e22" },
    { fill: "#c6f2dc", ink: "#132e22" },
    { fill: "#9de3c1", ink: "#132e22" },
    { fill: "#73cba1", ink: "#132e22" },
    { fill: "#4aa77c", ink: "#132e22" },
    { fill: "#217650", ink: "#ffffff" }
];

/*
    The scale stops at 3.0, the same ceiling the breakdown bars use, so a
    colour here and a bar length there mean the same thing.
*/
const CEILING = 3.0;

function step(premium) {

    if (!Number.isFinite(premium)) {
        return null;
    }

    const position = (premium - 1) / (CEILING - 1);

    const index = Math.round(
        Math.min(1, Math.max(0, position)) * (RAMP.length - 1)
    );

    return RAMP[index];
}

function LanguageHeatmap({
    languages = [],
    rows = [],
    loadedCount = 0,
    total = 0
}) {

    /* Nothing measured yet - the board above already says so. */
    if (languages.length === 0 || rows.length === 0) {
        return null;
    }

    const stillReading = loadedCount < total;

    return (
        <section className="rank-matrix">

            <div className="rank-matrix-head">

                <span className="rank-matrix-title">
                    Every tokenizer, every language
                </span>

                <span className="rank-matrix-sub">
                    {stillReading
                        ? `Measuring ${loadedCount} of ${total}...`
                        : "Tokens spent per language, against English"}
                </span>

            </div>

            <div className="rank-matrix-scroll">

                <table className="rank-matrix-table">

                    <caption className="visually-hidden">
                        Token premium for each tokenizer in each language,
                        where 1.00 means the same number of tokens as
                        English and a higher number means more.
                    </caption>

                    <thead>
                        <tr>
                            <th scope="col" className="rank-matrix-corner">
                                Tokenizer
                            </th>

                            {languages.map((language) => (
                                <th
                                    key={language}
                                    scope="col"
                                    className={
                                        "rank-matrix-lang"
                                        + (language === BASELINE
                                            ? " is-baseline"
                                            : "")
                                    }
                                >
                                    {language}
                                </th>
                            ))}

                            <th scope="col" className="rank-matrix-mean-head">
                                SA mean
                            </th>
                        </tr>
                    </thead>

                    <tbody>
                        {rows.map((row) => (
                            <tr key={row.id || row.name}>

                                <th scope="row" className="rank-matrix-name">
                                    {row.name}
                                </th>

                                {languages.map((language) => {

                                    const value = row.cells?.[language];
                                    const shade = step(value);

                                    /* Still on its way, or it failed. */
                                    if (!shade) {
                                        return (
                                            <td
                                                key={language}
                                                className="rank-matrix-cell is-empty"
                                            >
                                                &middot;
                                            </td>
                                        );
                                    }

                                    return (
                                        <td
                                            key={language}
                                            className={
                                                "rank-matrix-cell"
                                                + (language === BASELINE
                                                    ? " is-baseline"
                                                    : "")
                                            }
                                            style={{
                                                background: shade.fill,
                                                color: shade.ink
                                            }}
                                            title={
                                                `${row.name} on ${language}: `
                                                + `${value.toFixed(2)} times `
                                                + "the tokens it spends on "
                                                + "the same text in English"
                                            }
                                        >
                                            {value.toFixed(2)}
                                        </td>
                                    );
                                })}

                                <td className="rank-matrix-mean">
                                    {Number.isFinite(row.mean)
                                        ? `${row.mean.toFixed(2)}×`
                                        : "·"}
                                </td>

                            </tr>
                        ))}
                    </tbody>

                </table>

            </div>

            <div className="rank-matrix-foot">

                <span className="rank-matrix-key-label">
                    Same as English
                </span>

                <span className="rank-matrix-key" aria-hidden="true">
                    {RAMP.map((shade) => (
                        <span
                            key={shade.fill}
                            className="rank-matrix-key-step"
                            style={{ background: shade.fill }}
                        ></span>
                    ))}
                </span>

                <span className="rank-matrix-key-label">
                    Three times as many tokens
                </span>

            </div>

        </section>
    );
}

export default LanguageHeatmap;
