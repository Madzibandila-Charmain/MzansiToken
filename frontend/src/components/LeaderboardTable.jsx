/*
    LeaderboardTable.jsx
    Author: Mukovhe Ranwashe
    September 2026

*/

import { useState } from "react";

/*
    Every column in one place: the key it reads, how it is labelled, what
    the label means, and whether a bigger number is better. The header
    arrow and the default sort direction both come from `lowerIsBetter`, so
    the table cannot say one thing and sort the other way.
*/
const COLUMNS = [
    {
        key: "name",
        label: "Tokenizer",
        title: "The Hugging Face model id",
        align: "left",
        lowerIsBetter: true,
    },
    {
        key: "overall_score",
        label: "Score",
        title: "Out of 100, computed by the backend from the four measures",
        align: "right",
        lowerIsBetter: false,
    },
    {
        key: "token_count",
        label: "Tokens",
        title:
            "Total tokens spent on the South African languages in the " +
            "corpus. The raw bill, before any of it is averaged",
        align: "right",
        lowerIsBetter: true,
        extra: true,
    },
    {
        key: "compression",
        label: "Compression",
        title: "Bytes per token - how much text each token carries",
        align: "right",
        lowerIsBetter: false,
    },
    {
        key: "fertility",
        label: "Fertility",
        title: "Tokens per word, averaged over the languages measured",
        align: "right",
        lowerIsBetter: true,
    },
    {
        key: "token_premium",
        label: "Premium",
        title: "Tokens used against the same text in English. 1.0 is parity",
        align: "right",
        lowerIsBetter: true,
    },
    {
        key: "f1",
        label: "MBI F1",
        title: "How often the splits land on a real morpheme boundary",
        align: "right",
        lowerIsBetter: false,
    },
    {
        key: "precision",
        label: "Precision",
        title:
            "Of the boundaries this tokenizer predicted, how many were " +
            "real morpheme boundaries",
        align: "right",
        lowerIsBetter: false,
        extra: true,
    },
    {
        key: "recall",
        label: "Recall",
        title:
            "Of the real morpheme boundaries, how many this tokenizer " +
            "found",
        align: "right",
        lowerIsBetter: false,
        extra: true,
    },
];

function formatCell(key, value) {

    if (value == null) {
        return "—";
    }

    if (typeof value !== "number") {
        return value;
    }

    if (key === "token_count") {
        return value.toLocaleString();
    }

    if (key === "overall_score") {
        return value.toFixed(1);
    }

    if (key === "compression" || key === "token_premium") {
        return `${value.toFixed(2)}×`;
    }

    return value.toFixed(2);
}

