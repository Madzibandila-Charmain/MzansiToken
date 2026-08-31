import { useEffect, useState } from "react";
import {
    createOrUpdateLeaderboardEntry,
    getDefaultCorpus,
    getLeaderboard,
    getMBI,
    getOptions,
} from "../api/client";
import LeaderboardTable from "../components/LeaderboardTable";

function Rank() {
    const [rows, setRows] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [errorMessage, setErrorMessage] = useState("");
    const [selectionStatus, setSelectionStatus] = useState("");
    const [selectionLoading, setSelectionLoading] = useState(false);
    const [languages, setLanguages] = useState([]);
    const [tokenizers, setTokenizers] = useState([]);
    const [language, setLanguage] = useState("");
    const [tokenizer, setTokenizer] = useState("");

    async function loadLeaderboard(signal) {
        const data = await getLeaderboard(
            {
                sortBy: "overall_score",
                descending: true,
            },
            signal
        );

        setRows(Array.isArray(data) ? data : []);
    }

    useEffect(() => {
        const controller = new AbortController();

        async function initialiseRank() {
            setIsLoading(true);
            setErrorMessage("");

            try {
                const options = await getOptions(
                    controller.signal
                );

                setLanguages(options.languages || []);
                setTokenizers(options.tokenizers || []);

                setLanguage((currentLanguage) =>
                    currentLanguage || options.languages?.[0] || ""
                );

                setTokenizer((currentTokenizer) =>
                    currentTokenizer || options.tokenizers?.[0] || ""
                );

                await loadLeaderboard(controller.signal);
            } catch (error) {
                if (error.name !== "AbortError") {
                    setErrorMessage(error.message || "Failed to load leaderboard.");
                }
            } finally {
                setIsLoading(false);
            }
        }

        initialiseRank();

        return () => controller.abort();
    }, []);

    async function handleAddTokenizer() {
        if (!language || !tokenizer || selectionLoading) {
            return;
        }

        setSelectionLoading(true);
        setSelectionStatus("Adding tokenizer to leaderboard...");
        setErrorMessage("");

        try {
            const defaultCorpusResult = await getDefaultCorpus(
                language,
                tokenizer
            );

            const metrics = {
                token_count: defaultCorpusResult.metrics?.token_count ?? null,
                fertility: defaultCorpusResult.metrics?.fertility ?? null,
                compression: defaultCorpusResult.metrics?.compression ?? null,
                token_premium: defaultCorpusResult.metrics?.token_premium ?? null,
                overall_score: defaultCorpusResult.metrics?.overall_score ?? null,
                f1: null,
                precision: null,
                recall: null,
            };

            try {
                const mbiResult = await getMBI(tokenizer, language);

                metrics.f1 = mbiResult.metrics?.f1 ?? null;
                metrics.precision = mbiResult.metrics?.precision ?? null;
                metrics.recall = mbiResult.metrics?.recall ?? null;
            } catch (error) {
                if (!error.message?.includes("Unsupported language")) {
                    throw error;
                }
            }

            await createOrUpdateLeaderboardEntry(tokenizer, metrics);
            await loadLeaderboard();

            setSelectionStatus("Tokenizer added to leaderboard");
        } catch (error) {
            setErrorMessage(error.message || "Failed to add tokenizer.");
            setSelectionStatus("Could not add tokenizer");
        } finally {
            setSelectionLoading(false);
        }
    }

    return (
        <>
            <section className="inspect-intro">
                <p className="inspect-label">
                    RANK
                </p>

                <h1>
                    Build and Compare Your Leaderboard.
                </h1>

                <p className="inspect-description">
                    Choose a tokenizer and language, add it to the leaderboard,
                    and compare metrics side by side.
                </p>
            </section>

            <section className="inspect-controls">
                <div className="inspect-filters">
                    <div className="filter-group">
                        <label htmlFor="rank-tokenizer">
                            Tokenizer
                        </label>

                        <select
                            id="rank-tokenizer"
                            value={tokenizer}
                            onChange={(event) =>
                                setTokenizer(event.target.value)
                            }
                            disabled={selectionLoading || isLoading}
                        >

                            {tokenizers.map((item) => (

                                <option
                                    key={item}
                                    value={item}
                                >
                                    {item}
                                </option>

                            ))}

                        </select>
                    </div>

                    <div className="filter-group">
                        <label htmlFor="rank-language">
                            Language
                        </label>

                        <select
                            id="rank-language"
                            value={language}
                            onChange={(event) =>
                                setLanguage(event.target.value)
                            }
                            disabled={selectionLoading || isLoading}
                        >

                            {languages.map((item) => (

                                <option
                                    key={item}
                                    value={item}
                                >
                                    {item}
                                </option>

                            ))}

                        </select>
                    </div>
                </div>

                <button
                    type="button"
                    className="rank-add-button"
                    onClick={handleAddTokenizer}
                    disabled={
                        selectionLoading ||
                        isLoading ||
                        !tokenizer ||
                        !language
                    }
                >
                    {selectionLoading ? "Adding..." : "Add to leaderboard"}
                </button>

                {selectionStatus && (
                    <div
                        className={`selection-status ${
                            selectionLoading
                                ? "is-loading"
                                : errorMessage
                                    ? "is-error"
                                    : "is-ready"
                        }`}
                    >
                        <span className="status-dot"></span>
                        <span>{selectionStatus}</span>
                    </div>
                )}
            </section>

            <div className="rank-table-wrap">
                <LeaderboardTable
                    rows={rows}
                    isLoading={isLoading}
                    errorMessage={errorMessage}
                />
            </div>
        </>
    );
}

export default Rank;