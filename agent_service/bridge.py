#!/usr/bin/env python3
"""
Python Agent Bridge for ColdChain-Twin Simulation Engine
========================================================
Consumes single telemetry step or batch via CLI argument or standard input,
runs ColdChainAuditorCrew, and prints JSON verdict.
"""

import sys
import json
import argparse
from auditor_crew import ColdChainAuditorCrew

def main():
    parser = argparse.ArgumentParser(description="ColdChain Telemetry Sentinel & Predictor Bridge")
    parser.add_argument("--data", type=str, help="JSON encoded telemetry point")
    args = parser.parse_args()

    input_text = ""
    if args.data:
        input_text = args.data
    else:
        # Read from stdin
        input_text = sys.stdin.read().strip()

    if not input_text:
        print(json.dumps({
            "error": "No input telemetry provided"
        }), file=sys.stderr)
        sys.exit(1)

    try:
        data = json.loads(input_text)
    except Exception as e:
        print(json.dumps({
            "error": f"Invalid JSON payload: {str(e)}"
        }), file=sys.stderr)
        sys.exit(1)

    crew = ColdChainAuditorCrew()
    
    # Check if single step or batch
    if isinstance(data, list):
        history = data[:-1]
        step = data[-1] if data else {}
        verdict = crew.audit_step(step, history)
    elif isinstance(data, dict):
        step = data.get("step", data)
        history = data.get("history", [])
        verdict = crew.audit_step(step, history)
    else:
        verdict = crew.audit_step({})

    print(json.dumps(verdict, indent=2))

if __name__ == "__main__":
    main()