function LeaderboardTable({
    rows = [],
    isLoading = false,
    errorMessage = "",
    onRemove,
    removingId = null,
    disabled = false,
    emptyBecauseFiltered = false,
    showAllMetrics = false,
    colourFor = () => "#007749",
    initialsFor = (name) => String(name).slice(0, 2).toUpperCase(),
    vendorFor = () => "",
}) {

    /*
        null means "however the page handed them to me". A header click sets
        it; clicking the same header a third time clears it, so the control
        above the board takes over again rather than being silently
        overridden forever.
    */
    const [sort, setSort] = useState(null);

    function handleHeaderClick(column) {

        setSort((current) => {

            if (!current || current.keyToSort !== column.key) {

                return {
                    keyToSort: column.key,
                    /* Open on the direction that puts "good" on top. */
                    direction: column.lowerIsBetter ? "asc" : "desc",
                };
            }

            const flipped = current.direction === "asc" ? "desc" : "asc";

            const opened = column.lowerIsBetter ? "asc" : "desc";

            /* Second click reverses it, third click hands control back. */
            return flipped === opened ? null : {
                keyToSort: column.key,
                direction: flipped,
            };
        });
    }

    function getSortedArray(arrayToSort) {

        if (!sort) {
            return arrayToSort;
        }

        return [...arrayToSort].sort((a, b) => {

            const aValue = a?.[sort.keyToSort];
            const bValue = b?.[sort.keyToSort];

            if (aValue == null && bValue == null) {
                return 0;
            }

            /* Nulls last whichever way the column is pointing. */
            if (aValue == null) {
                return 1;
            }

            if (bValue == null) {
                return -1;
            }

            if (typeof aValue === "number" && typeof bValue === "number") {
                return sort.direction === "asc"
                    ? aValue - bValue
                    : bValue - aValue;
            }

            const result = String(aValue).localeCompare(String(bValue));

            return sort.direction === "asc"
                ? result
                : -result;
        });
    }

    if (isLoading) {

        return (
            <div className="rank-state is-loading">
                <span className="spinner is-big"></span>
                Loading the leaderboard...
            </div>
        );
    }

    if (errorMessage) {

        /*
            Said already, under "rank by Overall score" in the
            controls bar above - not here where the board itself
            sits. Nothing to show in its place.
        */
        return null;
    }

    if (!rows.length) {

        return (
            <div className="rank-state is-empty">

                <p className="rank-empty-title">
                    {emptyBecauseFiltered
                        ? "Nothing matches that."
                        : "Nothing ranked yet."}
                </p>

                <p>
                    {emptyBecauseFiltered
                        ? "Clear the search to see the whole board again."
                        : "Add a tokenizer and it will be measured across " +
                          "the corpus and scored. Two or three is enough " +
                          "to see the pattern."}
                </p>

            </div>
        );
    }

    const sorted = getSortedArray(rows);

    /*
        Token count, precision and recall are every bit as sortable as the
        rest - they are just folded away by default, because nine numeric
        columns on one row is a table people scan past rather than read.
        The toggle above the board opens them.
    */
    const columns = showAllMetrics
        ? COLUMNS
        : COLUMNS.filter((column) => !column.extra);

    return (
        <div className="rank-table-scroll">

            <table
                className={
                    showAllMetrics
                        ? "rank-table is-wide"
                        : "rank-table"
                }
            >

                <thead>
                    <tr>

                        <th className="rank-position-head" scope="col">
                            #
                        </th>

                        {columns.map((column) => {

                            const isSorted = sort?.keyToSort === column.key;

                            return (
                                <th
                                    key={column.key}
                                    scope="col"
                                    title={column.title}
                                    className={[
                                        isSorted ? "is-sorted" : "",
                                        column.align === "left"
                                            ? "is-left"
                                            : "is-right",
                                    ].join(" ").trim()}
                                    aria-sort={
                                        isSorted
                                            ? sort.direction === "asc"
                                                ? "ascending"
                                                : "descending"
                                            : "none"
                                    }
                                    onClick={() => handleHeaderClick(column)}
                                >
                                    <span>{column.label}</span>

                                    <span className="rank-sort-arrow">
                                        {isSorted
                                            ? sort.direction === "asc"
                                                ? "↑"
                                                : "↓"
                                            : ""}
                                    </span>
                                </th>
                            );
                        })}

                        {onRemove && (
                            <th className="rank-remove-head" scope="col">
                                <span className="visually-hidden">
                                    Remove
                                </span>
                            </th>
                        )}

                    </tr>
                </thead>

                <tbody>

                    {sorted.map((row, index) => {

                        const isRemoving = removingId === row.id;

                        return (
                            <tr
                                key={row.id ?? index}
                                className={
                                    isRemoving
                                        ? "rank-table-row is-removing"
                                        : "rank-table-row"
                                }
                                aria-busy={isRemoving}
                            >

                                <td className="rank-position">
                                    {String(index + 1).padStart(2, "0")}
                                </td>

                                {columns.map((column) => {

                                    if (column.key === "name") {

                                        return (
                                            <td
                                                key={column.key}
                                                className="is-left"
                                            >
                                                <span className="rank-identity">

                                                    <span
                                                        className="rank-chip"
                                                        aria-hidden="true"
                                                        style={{
                                                            background:
                                                                colourFor(
                                                                    row.name
                                                                )
                                                        }}
                                                    >
                                                        {initialsFor(row.name)}
                                                    </span>

                                                    <span className="rank-identity-text">

                                                        <span className="rank-name">
                                                            {String(row.name)
                                                                .split("/")
                                                                .pop()}
                                                        </span>

                                                        <span className="rank-vendor">
                                                            {vendorFor(row.name)}
                                                            {" · "}
                                                            {row.name}
                                                        </span>

                                                    </span>

                                                </span>
                                            </td>
                                        );
                                    }

                                    if (column.key === "overall_score") {

                                        const score = row.overall_score;

                                        return (
                                            <td
                                                key={column.key}
                                                className="rank-score-cell"
                                            >
                                                <span className="rank-score">
                                                    {formatCell(
                                                        column.key,
                                                        score
                                                    )}
                                                </span>

                                                <span className="rank-score-track">
                                                    <span
                                                        className="rank-score-fill"
                                                        style={{
                                                            width: `${
                                                                Math.max(
                                                                    0,
                                                                    Math.min(
                                                                        100,
                                                                        score || 0
                                                                    )
                                                                )
                                                            }%`,
                                                            background:
                                                                colourFor(
                                                                    row.name
                                                                )
                                                        }}
                                                    ></span>
                                                </span>
                                            </td>
                                        );
                                    }

                                    return (
                                        <td 
                                            key={column.key}
                                            className="is-centered"
                                        >
                                            {formatCell(
                                                column.key,
                                                row[column.key]
                                            )}
                                        </td>
                                    );
                                })}

                                {onRemove && (

                                    <td className="rank-remove-cell">

                                        <button
                                            type="button"
                                            className="rank-remove"
                                            onClick={() => onRemove(row)}
                                            disabled={
                                                disabled ||
                                                removingId != null
                                            }
                                            title={
                                                `Remove ${row.name} from ` +
                                                "the leaderboard"
                                            }
                                            aria-label={
                                                `Remove ${row.name} from ` +
                                                "the leaderboard"
                                            }
                                        >
                                            {isRemoving ? "..." : "×"}
                                        </button>

                                    </td>

                                )}

                            </tr>
                        );
                    })}

                </tbody>

            </table>

        </div>
    );
}

export default LeaderboardTable;