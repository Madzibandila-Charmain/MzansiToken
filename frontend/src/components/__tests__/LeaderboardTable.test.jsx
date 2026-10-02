/*
    LeaderboardTable.test.jsx
    Author: Mukovhe Ranwashe
*/

import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi, describe, it, expect } from "vitest";

import LeaderboardTable from "../LeaderboardTable";

/*
    Handed to the component out of score order on purpose, so a sorting
    assertion can tell the difference between "sorted" and "however the
    page happened to pass them in".
*/
function makeRows() {

    return [
        {
            id: "r2",
            name: "google/byt5-small",
            overall_score: 71.234,
            token_count: 9876,
            compression: 0.75,
            fertility: null,
            token_premium: 1.125,
            f1: 0.5555,
            precision: 0.4444,
            recall: 0.3333,
        },
        {
            id: "r1",
            name: "openai/gpt-4o",
            overall_score: 91.234,
            token_count: 12345,
            compression: 0.5,
            fertility: 1.2345,
            token_premium: 1.25,
            f1: 0.7777,
            precision: 0.6666,
            recall: 0.8888,
        },
    ];
}

/* The data rows, with the header row dropped. */
function dataRows() {
    return screen.getAllByRole("row").slice(1);
}

describe("LeaderboardTable", () => {

    it("shows the loading state in place of the table", () => {

        render(<LeaderboardTable isLoading />);

        expect(
            screen.getByText(/loading the leaderboard/i)
        ).toBeInTheDocument();

        expect(screen.queryByRole("table")).not.toBeInTheDocument();
    });

    it("renders nothing of its own on an error - Rank shows that above the board", () => {

        /*
            Rank.jsx already puts errorMessage in a StatusLine above
            this table (same bar as "rank by Overall score"), with a
            comment there making the same call this component's own
            comment does: the error belongs up there, not down here
            where the board would otherwise be. Rendering it again in
            here would just double it up on the real page.
        */
        const { container } = render(<LeaderboardTable errorMessage="Network error" />);

        expect(container).toBeEmptyDOMElement();

        expect(screen.queryByRole("table")).not.toBeInTheDocument();
    });

    it("tells an empty board apart from one hidden by the filter", () => {

        const { unmount } = render(<LeaderboardTable rows={[]} />);

        expect(screen.getByText("Nothing ranked yet.")).toBeInTheDocument();

        unmount();

        render(<LeaderboardTable rows={[]} emptyBecauseFiltered />);

        expect(screen.getByText("Nothing matches that.")).toBeInTheDocument();
    });

    it("formats each cell the way its column calls for", () => {

        render(<LeaderboardTable rows={makeRows()} showAllMetrics />);

        /* Score: one decimal, out of 100, no unit. */
        expect(screen.getByText("91.2")).toBeInTheDocument();

        /*
            Token count is grouped by locale, so the separator may be a
            comma, a space or a non-breaking space depending on where the
            suite runs. Match the digits, not the separator.
        */
        expect(screen.getByText(/12\D?345/)).toBeInTheDocument();

        /* Compression and premium are ratios and carry a times sign. */
        expect(screen.getByText("0.50×")).toBeInTheDocument();
        expect(screen.getByText("1.25×")).toBeInTheDocument();

        /* Everything else numeric: two decimals, bare. */
        expect(screen.getByText("0.78")).toBeInTheDocument();

        /* A value that could not be measured is an em dash. */
        expect(screen.getAllByText("—").length).toBeGreaterThan(0);
    });

    it("folds the extra columns away until they are asked for", () => {

        const { unmount } = render(<LeaderboardTable rows={makeRows()} />);

        expect(
            screen.queryByRole("columnheader", { name: /tokens/i })
        ).not.toBeInTheDocument();

        expect(
            screen.queryByRole("columnheader", { name: /precision/i })
        ).not.toBeInTheDocument();

        unmount();

        render(<LeaderboardTable rows={makeRows()} showAllMetrics />);

        expect(
            screen.getByRole("columnheader", { name: /tokens/i })
        ).toBeInTheDocument();

        expect(
            screen.getByRole("columnheader", { name: /precision/i })
        ).toBeInTheDocument();
    });

    it("numbers the rows in the order they are displayed", () => {

        render(<LeaderboardTable rows={makeRows()} />);

        expect(within(dataRows()[0]).getByText("01")).toBeInTheDocument();
        expect(within(dataRows()[1]).getByText("02")).toBeInTheDocument();
    });

    it("sorts on a header click, reverses, then hands control back", async () => {

        const user = userEvent.setup();

        render(<LeaderboardTable rows={makeRows()} />);

        /* Untouched, the board is in the order it was handed in. */
        expect(
            within(dataRows()[0]).getByText("byt5-small")
        ).toBeInTheDocument();

        const scoreHeader = screen.getByRole(
            "columnheader",
            { name: /score/i }
        );

        /* Higher is better for Score, so it opens descending. */
        await user.click(scoreHeader);

        expect(scoreHeader).toHaveAttribute("aria-sort", "descending");

        expect(
            within(dataRows()[0]).getByText("gpt-4o")
        ).toBeInTheDocument();

        /* The second click reverses the direction. */
        await user.click(scoreHeader);

        expect(scoreHeader).toHaveAttribute("aria-sort", "ascending");

        expect(
            within(dataRows()[0]).getByText("byt5-small")
        ).toBeInTheDocument();

        /*
            The third clears the sort rather than cycling forever, so the
            control above the board takes over again.
        */
        await user.click(scoreHeader);

        expect(scoreHeader).toHaveAttribute("aria-sort", "none");
    });

    it("sorts missing values to the bottom whichever way it points", async () => {

        const user = userEvent.setup();

        render(<LeaderboardTable rows={makeRows()} showAllMetrics />);

        const fertilityHeader = screen.getByRole(
            "columnheader",
            { name: /fertility/i }
        );

        /* byt5-small has no fertility, so it goes last either way. */
        await user.click(fertilityHeader);

        expect(
            within(dataRows()[1]).getByText("byt5-small")
        ).toBeInTheDocument();

        await user.click(fertilityHeader);

        expect(
            within(dataRows()[1]).getByText("byt5-small")
        ).toBeInTheDocument();
    });

    it("offers no remove control when there is no handler for it", () => {

        render(<LeaderboardTable rows={makeRows()} />);

        expect(screen.queryByRole("button")).not.toBeInTheDocument();
    });

    it("reports which row the remove button belonged to", async () => {

        const user = userEvent.setup();
        const onRemove = vi.fn();
        const rows = makeRows();

        render(<LeaderboardTable rows={rows} onRemove={onRemove} />);

        await user.click(
            screen.getByRole("button", {
                name: /remove google\/byt5-small/i,
            })
        );

        expect(onRemove).toHaveBeenCalledTimes(1);
        expect(onRemove).toHaveBeenCalledWith(rows[0]);
    });

    it("marks the row busy and locks the buttons while one is removing", () => {

        render(
            <LeaderboardTable
                rows={makeRows()}
                onRemove={() => {}}
                removingId="r2"
            />
        );

        expect(dataRows()[0]).toHaveAttribute("aria-busy", "true");
        expect(dataRows()[1]).toHaveAttribute("aria-busy", "false");

        /* No second removal can start while the first is in flight. */
        for (const button of screen.getAllByRole("button")) {
            expect(button).toBeDisabled();
        }
    }); 
});
