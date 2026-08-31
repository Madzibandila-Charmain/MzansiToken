import { render, screen, fireEvent, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi, describe, it, expect } from "vitest";

import LeaderboardTable from "../LeaderboardTable";

describe("LeaderboardTable", () => {
	// Sample rows used across multiple tests
	const rows = [
		{
			id: "r1",
			name: "Tokenizer A",
			token_count: 12345,
			fertility: 1.2345,
			compression: 0.5,
			token_premium: 0.25,
			f1: 0.7777,
			precision: 0.6666,
			recall: 0.8888,
			overall_score: 0.91234,
		},
		{
			id: "r2",
			name: "Tokenizer B",
			token_count: 9876,
			fertility: null,
			compression: 0.75,
			token_premium: 0.125,
			f1: 0.5555,
			precision: 0.4444,
			recall: 0.3333,
			overall_score: 0.71234,
		},
	];

	it("shows loading text when `isLoading` is true", () => {
		// Render component with loading flag
		render(<LeaderboardTable isLoading={true} />);

		expect(screen.getByText("Loading leaderboard...")).toBeInTheDocument();
	});

	it("displays an error message when `errorMessage` is provided", () => {
		// Render component with an error message
		render(<LeaderboardTable errorMessage="Network error" />);

		expect(screen.getByText("Network error")).toBeInTheDocument();
	});

	it("shows empty state when no rows are provided", () => {
		// Render component with empty rows array
		render(<LeaderboardTable rows={[]} />);

		expect(screen.getByText("No leaderboard data available yet.")).toBeInTheDocument();
	});

	it("renders rows and formats numeric cells correctly", () => {
		// Render with sample rows and validate formatting rules
		render(<LeaderboardTable rows={rows} />);

		// There should be a table row for each data row (plus header row)
		const bodyRows = screen.getAllByRole("row");

		// Ensure both tokenizers are present by name
		expect(screen.getByText("Tokenizer A")).toBeInTheDocument();
		expect(screen.getByText("Tokenizer B")).toBeInTheDocument();

		// Token count should use locale formatting (accepts comma, space or NBSP)
		const tokenCountCells = screen.getAllByText(/12\D345/);
		expect(tokenCountCells.length).toBeGreaterThan(0);

		// Numeric non-token_count values should be formatted to 3 decimals
		expect(screen.getByText("0.912")).toBeInTheDocument();

		// Null fertility for Tokenizer B should render a dash
		expect(screen.getAllByText("-").length).toBeGreaterThan(0);
	});

	it("sorts rows when header is clicked and toggles direction", async () => {
		// Two rows with different overall_score values; initial sort is desc
		render(<LeaderboardTable rows={rows} />);

		// Initially the higher overall_score (Tokenizer A) should appear before Tokenizer B
		const firstDataRow = screen.getAllByRole("row")[1];
		expect(within(firstDataRow).getByText("Tokenizer A")).toBeInTheDocument();

		// Click the "Overall" header to toggle sort direction
		const overallHeader = screen.getByText("Overall");
		await userEvent.click(overallHeader);

		// After one click the direction should be asc, so Tokenizer B comes first
		const newFirstDataRow = screen.getAllByRole("row")[1];
		expect(within(newFirstDataRow).getByText("Tokenizer B")).toBeInTheDocument();
	});

	it("calls `onRowClick` when a row is clicked and applies clickable class", async () => {
		// Provide an onRowClick handler and ensure it's called with the row data
		const onRowClick = vi.fn();
		render(<LeaderboardTable rows={rows} onRowClick={onRowClick} />);

		const dataRows = screen.getAllByRole("row");
		const firstDataRow = dataRows[1];

		// Row should have clickable class
		expect(firstDataRow).toHaveClass("is-clickable");

		// Click the row
		await userEvent.click(firstDataRow);

		// Expect handler to have been called once with the first row object
		expect(onRowClick).toHaveBeenCalledTimes(1);
		expect(onRowClick).toHaveBeenCalledWith(rows[0]);
	});

	it("shows 'Removing...' and sets aria-busy when `deletingRowId` matches a row id", () => {
		// Render with deletingRowId set to the first row's id
		render(<LeaderboardTable rows={rows} deletingRowId={rows[0].id} />);

		// The first row's name cell should show 'Removing...'
		const firstDataRow = screen.getAllByRole("row")[1];
		expect(within(firstDataRow).getByText("Removing...")).toBeInTheDocument();

		// The row element should have aria-busy="true"
		expect(firstDataRow).toHaveAttribute("aria-busy", "true");
	});
});

