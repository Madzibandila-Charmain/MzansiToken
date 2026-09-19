/*
    corpusFormats.js
    Author: Mukovhe Ranwashe (RNWMUK001)

    The accepted upload formats, in one place.

    This started out inside CorpusUpload.jsx, next to the accept attribute it
    configures. The linter was right to object: a file that exports both a
    component and plain constants breaks React fast refresh, so the constants
    moved here and the component imports them.

    Kept in step with corpus_extract.SUPPORTED_SUFFIXES on the backend.

    None of this is a security control. The accept attribute only filters the
    file picker, and this check runs on the user's own machine, so both are
    trivially bypassed by drag-and-drop or by a crafted request. The server
    re-checks the extension AND the leading bytes, because a filename is a
    claim by whoever is uploading. All this buys is a useful message before a
    pointless round trip.
*/

export const ACCEPTED_CORPUS_EXTENSIONS = [
    ".txt",
    ".text",
    ".md",
    ".csv",
    ".tsv",
    ".docx"
];

/* What the file picker filters on. */
export const ACCEPT_ATTRIBUTE = [
    ...ACCEPTED_CORPUS_EXTENSIONS,
    "text/plain",
    "text/markdown",
    "text/csv",
    "text/tab-separated-values",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
].join(",");

/* Shown when the picker is bypassed, so it has to read as a full sentence. */
export const UNSUPPORTED_CORPUS_MESSAGE =
    "Please select a "
    + ACCEPTED_CORPUS_EXTENSIONS.slice(0, -1).join(", ")
    + " or "
    + ACCEPTED_CORPUS_EXTENSIONS.slice(-1)
    + " file.";

export function isAcceptedCorpusFile(name) {
    if (!name) {
        return false;
    }

    const lowered = name.toLowerCase();

    return ACCEPTED_CORPUS_EXTENSIONS.some(
        (extension) => lowered.endsWith(extension)
    );
}
