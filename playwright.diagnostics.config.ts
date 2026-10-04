import { defineConfig } from '@playwright/test';
import gates from './playwright.config';

// Collector completion certifies only its explicit local assertions.
export default defineConfig(gates, { grep: /@diagnostic/, grepInvert: /@historical/ });
