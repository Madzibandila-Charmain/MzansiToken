/*
    corpusFormats.js
    Author: Mukovhe Ranwashe (RNWMUK001)

    One list of the file types we accept, and one function that checks a file
    against it. Both pages use them, so the rule lives in one place.

    This is a courtesy check, not a security one - it runs on the user's own
    machine. The server checks the extension AND the leading bytes again.
    Keep this list in step with corpus_extract.SUPPORTED_SUFFIXES.
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

/*
    Shortens a file name for the screen only - never for the upload itself.
    A 200-character name pushed the label across the heading and turned the
    status line into a paragraph, so the middle is dropped and both ends are
    kept: you can still see what it is and what type it is.
*/
export function shortFileName(name, max = 44) {

    const value = String(name || "");

    if (value.length <= max) {
        return value;
    }

    const head = Math.ceil((max - 1) / 2);
    const tail = Math.floor((max - 1) / 2);

    return `${value.slice(0, head)}\u2026${value.slice(value.length - tail)}`;
}

/* 5242880 -> "5 MB". */
export function formatBytes(bytes) {

    if (!bytes && bytes !== 0) {
        return "";
    }

    const mb = bytes / (1024 * 1024);

    return mb >= 1
        ? `${Math.round(mb)} MB`
        : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

/* Returns a message to show, or null if the file is fine. */
export function checkCorpusFile(file, limits) {

    if (!file) {
        return null;
    }

    if (!isAcceptedCorpusFile(file.name)) {
        return UNSUPPORTED_CORPUS_MESSAGE;
    }

    const cap = limits?.max_upload_bytes;

    if (cap && file.size > cap) {
        return `That file is ${formatBytes(file.size)}. `
            + `The biggest we can take is ${formatBytes(cap)}.`;
    }

    return null;
}
