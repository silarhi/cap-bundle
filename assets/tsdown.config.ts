import { defineConfig } from 'tsdown'

export default defineConfig([
    {
        // StimulusBundle, Encore and AssetMapper: cap-widget and Stimulus come from the application
        entry: ['src/index.ts', 'src/controller.ts'],
        format: ['esm'],
        outExtensions: () => ({ js: '.js', dts: '.d.ts' }),
        dts: true,
        // Committed: stable chunk names keep the diffs readable
        hash: false,
        clean: true,
    },
    {
        // The script CapType renders: one self-contained file, copied to public/bundles/silarhicap by assets:install
        entry: { cap: 'src/auto.ts' },
        outDir: '../public',
        format: ['esm'],
        outExtensions: () => ({ js: '.js' }),
        dts: false,
        minify: true,
        clean: false,
    },
])
