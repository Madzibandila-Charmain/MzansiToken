import { useState } from "react";


function LeaderboardTable({
    rows = [],
    isLoading = false,
    errorMessage = "",
    onRowClick,
    deletingRowId = null,
}) {
    const [sort, setSort] = useState({ keyToSort: "overall_score", direction: "desc" });

    const headers = [
        {
            id: 1,
            KEY: "name",
            LABEL: "Tokenizer",
        },
        {
            id: 2,
            KEY: "token_count",
            LABEL: "Token count",
        },
        {
            id: 3,
            KEY: "fertility",
            LABEL: "Fertility",
        },
        {
            id: 4,
            KEY: "compression",
            LABEL: "Compression",
        },
        {
            id: 5,
            KEY: "token_premium",
            LABEL: "Token Premium",
        },
        {
            id: 6,
            KEY: "f1",
            LABEL: "F1",
        },
        {
            id: 7,
            KEY: "precision",
            LABEL: "Precision",
        },
        {
            id: 8,
            KEY: "recall",
            LABEL: "Recall",
        },
        {
            id: 9,
            KEY: "overall_score",
            LABEL: "Overall",
        },
    ];

    /**
     * Function that will set the sort according to which header is clicked
     * @param {*} header 
     */
    function handleHeaderClick(header) {
        setSort({
            keyToSort: header.KEY,
            direction:
                // If the we clicked is the key thats being sorted
                header.KEY === sort.keyToSort ?
                    //Invert the direction
                    sort.direction === "asc" ?
                        "desc"
                    : "asc"
                //Else make it descending by default
                :"desc"

        })
    }

    /**
     * Function that will sort an array of the data according to the sort thats set
     * @param {*} arrayToSort 
     */
    function getSortedArray(arrayToSort) {
        return [...arrayToSort].sort((a, b) => {
            const aValue = a?.[sort.keyToSort];
            const bValue = b?.[sort.keyToSort];

            if (aValue == null && bValue == null) {
                return 0;
            }

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


    function formatCellValue(key, value) {
        if (value == null) {
            return "-";
        }

        if (typeof value !== "number") {
            return value;
        }

        if (key === "token_count") {
            return value.toLocaleString();
        }

        return value.toFixed(3);
    }


    if (isLoading) {
        return <p>Loading leaderboard...</p>;
    }


    if (errorMessage) {
        return <p>{errorMessage}</p>;
    }


    if (!rows.length) {
        return <p>No leaderboard data available yet.</p>;
    }


    return (
        <table className="rank-table">
            <thead>
                <tr>
                    {headers.map((header, index) => (
                        <th key={index} onClick={() => handleHeaderClick(header)}>
                            <span>{header.LABEL}</span>
                        </th>
                    ))}
                </tr>
            </thead>
            <tbody>
                    {getSortedArray(rows).map((row, index) => (
                        <tr
                            key={row.id ?? index}
                            className={onRowClick ? "rank-table-row is-clickable" : "rank-table-row"}
                            onClick={onRowClick ? () => onRowClick(row) : undefined}
                            title={onRowClick ? "Click to remove this tokenizer from the leaderboard" : undefined}
                            aria-busy={deletingRowId === row.id}
                        >
                            {headers.map((header, index) => {
                                return (
                                    <td key={index}>
                                        {deletingRowId === row.id && header.KEY === "name"
                                            ? "Removing..."
                                            : formatCellValue(header.KEY, row[header.KEY])}
                                    </td>
                                )
                            })}
                        </tr>
                    ))}
            </tbody>
        </table>
    );
}

export default LeaderboardTable;