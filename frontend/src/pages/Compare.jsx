/*
    Compare Page
    Author: Madzibandila Charmain
    Date: 21 August 2026
*/

import { useState } from "react";
import "./Compare.css";

function Compare() {
    const [showCustomize, setShowCustomize] = useState(false);

    const [language, setLanguage] = useState("isiZulu");

    const [metrics, setMetrics] = useState([
        "Token Count",
        "Unknown Tokens",
    ]);

    const languages = [
        "isiZulu",
        "isiXhosa",
        "Setswana",
        "Sepedi",
        "Sesotho",
        "siSwati",
        "Tsonga",
        "English",
    ];

    const availableMetrics = [
        "Token Count",
        "Unknown Tokens",
        "Compression Ratio",
        "Character Coverage",
        "Average Token Length",
    ];

    const handleMetricChange = (metric) => {
        setMetrics((currentMetrics) => {
            if (currentMetrics.includes(metric)) {
                return currentMetrics.filter((item) => item !== metric);
            }

            return [...currentMetrics, metric];
        });
    };

    return (
        <div className="compare-page">

            <div className="compare-header">

                <p className="compare-eyebrow">
                    tokenizer face-off · see what changes
                </p>

                <h1>COMPARE</h1>

                <div className="compare-bottom-row">

                    <p className="compare-subtitle">
                        Put two tokenizers through the same test.
                        <br />
                        See exactly where they differ.
                    </p>

                    <button
                        className="customize-button"
                        onClick={() => setShowCustomize(!showCustomize)}
                    >
                        {showCustomize ? "Close" : "Customize"}
                    </button>

                </div>

            </div>

            {showCustomize && (
                <div className="customize-panel">

                    <div className="customize-section">

                        <h2>Corpus language</h2>

                        <div className="round-options">
                            {languages.map((item) => (
                                <button
                                    key={item}
                                    className={`round-option ${
                                        language === item ? "selected" : ""
                                    }`}
                                    onClick={() => setLanguage(item)}
                                >
                                    {item}
                                </button>
                            ))}
                        </div>

                    </div>

                    <div className="customize-section">

                        <h2>Metrics to compare</h2>

                        <div className="round-options">
                            {availableMetrics.map((metric) => (
                                <button
                                    key={metric}
                                    className={`round-option ${
                                        metrics.includes(metric)
                                            ? "selected"
                                            : ""
                                    }`}
                                    onClick={() =>
                                        handleMetricChange(metric)
                                    }
                                >
                                    {metric}
                                </button>
                            ))}
                        </div>

                    </div>

                    <div className="selection-summary">

                        <span>{language}</span>

                        <span>
                            {metrics.length} metrics selected
                        </span>

                    </div>

                </div>
            )}

        </div>
    );
}

export default Compare;