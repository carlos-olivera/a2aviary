import { architecturePage } from './scripts/architecture-plugin.mjs';
import { defineConfig } from 'vite';
import { changelogSection } from './scripts/changelog-plugin.mjs';
import { costsPage } from './scripts/costs-plugin.mjs';
import { policyPages } from './scripts/policies-plugin.mjs';

export default defineConfig({
  plugins: [architecturePage(), costsPage(), policyPages(), changelogSection()],
  build: {
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            { name: 'three-core', test: /three[\\/]build[\\/]three\.core\.js$/ },
            { name: 'three-renderer', test: /three[\\/]build[\\/]three\.module\.js$/ },
          ],
        },
      },
    },
  },
});
