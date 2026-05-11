# Paper-1 Visual Test Fixtures

Small data slices + YAML configs used to visually verify chart trace builders
during paper figure pipeline development.

## Run a single visual test

    cd simwrapper
    npm run export test-fixtures/paper1/configs/<name>.yaml --output test-fixtures/paper1/_output/

## Run all visual tests

    cd simwrapper
    for cfg in test-fixtures/paper1/configs/*.yaml; do
      npm run export "$cfg" --output test-fixtures/paper1/_output/
    done

## Pass criteria

Open each generated PNG and confirm:
1. Renders without error.
2. Axes/titles/legends present, legible.
3. Scientific palette: black axes/text, #0072B2 blue marks, gray grid.
4. Multi-category traces use pattern fills (B&W safe).
5. No clipping or label overlap.

Outputs in `_output/` are gitignored; commit only fixtures and configs.
