/********************************************************************************
 * Copyright (c) 2026 EclipseSource and others.
 *
 * This program and the accompanying materials are made available under the
 * terms of the Eclipse Public License v. 2.0 which is available at
 * http://www.eclipse.org/legal/epl-2.0.
 *
 * This Source Code may also be made available under the following Secondary
 * Licenses when the conditions for such availability set forth in the Eclipse
 * Public License v. 2.0 are satisfied: GNU General Public License, version 2
 * with the GNU Classpath Exception which is available at
 * https://www.gnu.org/software/classpath/license.html.
 *
 * SPDX-License-Identifier: EPL-2.0 OR GPL-2.0 WITH Classpath-exception-2.0
 ********************************************************************************/

// CI lint step: runs oxlint once with the JSON reporter and turns the result into
//   1. GitHub workflow commands (`::error` / `::warning`), which become inline annotations on the PR, and
//   2. a Markdown table appended to the job summary (`$GITHUB_STEP_SUMMARY`; printed to stdout when unset).
// Exits non-zero when oxlint reported errors or failed to run, so the job fails like `pnpm lint` would.
// Extra arguments are passed on to oxlint; positional paths replace the default `.` (e.g. to lint a subset).

import { spawnSync } from 'node:child_process';
import { appendFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const MAX_ROWS = 200;

// Resolve the hoisted binary directly so the script also works outside of `pnpm run`.
const oxlint = join(root, 'node_modules', '.bin', process.platform === 'win32' ? 'oxlint.cmd' : 'oxlint');
const extraArgs = process.argv.slice(2);
const paths = extraArgs.some(arg => !arg.startsWith('-')) ? [] : ['.'];
const result = spawnSync(oxlint, [...paths, '--format', 'json', ...extraArgs], {
    cwd: root,
    encoding: 'utf8',
    shell: process.platform === 'win32',
    maxBuffer: 64 * 1024 * 1024
});

if (result.error) {
    process.stderr.write(`Failed to run ${oxlint}: ${result.error.message}\n`);
    process.exit(1);
}

let report;
try {
    report = JSON.parse(result.stdout);
} catch {
    // No parsable report means oxlint itself failed (bad config, missing plugin, ...): surface its output as is.
    process.stdout.write(result.stdout ?? '');
    process.stderr.write(result.stderr ?? '');
    process.exit(result.status ?? 1);
}

const diagnostics = report.diagnostics ?? [];
const errors = diagnostics.filter(d => d.severity === 'error').length;
const warnings = diagnostics.length - errors;

// 1. Annotations
for (const d of diagnostics) {
    const span = d.labels?.[0]?.span;
    const location = span ? `,line=${span.line},col=${span.column}` : '';
    const level = d.severity === 'error' ? 'error' : 'warning';
    process.stdout.write(`::${level} file=${d.filename}${location},title=${d.code}::${escapeCommand(d.message)}\n`);
}

// 2. Job summary
const lines = ['## Lint report', ''];
if (diagnostics.length === 0) {
    lines.push(`✅ No findings in ${report.number_of_files} files (${report.number_of_rules} rules).`);
} else {
    lines.push(
        `${errors > 0 ? '❌' : '⚠️'} **${errors} error${plural(errors)}, ${warnings} warning${plural(warnings)}** in ${report.number_of_files} files (${report.number_of_rules} rules).`,
        '',
        '| File | Line | Severity | Rule | Message |',
        '| --- | ---: | --- | --- | --- |'
    );
    const sorted = [...diagnostics].sort(
        (a, b) => a.filename.localeCompare(b.filename) || (a.labels?.[0]?.span?.line ?? 0) - (b.labels?.[0]?.span?.line ?? 0)
    );
    for (const d of sorted.slice(0, MAX_ROWS)) {
        const span = d.labels?.[0]?.span;
        lines.push(`| \`${d.filename}\` | ${span?.line ?? ''} | ${d.severity} | \`${d.code}\` | ${escapeCell(d.message)} |`);
    }
    if (sorted.length > MAX_ROWS) {
        lines.push('', `… ${sorted.length - MAX_ROWS} more finding${plural(sorted.length - MAX_ROWS)} omitted.`);
    }
}
lines.push('');

const summary = lines.join('\n');
if (process.env.GITHUB_STEP_SUMMARY) {
    appendFileSync(process.env.GITHUB_STEP_SUMMARY, summary);
} else {
    process.stdout.write(summary);
}

process.stdout.write(`Found ${warnings} warning${plural(warnings)} and ${errors} error${plural(errors)}.\n`);
process.exit(errors > 0 ? 1 : 0);

function plural(n) {
    return n === 1 ? '' : 's';
}

// Workflow command messages are single-line; encode the characters GitHub reserves.
function escapeCommand(text) {
    return text.replace(/%/g, '%25').replace(/\r/g, '%0D').replace(/\n/g, '%0A');
}

function escapeCell(text) {
    return text.replace(/\|/g, '\\|').replace(/\r?\n/g, ' ');
}
