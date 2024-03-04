#!/usr/bin/env -S node --enable-source-maps --no-warnings=ExperimentalWarning
// Importing JSON is experimental

import { cliEntry } from './core/run-entities.js';

cliEntry();