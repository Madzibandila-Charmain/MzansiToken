/*
    Reusable corpus upload component
    Author: Madzibandila Charmain

    Amended by Mukovhe Ranwashe (RNWMUK001): the accepted formats moved to
    lib/corpusFormats.js, so both pages read the same list instead of each
    keeping its own copy of the rule. Compare had no check at all and leaned
    entirely on the backend for it.
*/

import { ACCEPT_ATTRIBUTE } from "../lib/corpusFormats";

function CorpusUpload({
    inputId,
    fileInputRef,
    onFileChange,
    onDefault,
    showDefault,
    disabled,
    loading = false
}) {
    return (
        <div className="upload-container">
            <input
                type="file"
                id={inputId}
                ref={fileInputRef}
                accept={ACCEPT_ATTRIBUTE}
                onChange={onFileChange}
                disabled={disabled}
            />

            <label
                htmlFor={inputId}
                className="upload-button"
            >
                <svg
                    className="upload-icon"
                    viewBox="0 0 24 24"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                    aria-hidden="true"
                >
                    <path
                        d="M12 16V4"
                        stroke="currentColor"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                    />

                    <path
                        d="M7 9L12 4L17 9"
                        stroke="currentColor"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    />

                    <path
                        d="M5 20H19"
                        stroke="currentColor"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                    />
                </svg>

                <span>Upload corpus</span>
            </label>

            {showDefault && (
                <button
                    type="button"
                    className="default-button"
                    onClick={onDefault}
                    disabled={disabled}
                >
                    {loading && <span className="spinner upload-spinner"></span>}
                    <span>{loading ? "Loading..." : "Default"}</span>
                </button>
            )}
        </div>
    );
}

export default CorpusUpload;