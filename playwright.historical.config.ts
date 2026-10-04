import { defineConfig } from '@playwright/test';
import gates from './playwright.config';

// Requires explicit provisioned historical inputs; never part of current gates.
export default defineConfig(gates, { grep: /@historical/, grepInvert: /@diagnostic/ });
