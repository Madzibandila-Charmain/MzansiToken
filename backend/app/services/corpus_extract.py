"""
corpus_extract.py - turning an uploaded file into plain text, safely.

Author: Mukovhe Ranwashe (RNWMUK001)

The upload endpoint used to do this inline in three lines: check the name ends
in .txt, decode UTF-8, done. That was safe precisely because it never handed
attacker-controlled bytes to a parser. Accepting .docx gives that up, so every
guard we lose by parsing is put back here explicitly.

What this module promises the router:
    - the returned text is real text, NFC-normalised, and bounded in length
    - a file that is not what its name claims is rejected before it is parsed
    - nothing is ever written to disk, and no subprocess is ever started

Formats are declared in SUPPORTED_SUFFIXES. Anything absent is a deliberate
exclusion, and the reasons are worth keeping:

    .doc  - the legacy binary format needs antiword or headless LibreOffice,
            which means running an office suite on untrusted input. No.
    .rtf  - historically the most weaponised document format there is, and its
            parsers are fragile by inheritance. No.
    .odt  - same ZIP-of-XML shape as .docx, so it would add a second parser for
            almost no extra reach. Not worth the surface.
    .pdf  - deliberately deferred. A PDF has glyphs at coordinates, not words,
            so extraction invents the word boundaries that fertility and
            compression are measured against. Supporting it means gating on a
            real text layer and on clean diacritics first.
"""

import io
import unicodedata
import zipfile

# Re-exported: the upload cap and this one are shown to the user by /options,
# so they have a single definition that both the UI and the guards read.
from app.services.limits import MAX_EXTRACTED_CHARS


class CorpusExtractionError(Exception):
    """
    An upload that cannot become usable text.

    Carries its own status code so the router can map it straight to an
    HTTPException without a chain of isinstance checks. Services in this
    package do not import from fastapi, which is why this exists at all.
    """

    def __init__(self, message: str, status_code: int = 400):
        super().__init__(message)
        self.message = message
        self.status_code = status_code


# Formats that are already plain text and only need decoding.
PLAIN_TEXT_SUFFIXES = (".txt", ".text", ".md", ".csv", ".tsv")

DOCX_SUFFIX = ".docx"

SUPPORTED_SUFFIXES = PLAIN_TEXT_SUFFIXES + (DOCX_SUFFIX,)

# A .docx is a ZIP, so the 5 MB upload cap says nothing about what it expands
# to. These three numbers are the decompression-bomb guard.
MAX_DOCX_UNCOMPRESSED_BYTES = 50 * 1024 * 1024
MAX_DOCX_ENTRIES = 512
MAX_DOCX_EXPANSION_RATIO = 200

# Leading bytes are checked because the filename is supplied by whoever is
# uploading and is therefore a claim, not a fact.
ZIP_MAGIC = b"PK\x03\x04"
PDF_MAGIC = b"%PDF-"
OLE_MAGIC = b"\xd0\xcf\x11\xe0"  # legacy .doc and .xls
RTF_MAGIC = b"{\\rt"

MAX_FILENAME_CHARS = 120


def sanitise_filename(name: str | None) -> str:
    """
    Reduce an uploaded filename to something safe to echo back.

    The name is never used to open anything, so this is not a path-traversal
    guard - it is about what gets stored and rendered. It strips directory
    components, drops control characters, and truncates, so a 4 KB filename
    full of newlines cannot ride along in the response.
    """
    if not name:
        return "uploaded file"

    # Both separators, because a Windows client can send either.
    base = name.replace("\\", "/").rsplit("/", 1)[-1]

    cleaned = "".join(
        character
        for character in base
        if character.isprintable() and character not in {"\r", "\n", "\t"}
    ).strip()

    if not cleaned:
        return "uploaded file"

    if len(cleaned) > MAX_FILENAME_CHARS:
        cleaned = cleaned[:MAX_FILENAME_CHARS] + "..."

    return cleaned


def suffix_of(name: str | None) -> str:
    """The lowercased extension of a filename, including the dot."""
    if not name or "." not in name:
        return ""

    return "." + name.rsplit(".", 1)[-1].lower()


def _reject_known_binary(data: bytes) -> None:
    """
    Name the format when the leading bytes are one we deliberately exclude.

    A caller who uploads a PDF deserves 'PDF is not supported yet' rather than
    'that file must be UTF-8 encoded', which is true but useless.
    """
    if data.startswith(PDF_MAGIC):
        raise CorpusExtractionError(
            "PDF files are not supported yet. Export the text to .txt or .docx "
            "and upload that."
        )

    if data.startswith(OLE_MAGIC):
        raise CorpusExtractionError(
            "Legacy .doc files are not supported. Open it in Word and save it "
            "as .docx."
        )

    if data.startswith(RTF_MAGIC):
        raise CorpusExtractionError(
            "RTF files are not supported. Save the document as .txt or .docx."
        )


