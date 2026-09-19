/*
    StatusMessage.jsx
    Author: Mukovhe Ranwashe (RNWMUK001)

    Renders a status sentence, turning any address in it into a link.
*/

import { statusParts, modelPageUrl } from "../lib/statusText";

/*
    text      - whatever the backend said, or our own ready/loading line
    failed    - drives the fallback link; the colour is the caller's job,
                since the surrounding class differs per page
    modelName - the tokenizer the user typed, for the fallback link
*/
function StatusMessage({ text, failed = false, modelName = "" }) {

    const parts = statusParts(text);

    const hasLink = parts.some(
        (part) => typeof part !== "string"
    );

    const fallback = hasLink
        ? ""
        : modelPageUrl(modelName, text);

    return (
        <span className="status-text">

            {parts.map((part, index) => (

                typeof part === "string"
                    ? (
                        <span key={index}>
                            {part}
                        </span>
                    )
                    : (
                        <a
                            key={index}
                            className="status-link"
                            href={part.url}
                            target="_blank"
                            rel="noreferrer"
                        >
                            {part.url.replace(/^https?:\/\//, "")}
                        </a>
                    )

            ))}

            {failed && fallback && (
                <>
                    {" "}
                    <a
                        className="status-link"
                        href={fallback}
                        target="_blank"
                        rel="noreferrer"
                    >
                        Open it on Hugging Face
                    </a>
                </>
            )}

        </span>
    );
}

export default StatusMessage;