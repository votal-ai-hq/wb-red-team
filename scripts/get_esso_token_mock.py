#!/usr/bin/env python3
"""Mock ESSO token generator for local testing (no ecams_auth needed)."""
import sys
import uuid

policy = sys.argv[1] if len(sys.argv) > 1 else "9245099016"
token = f"*MOCK_ESSO*{uuid.uuid4().hex}"
print(token, end="")
