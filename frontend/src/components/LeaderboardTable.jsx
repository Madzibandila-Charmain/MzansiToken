/*
    LeaderboardTable.jsx
    Author: Mukovhe Ranwashe
    September 2026

*/

import { useState } from "react";

import {
    COLUMNS,
    DEFAULT_HIDDEN_COLUMNS,
    UNSCORED_COLUMN_KEYS,
} from "../lib/leaderboardColumns";

/* The unscored columns came after the first entries were saved, so an
   older entry has a gap there until it is filled in. */

const NOT_YET_MEASURED =
    "Saved before this column existed. Remove it and add it again to " +
    "fill it in - the score stays the same.";

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

    if (key === "productivity" || key === "idiosyncrasy") {
        return value.toFixed(1);
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
    hiddenColumns,
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

    /*
        Which columns are on. Rank passes the list the user picked in its
        Columns panel; without one, the older showAllMetrics switch still
        works - everything, or everything but the three folded away.
    */
    const hidden = hiddenColumns ?? (
        showAllMetrics ? [] : DEFAULT_HIDDEN_COLUMNS
    );

    const columns = COLUMNS.filter(
        (column) => column.alwaysShown || !hidden.includes(column.key)
    );

    /* A sort on a column that has just been hidden would keep ordering the
       board by something no longer on screen, with no arrow to show it.
       It lapses instead, and the order goes back to the control above. */
    const activeSort =
        sort && columns.some((column) => column.key === sort.keyToSort)
            ? sort
            : null;

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

        if (!activeSort) {
            return arrayToSort;
        }

        return [...arrayToSort].sort((a, b) => {

            const aValue = a?.[activeSort.keyToSort];
            const bValue = b?.[activeSort.keyToSort];

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
                return activeSort.direction === "asc"
                    ? aValue - bValue
                    : bValue - aValue;
            }

            const result = String(aValue).localeCompare(String(bValue));

            return activeSort.direction === "asc"
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

    /* Past five numbers a row, the tighter spacing keeps it on screen. */
    const isWide = columns.filter(
        (column) => column.key !== "name"
    ).length > 5;

    return (
        <div className="rank-table-scroll">

            <table
                className={
                    isWide
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

                            const isSorted = activeSort?.keyToSort === column.key;

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
                                            ? activeSort.direction === "asc"
                                                ? "ascending"
                                                : "descending"
                                            : "none"
                                    }
                                    onClick={() => handleHeaderClick(column)}
                                >
                                    <span>{column.label}</span>

                                    <span className="rank-sort-arrow">
                                        {isSorted
                                            ? activeSort.direction === "asc"
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

                                    const notYetMeasured =
                                        UNSCORED_COLUMN_KEYS.includes(column.key) &&
                                        row[column.key] == null;

                                    return (
                                        <td
                                            key={column.key}
                                            className="is-centered"
                                            title={
                                                notYetMeasured
                                                    ? NOT_YET_MEASURED
                                                    : undefined
                                            }
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