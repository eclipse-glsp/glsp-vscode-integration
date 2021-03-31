/********************************************************************************
 * Copyright (c) 2021 EclipseSource and others.
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

export namespace GLSPJavaServerArgs {
    /**
     * Utility function to create the additional launch args for a GLSP Java Server
     * to enable file logging.
     * @param logDir Path to the directy where the log files should be stored
     * @param disableConsolelogging Flag to indicate wether default console logging should be disabled
     */
    export function enableFileLogging(logDir: string, disableConsolelogging = true): string[] {
        const additionalArgs = ['--fileLog', 'true', '--logDir', logDir];
        if (disableConsolelogging) {
            additionalArgs.push('--consoleLog');
            additionalArgs.push('false');
        }
        return additionalArgs;
    }
}
