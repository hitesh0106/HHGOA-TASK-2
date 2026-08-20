"""
Hacker House Goa 2026 — Task 2
Python Latency Benchmark Runner: python -m bench.latency --queries 300
"""

import sys
import os
import subprocess

def main():
    script_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    cmd = ["npx", "tsx", os.path.join(script_dir, "scripts", "bench_latency.ts")] + sys.argv[1:]
    
    try:
        # Run node/tsx benchmark runner
        proc = subprocess.run(cmd, cwd=script_dir, shell=True)
        sys.exit(proc.returncode)
    except Exception as e:
        print(f"Error running benchmark: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()
