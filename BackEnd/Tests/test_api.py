import sys
import os
import io
import pytest
from unittest.mock import patch, Mock
 
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
 
from fastapi.testclient import TestClient
import api