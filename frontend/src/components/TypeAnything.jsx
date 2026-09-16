/*
    Reusable Type Anything component
    Author: Madzibandila Charmain
*/

function TypeAnything({
    inputText,
    onInputChange,
    results,
    renderTokens
}) {
    return (
        <section className="text-input-box">

            {/* Type Anything heading */}
            <div className="text-input-heading">
                Mzansi Explorer • Type Anything
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
                                {renderTokens(result.tokens)}
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