"""
MBI service - Morphological Binary Identification
Service that compares tokenization with gold morpheme segmentations according to the NCHLT dataset

Author: Ethan Ngwetjana
Student Number: NGWETH001

Usage:
    import app.services.morphology_service

"""

from dataclasses import dataclass


@dataclass
class BoundaryVector:
    """Binary vector of boundary decisions (len = n_letters - 1) for one word."""
    word: str
    boundaries: list[int] # 0->no boundary  1->boundary




def to_boundary_vector(surf_word: str, split_word: str, delimeter="_") -> BoundaryVector:
    """
        Converts tokenised/segmented words to boundary vector to make them directly compararible

        Args:
            surface_word: surface word before segmentation/tokenisation
            split_word: word after it has been tokenised/segmented
            Delimeter: what is used it indicate separation (default = '_')

        Return:
            A boundaryVector object which shows whether there is a boundary between two separations
    """

    # Initialise the vector 
    vector = [0] * (len(surf_word) - 1)

    # Initialise position of original word
    pos = 0

    i = 0

    # Iterate through each character in split_word
    while i < len(split_word):
        # If character is a delimeter
        if split_word[i] == delimeter:
            # set the vector to true in coresponding position
            vector[pos-1] = 1
            i += 1  #move to next character in spit word
        else:
            # normal character
            pos += 1 # move to next character
            i += 1

    return BoundaryVector(surf_word, vector)

    
        
