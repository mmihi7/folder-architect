#!/usr/bin/env python3
"""
Folder Architect - Backend Scanner
Walks a directory tree and returns JSON structure with filtering options.
"""
import os
import sys
import json
import argparse

EXCLUDE_DIRS = {
    'node_modules', '.git', '.svn', '.hg', 'CVS',
    '__pycache__', '.pytest_cache', '.mypy_cache', '.ruff_cache',
    'venv', '.venv', 'env', '.env', 'virtualenv',
    'dist', 'build', 'target', 'out',
    '.next', '.nuxt', '.output', '.svelte-kit',
    'vendor', 'bower_components', 'jspm_packages',
    '.idea', '.vscode', '.gradle', '.angular',
    'coverage', '.nyc_output',
    '.tox', '.eggs', '.cache', '.pnpm-store',
    '.parcel-cache', '.turbo', '.docusaurus',
    'Pods', 'Carthage',
}

EXCLUDE_FILES = {
    'package-lock.json', 'yarn.lock', 'pnpm-lock.yaml', 'bun.lockb',
    'Pipfile.lock', 'poetry.lock', 'composer.lock', 'Gemfile.lock',
    'Cargo.lock', 'go.sum', 'packages.lock.json',
    '.DS_Store', 'Thumbs.db', 'desktop.ini',
}

COMPILE_EXTENSIONS = {'.pyc', '.pyo', '.class', '.o', '.so', '.dll',
                       '.dylib', '.exe', '.bin', '.obj', '.a', '.lib'}

def should_exclude_dir(name):
    return name in EXCLUDE_DIRS

def should_exclude_file(name, exclude_locks):
    if exclude_locks and name in EXCLUDE_FILES:
        return True
    ext = os.path.splitext(name)[1].lower()
    if ext in COMPILE_EXTENSIONS:
        return True
    return False

def scan_folder(path, extensions=None, exclude_dirs=True,
                exclude_locks=True, max_depth=None, depth=0,
                follow_symlinks=False):
    node = {
        'name': os.path.basename(path) or path,
        'path': path,
        'type': 'directory',
        'children': []
    }

    if max_depth is not None and depth >= max_depth:
        node['truncated'] = True
        return node

    try:
        entries = sorted(
            os.listdir(path),
            key=lambda x: (not os.path.isdir(os.path.join(path, x)), x.lower())
        )
    except (PermissionError, OSError) as e:
        node['error'] = str(e)
        return node

    for entry in entries:
        full = os.path.join(path, entry)
        if os.path.islink(full) and not follow_symlinks:
            continue

        if os.path.isdir(full):
            if exclude_dirs and should_exclude_dir(entry):
                continue
            child = scan_folder(
                full, extensions, exclude_dirs, exclude_locks,
                max_depth, depth + 1, follow_symlinks
            )
            node['children'].append(child)
        elif os.path.isfile(full):
            if should_exclude_file(entry, exclude_locks):
                continue
            ext = os.path.splitext(entry)[1].lower()
            if extensions is not None:
                if ext not in extensions:
                    continue
            node['children'].append({
                'name': entry,
                'path': full,
                'type': 'file',
                'extension': ext,
                'size': os.path.getsize(full)
            })

    return node

def get_all_extensions(path, max_scan_depth=15):
    extensions = {}
    visited = set()

    def walk(p, depth):
        if depth > max_scan_depth:
            return
        real = os.path.realpath(p)
        if real in visited:
            return
        visited.add(real)

        try:
            for entry in os.listdir(p):
                full = os.path.join(p, entry)
                if os.path.islink(full):
                    continue
                if os.path.isdir(full):
                    if should_exclude_dir(entry):
                        continue
                    walk(full, depth + 1)
                else:
                    if should_exclude_file(entry, True):
                        continue
                    ext = os.path.splitext(entry)[1].lower()
                    extensions[ext] = extensions.get(ext, 0) + 1
        except (PermissionError, OSError):
            pass

    walk(path, 0)
    return [{'extension': k, 'count': v} for k, v in
            sorted(extensions.items(), key=lambda x: (-x[1], x[0]))]

def main():
    parser = argparse.ArgumentParser(description='Folder Architect Scanner')
    parser.add_argument('folder', help='Folder to scan')
    parser.add_argument('--extensions', default='', help='Comma-separated extensions to include')
    parser.add_argument('--no-exclude-dirs', action='store_true', help='Do not exclude dependency directories')
    parser.add_argument('--no-exclude-locks', action='store_true', help='Do not exclude lock/dependency files')
    parser.add_argument('--max-depth', type=int, default=0, help='Maximum scan depth (0=unlimited)')
    parser.add_argument('--follow-symlinks', action='store_true', help='Follow symbolic links')
    parser.add_argument('--list-extensions', action='store_true', help='Only list all extensions found in folder')

    args = parser.parse_args()

    if not os.path.isdir(args.folder):
        print(json.dumps({'error': f'Not a directory: {args.folder}'}))
        sys.exit(1)

    if args.list_extensions:
        result = get_all_extensions(args.folder)
        print(json.dumps({'extensions': result}))
        return

    extensions = None
    if args.extensions.strip():
        extensions = set(
            e.strip().lower() if e.strip() else ''
            for e in args.extensions.split(',')
        )

    tree = scan_folder(
        args.folder,
        extensions=extensions,
        exclude_dirs=not args.no_exclude_dirs,
        exclude_locks=not args.no_exclude_locks,
        max_depth=args.max_depth if args.max_depth > 0 else None,
        follow_symlinks=args.follow_symlinks
    )
    print(json.dumps(tree))

if __name__ == '__main__':
    main()
