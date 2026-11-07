#!/usr/bin/env python3
"""
Threaded HTTP server for Playwright browser tests.

The standard `python3 -m http.server` uses a single-threaded
BaseHTTPServer which serialises all requests. When Playwright opens
multiple browser contexts and loads ~50 ES modules concurrently, the
single thread becomes a bottleneck and tests time out waiting for the
initial page load.

This script replaces it with a ThreadingHTTPServer (available since
Python 3.7) that handles each connection in its own thread, keeping
response latency low under concurrent module fetches.

Usage (matches the old command shape):
    python3 scripts/serve-threaded.py 4173 --bind 127.0.0.1 --directory .
"""
import sys
import os
import argparse
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler

parser = argparse.ArgumentParser()
parser.add_argument('port', type=int, default=4173, nargs='?')
parser.add_argument('--bind', default='127.0.0.1')
parser.add_argument('--directory', default='.')
args = parser.parse_args()

os.chdir(args.directory)


class Handler(SimpleHTTPRequestHandler):
    # Suppress per-request access logs to keep Playwright output readable.
    def log_message(self, fmt, *a):
        pass


with ThreadingHTTPServer((args.bind, args.port), Handler) as httpd:
    print(f'Serving {os.path.abspath(args.directory)} on {args.bind}:{args.port}', flush=True)
    httpd.serve_forever()
