"""
test_corpus_extract.py - the guards on uploaded files.

Author: Mukovhe Ranwashe (RNWMUK001)

These tests are mostly about refusal rather than extraction. The reader itself
is a handful of lines; the value is in what it turns away, so each rejection
that matters has a test naming the attack it stands against.
"""

import io
import unicodedata
import zipfile

import pytest

from app.services.corpus_extract import (
    MAX_EXTRACTED_CHARS,
    CorpusExtractionError,
    extract_corpus_text,
    sanitise_filename,
)


# ── helpers ───────────────────────────────────────────────────────────────────

def make_docx(paragraphs, table=None) -> bytes:
    """A real Word document, built in memory."""
    import docx

    document = docx.Document()

    for paragraph in paragraphs:
        document.add_paragraph(paragraph)

    if table:
        built = document.add_table(rows=len(table), cols=len(table[0]))

        for row_index, row in enumerate(table):
            for cell_index, value in enumerate(row):
                built.cell(row_index, cell_index).text = value

    buffer = io.BytesIO()
    document.save(buffer)

    return buffer.getvalue()


def make_zip(entries) -> bytes:
    """A ZIP that is not necessarily a Word document."""
    buffer = io.BytesIO()

    with zipfile.ZipFile(buffer, "w", zipfile.ZIP_DEFLATED) as archive:
        for name, payload in entries:
            archive.writestr(name, payload)

    return buffer.getvalue()


def rejection(filename, data) -> CorpusExtractionError:
    """Run an extraction that is expected to fail and hand back the error."""
    with pytest.raises(CorpusExtractionError) as caught:
        extract_corpus_text(filename, data)

    return caught.value


# ── the formats we accept ─────────────────────────────────────────────────────

@pytest.mark.parametrize(
    "filename, payload, expected_format",
    [
        ("corpus.txt", b"sawubona umhlaba", "txt"),
        ("notes.md", b"# Heading\n\nbody", "md"),
        ("rows.csv", b"one,two\nsawubona,umhlaba", "csv"),
        ("rows.tsv", b"one\ttwo", "tsv"),
        ("plain.text", b"plain", "text"),
    ],
)
def test_plain_text_formats_are_read(filename, payload, expected_format):
    text, source_format = extract_corpus_text(filename, payload)

    assert text.strip()
    assert source_format == expected_format


def test_docx_paragraphs_are_read():
    data = make_docx(["Sawubona umhlaba", "Unjani namuhla"])

    text, source_format = extract_corpus_text("good.docx", data)

    assert "Sawubona umhlaba" in text
    assert "Unjani namuhla" in text
    assert source_format == "docx"


def test_docx_table_cells_are_read():
    # A corpus pasted into a table is still a corpus.
    data = make_docx(["intro"], table=[["cellone", "celltwo"]])

    text, _ = extract_corpus_text("table.docx", data)

    assert "cellone" in text
    assert "celltwo" in text


# ── text that would corrupt the metrics ───────────────────────────────────────

def test_diacritics_are_composed():
    """
    Compression is bytes per token, so the same visible letter stored
    decomposed rather than composed would change the measurement without
    changing anything a reader can see.
    """
    decomposed = "tone: e\u0301".encode()

    text, _ = extract_corpus_text("tone.txt", decomposed)

    assert text == unicodedata.normalize("NFC", text)
    assert "\u00e9" in text


def test_replacement_character_is_refused():
    # U+FFFD means characters were already lost upstream. Measuring what is
    # left would produce a number that looks fine and is wrong.
    error = rejection("lossy.txt", "clean \ufffd broken".encode())

    assert "could not be decoded" in error.message


def test_non_utf8_is_refused():
    error = rejection("binary.txt", b"\xff\xfe\x00bad")

    assert "UTF-8" in error.message


# ── the filename is a claim, not a fact ───────────────────────────────────────

@pytest.mark.parametrize(
    "filename, payload, phrase",
    [
        ("x.txt", b"%PDF-1.7\nstuff", "PDF"),
        ("x.docx", b"%PDF-1.7\nstuff", "PDF"),
        ("x.docx", b"\xd0\xcf\x11\xe0junk", "Legacy"),
        ("x.txt", b"{\\rtf1\\ansi", "RTF"),
    ],
)
def test_contents_must_agree_with_the_extension(filename, payload, phrase):
    error = rejection(filename, payload)

    assert phrase.lower() in error.message.lower()


def test_zip_renamed_to_txt_is_refused():
    error = rejection("x.txt", make_zip([("a.txt", b"hi")]))

    assert "ZIP archive" in error.message


@pytest.mark.parametrize("filename", ["x.pdf", "x.doc", "x.rtf", "x.exe", "README"])
def test_unsupported_extensions_never_reach_a_parser(filename):
    error = rejection(filename, b"anything at all")

    assert "Unsupported file type" in error.message


def test_zip_without_a_word_document_is_refused():
    error = rejection("fake.docx", make_zip([("hello.txt", b"not a word doc")]))

    assert "does not contain a Word document" in error.message


def test_corrupt_docx_is_refused():
    error = rejection("corrupt.docx", b"PK\x03\x04" + b"\x00" * 64)

    assert "corrupt" in error.message


# ── decompression bombs ───────────────────────────────────────────────────────
#
# The 5 MB upload cap counts bytes ARRIVING. A .docx is a ZIP, so it says
# nothing about what those bytes become once opened.

def test_docx_expanding_past_the_size_cap_is_refused():
    bomb = make_zip([("word/document.xml", b"\0" * (60 * 1024 * 1024))])

    error = rejection("bomb.docx", bomb)

    assert error.status_code == 413
    assert "expands to more than" in error.message


def test_docx_with_an_absurd_expansion_ratio_is_refused():
    # Under the absolute size cap, but 10 MB of zeroes compresses to almost
    # nothing, which is what a bomb looks like.
    bomb = make_zip([("word/document.xml", b"\0" * (10 * 1024 * 1024))])

    error = rejection("ratio.docx", bomb)

    assert error.status_code == 413
    assert "out of all proportion" in error.message


def test_docx_with_too_many_parts_is_refused():
    many = make_zip([(f"word/part{index}.xml", b"x") for index in range(600)])

    error = rejection("many.docx", many)

    assert "too many internal parts" in error.message


# ── size and emptiness ────────────────────────────────────────────────────────

def test_empty_upload_is_refused():
    assert "empty" in rejection("empty.txt", b"").message


def test_whitespace_only_upload_is_refused():
    assert "No readable text" in rejection("blank.txt", b"  \n\n \t ").message


def test_extracted_text_over_the_cap_is_refused():
    error = rejection("big.txt", b"a" * (MAX_EXTRACTED_CHARS + 1))

    assert error.status_code == 413


def test_extracted_text_exactly_at_the_cap_is_accepted():
    text, _ = extract_corpus_text("cap.txt", b"a" * MAX_EXTRACTED_CHARS)

    assert len(text) == MAX_EXTRACTED_CHARS


# ── the filename is echoed back into the UI ───────────────────────────────────

@pytest.mark.parametrize(
    "raw, expected",
    [
        ("../../../etc/passwd", "passwd"),
        ("C:\\Users\\muko\\corpus.txt", "corpus.txt"),
        ("line\nbreak.txt", "linebreak.txt"),
        ("", "uploaded file"),
        (None, "uploaded file"),
        ("   ", "uploaded file"),
    ],
)
def test_filenames_are_reduced_to_a_bare_name(raw, expected):
    assert sanitise_filename(raw) == expected


def test_long_filenames_are_truncated():
    assert len(sanitise_filename("z" * 400 + ".txt")) <= 124
