"""
NCHLT_dataset_service.py - Extracts list of surface data and gold segmentation data from the NCHLT dataset and converts it in a format that can be compared. 

Author: Ethan Ngwetjana
Student Number: NGWETH001

Usage:
    from app.services.NCHLT_dataset_service import load_nchlt_data

"""

# Maps filenames to language names
from pathlib import Path
import os


LANGUAGES = {
    "nbl": "isiNdebele",
    "nso": "Sepedi",
    "sot": "Sesotho",
    "ssw": "siSwati",
    "tsn": "Setswana",
    "tso": "Xitsonga",
    "ven": "Tshivenda",
    "xho": "isiXhosa",
    "zul": "isiZulu"
}

def load_nchlt_data(dir: str, lowercase=False, delimeter="_") -> dict[str, list[tuple[str, str]]]:
    """
    Load raw NCHLT files and convert to format that can be analysed

    Args:
        dir: directory that holds the data files for each language
        lowercase: bool that determines whether data is in lowercase form
        delimeter: set custom delimeter

    Return:
        dict with a list of (surface_word, hyphenated_gold) pairs mapped to each language.

    """

    # Convert string path to path object
    dir = Path(dir)

    # Check if path exists
    if not dir.exists():
        raise FileNotFoundError(
            f"Data directory '{dir} not found."
        )

    corpus = {}

    # Iterate through all supported languages
    for code, lang in LANGUAGES.items():

        # create the path for the language file
        path = Path(dir) / f"{code}.txt"

        # Skip this language if it does not exist
        if not path.exists(): continue

        # Open file in utf-8 format
        with open(path, encoding='utf-8', errors='replace') as file:
            # Iterate through each line in the file
            for line in file:
                line = line.strip() #remove whitespace

                # if line is null -> go to next
                if not line: continue

                # Split the line into two parts
                parts = line.split("\t", 1)

                # check if line is split into 2 parts
                if len(parts) < 2: continue

                surface, gold = parts[0].strip(), parts[1].strip()

                # Skip line if gold has a malformed segmentation
                if gold.startswith(delimeter) or gold.endswith(delimeter) or delimeter + delimeter in gold: continue

                # Skip line if surface has segmentation
                if delimeter in surface: continue

                # Convert to lowercase
                if lowercase:
                    surface = surface.lower()
                    gold = gold.lower()

                # append new item
                corpus.setdefault(lang, []).append((surface, gold))
    return corpus