def _extract_plain_text(data: bytes) -> str:
    """Decode a file that is already text."""
    _reject_known_binary(data)

    if data.startswith(ZIP_MAGIC):
        raise CorpusExtractionError(
            "That file is a ZIP archive, not plain text. If it is a Word "
            "document, rename it to .docx and upload it again."
        )

    try:
        return data.decode("utf-8")
    except UnicodeDecodeError:
        raise CorpusExtractionError(
            "The uploaded file must be UTF-8 encoded."
        )


def _guard_zip_bomb(archive: zipfile.ZipFile) -> None:
    """
    Refuse an archive that expands out of proportion to what arrived.

    Sizes come from the ZIP's own central directory, so they are the
    uploader's claims too - but a bomb has to declare its expanded size to
    decompress at all, which is what makes checking them worthwhile. The
    extracted text is capped separately, so a liar is caught there.
    """
    entries = archive.infolist()

    if len(entries) > MAX_DOCX_ENTRIES:
        raise CorpusExtractionError(
            "That .docx contains too many internal parts to be a normal "
            "document."
        )

    uncompressed = sum(entry.file_size for entry in entries)

    if uncompressed > MAX_DOCX_UNCOMPRESSED_BYTES:
        raise CorpusExtractionError(
            "That .docx expands to more than "
            f"{MAX_DOCX_UNCOMPRESSED_BYTES // (1024 * 1024)} MB once opened.",
            status_code=413,
        )

    compressed = sum(entry.compress_size for entry in entries)

    if compressed > 0 and uncompressed / compressed > MAX_DOCX_EXPANSION_RATIO:
        raise CorpusExtractionError(
            "That .docx expands out of all proportion to its size, which is "
            "the signature of a decompression bomb.",
            status_code=413,
        )


def _extract_docx(data: bytes) -> str:
    """
    Pull the visible text out of a Word document, in memory.

    Paragraphs and table cells both count - a corpus pasted into a table is
    still a corpus. Nothing is extracted to disk, so ZIP path traversal is not
    reachable from here.
    """
    if not data.startswith(ZIP_MAGIC):
        _reject_known_binary(data)

        raise CorpusExtractionError(
            "That file is named .docx but is not a Word document."
        )

    try:
        archive = zipfile.ZipFile(io.BytesIO(data))
    except zipfile.BadZipFile:
        raise CorpusExtractionError(
            "That .docx file is corrupt and could not be opened."
        )

    with archive:
        _guard_zip_bomb(archive)

        # A Word document always carries this part. Checking for it means a
        # renamed .xlsx or .zip is turned away before python-docx sees it.
        if "word/document.xml" not in archive.namelist():
            raise CorpusExtractionError(
                "That .docx does not contain a Word document."
            )

    try:
        import docx
    except ImportError:
        raise CorpusExtractionError(
            "Word document support is not installed on the server.",
            status_code=503,
        )

    try:
        document = docx.Document(io.BytesIO(data))
    except Exception:
        # python-docx raises a variety of types on malformed input, and the
        # specific one is of no use to whoever is uploading.
        raise CorpusExtractionError(
            "That .docx file could not be read."
        )

    lines = [paragraph.text for paragraph in document.paragraphs]

    for table in document.tables:
        for row in table.rows:
            for cell in row.cells:
                lines.append(cell.text)

    return "\n".join(lines)


def extract_corpus_text(filename: str | None, data: bytes) -> tuple[str, str]:
    """
    Turn uploaded bytes into text, or explain why they cannot be.

    Returns the text alongside the format it came from, so the caller can say
    so in the response without re-deriving it from the name.

    Raises CorpusExtractionError, which carries the status code to answer with.
    """
    suffix = suffix_of(filename)

    if suffix not in SUPPORTED_SUFFIXES:
        supported = ", ".join(SUPPORTED_SUFFIXES)

        raise CorpusExtractionError(
            f"Unsupported file type. Supported formats are: {supported}."
        )

    if not data:
        raise CorpusExtractionError("The uploaded file is empty.")

    if suffix == DOCX_SUFFIX:
        text = _extract_docx(data)
        source_format = "docx"
    else:
        text = _extract_plain_text(data)
        source_format = suffix.lstrip(".")

    # African-language diacritics are the reason this is not optional.
    # Compression is bytes per token, so the same visible letter stored
    # decomposed rather than composed changes the measurement without
    # changing what anyone can see.
    text = unicodedata.normalize("NFC", text)

    if "�" in text:
        raise CorpusExtractionError(
            "The text in that file could not be decoded cleanly. Some "
            "characters were lost, so the metrics would be wrong."
        )

    if not text.strip():
        raise CorpusExtractionError(
            "No readable text was found in that file."
        )

    if len(text) > MAX_EXTRACTED_CHARS:
        raise CorpusExtractionError(
            f"That file holds {len(text):,} characters of text. The limit is "
            f"{MAX_EXTRACTED_CHARS:,}.",
            status_code=413,
        )

    return text, source_format
