/*
    Icons.jsx
    Author: Mukovhe Ranwashe (RNWMUK001)

    The same search icon was pasted into Inspect once and Compare twice, and
    the upload icon sat inside CorpusUpload. Four copies of two drawings.
    They live here now, so changing an icon means changing one file.

    Every icon is decorative - the button next to it carries the label - so
    they are all aria-hidden.
*/

function Svg({ className, children }) {
    return (
        <svg
            className={className}
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            aria-hidden="true"
        >
            {children}
        </svg>
    );
}

/* Magnifying glass, used on every tokenizer search button. */
export function SearchIcon({ className = "search-button-icon" }) {
    return (
        <Svg className={className}>
            <circle
                cx="11"
                cy="11"
                r="7"
                stroke="currentColor"
                strokeWidth="2.5"
            />
            <path
                d="M16.5 16.5L21 21"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
            />
        </Svg>
    );
}

/* Arrow out of a tray, used on the corpus upload button. */
export function UploadIcon({ className = "upload-icon" }) {
    return (
        <Svg className={className}>
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
        </Svg>
    );
}
