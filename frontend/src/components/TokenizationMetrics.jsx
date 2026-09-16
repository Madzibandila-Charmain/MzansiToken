/*
    Reusable tokenization and metrics display
    Author: Madzibandila Charmain
*/

function TokenizationMetrics({
    title,
    tokens,
    metrics,
    mbi,
    showMbi,
    renderTokens,
    tokenizerSelector,
    tokenizerType
}) {

    return (
        <div className="tokenization-display-block">

            {/* Tokenizer heading */}
            <div
                className={`tokenization-display-heading ${
                    tokenizerType === "1"
                        ? "tokenizer-one-heading"
                        : "tokenizer-two-heading"
                }`}
            >
                <span className="tokenizer-colour-dot"></span>
                <span>{title}</span>
            </div>

            {/* Optional tokenizer selector */}

            {tokenizerSelector}

            {/* Tokenization result */}

            <div className="tokenization-result">

                <div className="tokenization-text">

                    {renderTokens(tokens)}

                </div>

            </div>

            {/* Tokenization metrics */}

            <div className="tokenization-metrics">

                {/* Row 1 - Corpus metrics */}

                <div className="metric-row">

                    <div className="metric-card">

                        <span className="metric-name">
                            Tokens
                        </span>

                        <span className="metric-value">
                            {Number(
                                metrics?.tokens ?? 0
                            ).toLocaleString()}
                        </span>

                    </div>

                    <div className="metric-card">

                        <span className="metric-name">
                            Fertility
                        </span>

                        <span className="metric-value">

                            {Number(
                                metrics?.fertility ?? 0
                            ).toFixed(2)}

                        </span>

                    </div>

                    <div className="metric-card">

                        <span className="metric-name">
                            Compression
                        </span>

                        <span className="metric-value">

                            {Number(
                                metrics?.compression ?? 0
                            ).toFixed(2)}

                        </span>

                    </div>

                    <div className="metric-card">

                        <span className="metric-name">
                            Token Premium
                        </span>

                        <span className="metric-value">

                            {metrics?.token_premium === null ||
                            metrics?.token_premium === undefined
                                ? "N/A"
                                : Number(
                                    metrics.token_premium
                                ).toFixed(2)
                            }

                        </span>

                    </div>

                </div>

                {/* Row 2 - MBI metrics */}

                {showMbi && (

                    <div className="metric-row metric-row-centered">

                        <div className="metric-card">

                            <span className="metric-name">
                                Precision
                            </span>

                            <span className="metric-value">

                                {mbi === null ||
                                mbi === undefined
                                    ? "N/A"
                                    : Number(
                                        mbi.precision ?? 0
                                    ).toFixed(2)
                                }

                            </span>

                        </div>

                        <div className="metric-card">

                            <span className="metric-name">
                                F1
                            </span>

                            <span className="metric-value">

                                {mbi === null ||
                                mbi === undefined
                                    ? "N/A"
                                    : Number(
                                        mbi.f1 ?? 0
                                    ).toFixed(2)
                                }

                            </span>

                        </div>

                        <div className="metric-card">

                            <span className="metric-name">
                                Recall
                            </span>

                            <span className="metric-value">

                                {mbi === null ||
                                mbi === undefined
                                    ? "N/A"
                                    : Number(
                                        mbi.recall ?? 0
                                    ).toFixed(2)
                                }

                            </span>

                        </div>

                    </div>

                )}

            </div>

        </div>
    );
}

export default TokenizationMetrics;