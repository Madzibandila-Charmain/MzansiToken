/*
    Reusable corpus upload component
    Author: Madzibandila Charmain

    Amended by Mukovhe Ranwashe (RNWMUK001): the accepted formats live in
    lib/corpusFormats.js so both pages read one list, and a rejected file
    says why right here instead of only in the page's error banner.
*/

import { ACCEPT_ATTRIBUTE } from "../lib/corpusFormats";
import { UploadIcon } from "./Icons";

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
                <UploadIcon />

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