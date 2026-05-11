# Paper-1 Visual Test Fixtures

Small data slices + YAML configs used to visually verify chart trace builders
during paper figure pipeline development.

Each config in `configs/` declares its own output directory via
`output: { directory: ../_output }`, so PNG files land in the gitignored
`_output/` regardless of how the export is invoked.

## Run a single visual test

    cd simwrapper
    npm run export test-fixtures/paper1/configs/<name>.yaml

## Run all visual tests

    cd simwrapper
    for cfg in test-fixtures/paper1/configs/*.yaml; do
      npm run export "$cfg"
    done

> If you need to override the destination, use `--` to forward the flag past
> npm: `npm run export <yaml> -- --output <dir>`.

## Pass criteria

Open each generated PNG and confirm:
1. Renders without error.
2. Axes/titles/legends present, legible.
3. Scientific palette: black axes/text, #0072B2 blue marks, gray grid.
4. Multi-category traces use pattern fills (B&W safe).
5. No clipping or label overlap.

Outputs in `_output/` are gitignored; commit only fixtures and configs.
