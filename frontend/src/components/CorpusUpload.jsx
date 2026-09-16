/*
    Reusable corpus upload component
    Author: Madzibandila Charmain
*/

function CorpusUpload({
    inputId,
    fileInputRef,
    onFileChange,
    onDefault,
    showDefault,
    disabled
}) {
    return (
        <div className="upload-container">
            <input
                type="file"
                id={inputId}
                ref={fileInputRef}
                accept=".txt,text/plain"
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
                    Default
                </button>
            )}
        </div>
    );
}

export default CorpusUpload;