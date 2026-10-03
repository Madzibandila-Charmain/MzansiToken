"""
flores.py - FLORES dataset loader for the TAD backend
TAD Capstone Project
 
Usage:
    from flores import load_flores, LANGUAGES
"""

from pathlib import Path

# Maps human-readable language names to their FLORES filename codes.
# Eight FLORES languages: seven South African ones plus English, which is here as the baseline every token premium is measured against, not as a
# language under study. South Africa has eleven official languages; Tshivenda and isiNdebele have no FLORES file, so they are out of scope.
LANGUAGES = {
    "English":   "eng_Latn",
    "Sepedi":    "nso_Latn",
    "Sesotho":   "sot_Latn",
    "siSwati":   "ssw_Latn",
    "Setswana":  "tsn_Latn",
    "Xitsonga":  "tso_Latn",
    "isiXhosa":  "xho_Latn",
    "isiZulu":   "zul_Latn",
}

def load_flores(data_dir: str) -> dict[str, list[str]]:
    """
    Load the FLORES dev set from a folder of .dev files.

    Args:
        data_dir: Path to the folder containing the .dev files
                  e.g. "Capstone/dev"

    Returns:
        dict mapping language name -> list of 997 sentences
        e.g. {"English": ["On Monday...", ...], "isiZulu": [...], ...}
    """
    # Convert the string path into a Path object for safer handling
    data_dir = Path(data_dir)

    # Check that the directory exists before proceeding
    if not data_dir.exists():
        print(f"FLORES data directory not found: {data_dir}")

        raise FileNotFoundError(
            "The FLORES dataset is not available on this server. "
            "Tokenization metrics cannot be computed right now."
        )

    corpus = {}  # Will hold language -> list of sentences

    # Iterate through all languages defined in LANGUAGES dict
    for language_name, file_code in LANGUAGES.items():
        # Build the full file path (e.g. "eng_Latn.dev")
        filepath = data_dir / f"{file_code}.dev"

        # Skip if the file doesn’t exist
        if not filepath.exists():
            print(f"Warning: {filepath} not found, skipping {language_name}")
            continue

        # Read the file line by line, stripping whitespace
        with open(filepath, encoding="utf-8") as f:
            sentences = []
            for line in f:
                stripped = line.strip()
                if stripped:  # Ignore blank lines
                    sentences.append(stripped)

        # Skip empty files to avoid divide-by-zero errors later
        if not sentences:
            print(f"Warning: {filepath} is empty, skipping {language_name}")
            continue

        # Add the list of sentences to the corpus
        corpus[language_name] = sentences

        # Print a quick sanity check (should be 997 sentences per FLORES file)
        print(f"Loaded {len(sentences)} sentences for {language_name}")

        # FLORES is supposed to be parallel text — sentence 42 should mean the same thing in every language.
        # If the files don’t all have the same length, that assumption breaks. In that case, any cross‑language comparison is wrong.
        lengths = {lang: len(sents) for lang, sents in corpus.items()}

        if len(set(lengths.values())) > 1:
            print(f"Warning: FLORES files are not parallel: {lengths}")
            print("Comparisons are only valid up to the shortest file.")

    return corpus
