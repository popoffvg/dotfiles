import json
from pathlib import Path
import subprocess
import tempfile
import unittest
from unittest.mock import patch

import cause_verdicts


class CauseRoutingTests(unittest.TestCase):
    def test_tier_wrapper_preserves_model_metrics_and_tool_limits(self):
        response = {
            "structured_output": {"verdict": "PASS"},
            "modelUsage": {"returned-model": {}},
            "num_turns": 2,
            "total_cost_usd": 0.1,
        }
        with tempfile.TemporaryDirectory() as root:
            for tier in ("light", "medium", "heavy"):
                with self.subTest(tier=tier), patch.object(cause_verdicts.subprocess, "run") as run:
                    run.return_value = subprocess.CompletedProcess([], 0, json.dumps(response), "")
                    output, metrics = cause_verdicts.claude(
                        "Check the cause.", tier, {}, ["Read"], 1, Path(root) / f"{tier}.log",
                    )
                    command = run.call_args.args[0]
                    self.assertEqual(command[:7], [
                        "python3", str(cause_verdicts.HOME / ".claude/harness/effort.py"),
                        "claude", tier, "--", "claude", "-p",
                    ])
                    self.assertNotIn("--model", command)
                    self.assertEqual(command[-2:], ["--allowedTools", "Read"])
                    self.assertEqual(run.call_args.kwargs["env"]["SELF_IMPROVE_CHILD"], "1")
                    self.assertEqual(output, {"verdict": "PASS"})
                    self.assertEqual(metrics["model"], "returned-model")
                    self.assertEqual(metrics["exit"], 0)

    def test_timeout_keeps_failure_status_without_a_model_guess(self):
        with tempfile.TemporaryDirectory() as root:
            with patch.object(cause_verdicts.subprocess, "run", side_effect=subprocess.TimeoutExpired("claude", 1)):
                output, metrics = cause_verdicts.claude(
                    "Check the cause.", "light", {}, None, 1, Path(root) / "timeout.log",
                )
        self.assertIsNone(output)
        self.assertIsNone(metrics["model"])
        self.assertEqual(metrics["exit"], -1)


if __name__ == "__main__":
    unittest.main()
