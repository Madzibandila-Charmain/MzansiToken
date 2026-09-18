/*
    Reusable Type Anything component
    Author: Madzibandila Charmain

    Amended by Mukovhe Ranwashe (RNWMUK001), 17 September 2026: it used to
    take a renderTokens FUNCTION as a prop, because each page kept its own
    copy of that function. It renders the shared TokenStream instead, so the
    caller no longer has to supply behaviour along with data.
*/

import TokenStream from "./TokenStream";

function TypeAnything({
    inputText,
    onInputChange,
    results
}) {
    return (
        <section className="text-input-box">

            {/* Type Anything heading */}
            <div className="text-input-heading">
                Type Anything
            </div>

            {/* Text input */}
            <textarea
                className="text-input-area"
                value={inputText}
                onChange={(event) =>
                    onInputChange(event.target.value)
                }
                placeholder="Type or paste your text here..."
            />

            {/* Tokenizer results */}
            <div
                className={
                    results.length > 1
                        ? "compare-typed-results"
                        : ""
                }
            >

                {results.map((result, index) => (

                    <div
                        className={
                            results.length > 1
                                ? "compare-typed-result-panel"
                                : ""
                        }
                        key={result.id || index}
                    >

                        {/* Tokenizer name - Compare only */}
                        {result.title && (
                            <div className="compare-typed-result-heading">
                                {result.title}
                            </div>
                        )}

                        <div className="typed-tokenization-result">

                            {/* Tokenized text */}
                            <div className="typed-result-text">
                                <TokenStream tokens={result.tokens} />
                            </div>

                            {/* Metrics */}
                            <div className="typed-tokenization-metrics">

                                <div className="typed-metric-card">
                                    <span className="typed-metric-name">
                                        Tokens
                                    </span>

                                    <span className="typed-metric-value">
                                        {result.metrics?.tokens ?? 0}
                                    </span>
                                </div>

                                <div className="typed-metric-card">
                                    <span className="typed-metric-name">
                                        Fertility
                                    </span>

                                    <span className="typed-metric-value">
                                        {Number(
                                            result.metrics?.fertility ?? 0
                                        ).toFixed(2)}
                                    </span>
                                </div>

                                <div className="typed-metric-card">
                                    <span className="typed-metric-name">
                                        Compression
                                    </span>

                                    <span className="typed-metric-value">
                                        {Number(
                                            result.metrics?.compression ?? 0
                                        ).toFixed(2)}
                                    </span>
                                </div>

                            </div>

                        </div>

                    </div>

                ))}

            </div>

        </section>
    );
}

export default TypeAnything;