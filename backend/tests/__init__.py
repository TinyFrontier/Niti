"""Test package.

Importing `app.main` starts the match queue worker at module level, which is
right for the server and wrong here: inside a test run it would poll the
developer's database on its own thread and hand real tasks to the real provider.
This package is imported before conftest, so the switch is set while it still
has an effect.
"""

import os

os.environ.setdefault("MATCH_WORKER_ENABLED", "false")
